import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { FilesService } from '../files/files.service.js';
import type { UploadedFilePayload } from '../files/files.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import { validateReorderIds } from '../common/utils/reorder.util.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { ContentType, Prisma, RoleCode } from '../generated/prisma/client.js';
import {
  CreateLessonDto,
  ReorderLessonsDto,
  UpdateLessonDto,
} from './dto/lesson.dto.js';

@Injectable()
export class LessonsService {
  private readonly logger = new Logger(LessonsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
    private readonly filesService: FilesService,
  ) {}

  async create(
    moduleId: string,
    dto: CreateLessonDto,
    actor: AuthenticatedUser,
    uploadedFile?: UploadedFilePayload,
  ) {
    const mod = await this.findActiveModuleWithCourseOrThrow(moduleId);
    this.coursesService.assertOwnership(mod.course, actor);

    const lessonId = randomUUID();
    const resolved = await this.resolveLessonContent(
      lessonId,
      dto.contentType,
      dto.contentUrl,
      dto.contentText,
      dto.fileId,
      actor,
      uploadedFile,
    );

    const existingLessons = await this.prisma.lesson.findMany({
      where: { moduleId, deletedAt: null },
      orderBy: { lessonOrder: 'asc' },
      select: { id: true, lessonOrder: true },
    });

    const maxOrder =
      existingLessons.length > 0
        ? Math.max(...existingLessons.map((l) => l.lessonOrder))
        : 0;

    const targetOrder =
      dto.lessonOrder !== undefined
        ? Math.min(dto.lessonOrder, maxOrder + 1)
        : maxOrder + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      if (targetOrder <= maxOrder) {
        await tx.lesson.updateMany({
          where: {
            moduleId,
            deletedAt: null,
            lessonOrder: { gte: targetOrder },
          },
          data: {
            lessonOrder: { increment: 1 },
          },
        });
      }

      return tx.lesson.create({
        data: {
          id: lessonId,
          moduleId,
          title: dto.title.trim(),
          contentType: dto.contentType,
          contentUrl: resolved.contentUrl,
          contentText: resolved.contentText,
          fileId: resolved.fileId,
          durationMinutes: dto.durationMinutes ?? 0,
          isRequired: dto.isRequired ?? true,
          lessonOrder: targetOrder,
        },
      });
    });

    await this.coursesService.invalidateCourseCaches(mod.courseId);
    this.logger.log(
      `Audit: actor=${actor.id} created lesson=${created.id} type=${created.contentType} in module=${moduleId} order=${created.lessonOrder}`,
    );
    return created;
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const lesson = await this.findActiveLessonWithCourseOrThrow(id);

    if (actor.role === RoleCode.EMPLOYEE) {
      if (!lesson.module.course.isPublished) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          `Không tìm thấy bài học ${id}.`,
          HttpStatus.NOT_FOUND,
        );
      }

      const enrolled = await this.coursesService.isUserEnrolledInCourse(
        actor.id,
        lesson.module.courseId,
      );
      if (!enrolled) {
        throw new BusinessException(
          ErrorCode.NOT_ENROLLED,
          'Bạn chưa được ghi danh vào khóa học chứa bài học này.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    return lesson;
  }

  async getContent(id: string, actor: AuthenticatedUser) {
    const lesson = await this.findOne(id, actor);
    return {
      id: lesson.id,
      title: lesson.title,
      contentType: lesson.contentType,
      contentUrl: lesson.contentUrl,
      contentText: lesson.contentText,
    };
  }

  async update(
    id: string,
    dto: UpdateLessonDto,
    actor: AuthenticatedUser,
    uploadedFile?: UploadedFilePayload,
  ) {
    const existing = await this.findActiveLessonWithCourseOrThrow(id);
    this.coursesService.assertOwnership(existing.module.course, actor);

    const effectiveType = dto.contentType ?? existing.contentType;
    const data: Prisma.LessonUpdateInput = {};

    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.durationMinutes !== undefined) {
      data.durationMinutes = dto.durationMinutes;
    }
    if (dto.isRequired !== undefined) {
      data.isRequired = dto.isRequired;
    }
    if (dto.lessonOrder !== undefined) {
      data.lessonOrder = dto.lessonOrder;
    }

    const contentChanged =
      dto.contentType !== undefined ||
      dto.contentUrl !== undefined ||
      dto.contentText !== undefined ||
      dto.fileId !== undefined ||
      uploadedFile !== undefined;

    if (contentChanged) {
      const resolved = await this.resolveLessonContent(
        id,
        effectiveType,
        dto.contentUrl ?? existing.contentUrl,
        dto.contentText !== undefined ? dto.contentText : existing.contentText ?? undefined,
        dto.fileId !== undefined ? dto.fileId : existing.fileId ?? undefined,
        actor,
        uploadedFile,
      );
      data.contentType = effectiveType;
      data.contentUrl = resolved.contentUrl;
      data.contentText = resolved.contentText;
      data.file = resolved.fileId
        ? { connect: { id: resolved.fileId } }
        : { disconnect: true };
    }

    const updated = await this.prisma.lesson.update({
      where: { id },
      data,
    });

    await this.coursesService.invalidateCourseCaches(existing.module.courseId);
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const existing = await this.findActiveLessonWithCourseOrThrow(id);
    this.coursesService.assertOwnership(existing.module.course, actor);

    const referencedQuestionsCount = await this.prisma.question.count({
      where: { relatedLessonId: id, deletedAt: null },
    });

    const removed = await this.prisma.$transaction(async (tx) => {
      // D-19: luôn xóa mềm (soft-delete), không hard-delete bài học
      const softDeleted = await tx.lesson.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      const remaining = await tx.lesson.findMany({
        where: { moduleId: existing.moduleId, deletedAt: null },
        orderBy: { lessonOrder: 'asc' },
        select: { id: true },
      });

      for (let i = 0; i < remaining.length; i++) {
        await tx.lesson.update({
          where: { id: remaining[i].id },
          data: { lessonOrder: i + 1 },
        });
      }

      return softDeleted;
    });

    if (referencedQuestionsCount > 0) {
      this.logger.warn(
        `Lesson ${id} soft-deleted while ${referencedQuestionsCount} quiz questions still reference relatedLessonId=${id}`,
      );
    }

    await this.coursesService.invalidateCourseCaches(existing.module.courseId);
    this.logger.log(
      `Audit: actor=${actor.id} soft-deleted lesson=${id} in module=${existing.moduleId}`,
    );

    return {
      ...removed,
      referencedQuestionsCount,
    };
  }

  async reorder(
    moduleId: string,
    dto: ReorderLessonsDto,
    actor: AuthenticatedUser,
  ) {
    const mod = await this.findActiveModuleWithCourseOrThrow(moduleId);
    this.coursesService.assertOwnership(mod.course, actor);

    const activeLessons = await this.prisma.lesson.findMany({
      where: { moduleId, deletedAt: null },
      orderBy: { lessonOrder: 'asc' },
      select: { id: true },
    });

    validateReorderIds(
      activeLessons.map((l) => l.id),
      dto.orderedIds,
      'bài học (lesson)',
    );

    // Transaction 2 bước (thỏa CHECK lesson_order > 0):
    // Bước 1: đẩy sang 100_000 + i + 1
    // Bước 2: gán lại dãy liên tục 1..n
    const reordered = await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.orderedIds.length; i++) {
        await tx.lesson.update({
          where: { id: dto.orderedIds[i] },
          data: { lessonOrder: 100_000 + i + 1 },
        });
      }

      const results = [];
      for (let i = 0; i < dto.orderedIds.length; i++) {
        const updated = await tx.lesson.update({
          where: { id: dto.orderedIds[i] },
          data: { lessonOrder: i + 1 },
        });
        results.push(updated);
      }
      return results;
    });

    await this.coursesService.invalidateCourseCaches(mod.courseId);
    this.logger.log(
      `Audit: actor=${actor.id} reordered ${dto.orderedIds.length} lessons in module=${moduleId}`,
    );
    return reordered;
  }

  /**
   * Chuẩn hóa và kiểm tra tính hợp lệ của nội dung bài học theo ContentType (WP5 5.3)
   */
  private async resolveLessonContent(
    lessonId: string,
    contentType: ContentType,
    contentUrl: string | undefined,
    contentText: string | undefined,
    fileId: string | undefined,
    actor: AuthenticatedUser,
    uploadedFile?: UploadedFilePayload,
  ): Promise<{
    contentUrl: string;
    contentText: string | null;
    fileId: string | null;
  }> {
    if (contentType === ContentType.VIDEO) {
      this.validateHttpUrl(contentUrl);
      return {
        contentUrl: contentUrl!.trim(),
        contentText: contentText?.trim() ?? null,
        fileId: null,
      };
    }

    if (contentType === ContentType.PDF) {
      if (uploadedFile) {
        const uploaded = await this.filesService.uploadPdf(uploadedFile, actor);
        return {
          contentUrl: `/api/v1/files/${uploaded.id}`,
          contentText: contentText?.trim() ?? null,
          fileId: uploaded.id,
        };
      }

      if (fileId) {
        const existingFile = await this.prisma.file.findUnique({
          where: { id: fileId },
        });
        if (!existingFile) {
          throw new BusinessException(
            ErrorCode.NOT_FOUND,
            `Không tìm thấy tệp PDF với fileId=${fileId}.`,
            HttpStatus.NOT_FOUND,
          );
        }
        return {
          contentUrl: `/api/v1/files/${existingFile.id}`,
          contentText: contentText?.trim() ?? null,
          fileId: existingFile.id,
        };
      }

      if (contentUrl && contentUrl.trim().length > 0) {
        const trimmed = contentUrl.trim();
        if (!trimmed.startsWith('/api/v1/files/')) {
          this.validateHttpUrl(trimmed);
        }
        return {
          contentUrl: trimmed,
          contentText: contentText?.trim() ?? null,
          fileId: null,
        };
      }

      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Bài học PDF bắt buộc phải đính kèm tệp PDF (multipart file), truyền fileId hoặc contentUrl hợp lệ.',
        HttpStatus.BAD_REQUEST,
      );
    }

    // ContentType.MARKDOWN
    let markdownText = contentText?.trim() ?? '';
    if (!markdownText && uploadedFile?.buffer) {
      markdownText = uploadedFile.buffer.toString('utf-8').trim();
    }

    if (!markdownText) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Bài học MARKDOWN bắt buộc phải có nội dung văn bản (contentText) hoặc tệp .md đính kèm.',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      contentUrl: `/api/v1/lessons/${lessonId}/content`,
      contentText: markdownText,
      fileId: null,
    };
  }

  private validateHttpUrl(url?: string): void {
    if (!url || url.trim().length === 0) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'contentUrl không được để trống đối với bài học VIDEO.',
        HttpStatus.BAD_REQUEST,
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(url.trim());
    } catch {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'contentUrl không phải là một đường dẫn URL hợp lệ.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'contentUrl chỉ chấp nhận giao thức http:// hoặc https:// (từ chối javascript: hoặc giao thức không an toàn).',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async findActiveModuleWithCourseOrThrow(moduleId: string) {
    const mod = await this.prisma.module.findFirst({
      where: { id: moduleId, deletedAt: null, course: { deletedAt: null } },
      include: {
        course: {
          select: { id: true, createdById: true, isPublished: true },
        },
      },
    });
    if (!mod) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy học phần ${moduleId}.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return mod;
  }

  private async findActiveLessonWithCourseOrThrow(id: string) {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id,
        deletedAt: null,
        module: { deletedAt: null, course: { deletedAt: null } },
      },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            moduleOrder: true,
            courseId: true,
            course: {
              select: {
                id: true,
                title: true,
                createdById: true,
                isPublished: true,
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy bài học ${id}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    return lesson;
  }
}

