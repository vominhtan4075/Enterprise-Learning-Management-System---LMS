import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import { validateReorderIds } from '../common/utils/reorder.util.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  CreateModuleDto,
  ReorderModulesDto,
  UpdateModuleDto,
} from './dto/module.dto.js';

@Injectable()
export class ModulesService {
  private readonly logger = new Logger(ModulesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly coursesService: CoursesService,
  ) {}

  async create(
    courseId: string,
    dto: CreateModuleDto,
    actor: AuthenticatedUser,
  ) {
    await this.coursesService.assertOwnershipByCourseId(courseId, actor);
    this.validateDayRange(dto.dayStart, dto.dayEnd);

    const existingModules = await this.prisma.module.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { moduleOrder: 'asc' },
      select: { id: true, moduleOrder: true },
    });

    const maxOrder =
      existingModules.length > 0
        ? Math.max(...existingModules.map((m) => m.moduleOrder))
        : 0;

    const targetOrder =
      dto.moduleOrder !== undefined
        ? Math.min(dto.moduleOrder, maxOrder + 1)
        : maxOrder + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      // Nếu chèn vào vị trí đã có module -> dồn các module phía sau lên +1
      if (targetOrder <= maxOrder) {
        await tx.module.updateMany({
          where: {
            courseId,
            deletedAt: null,
            moduleOrder: { gte: targetOrder },
          },
          data: {
            moduleOrder: { increment: 1 },
          },
        });
      }

      return tx.module.create({
        data: {
          courseId,
          title: dto.title.trim(),
          moduleOrder: targetOrder,
          description: dto.description?.trim() ?? null,
          dayStart: dto.dayStart ?? null,
          dayEnd: dto.dayEnd ?? null,
        },
      });
    });

    await this.coursesService.invalidateCourseCaches(courseId);
    this.logger.log(
      `Audit: actor=${actor.id} created module=${created.id} in course=${courseId} order=${created.moduleOrder}`,
    );
    return created;
  }

  async update(id: string, dto: UpdateModuleDto, actor: AuthenticatedUser) {
    const existing = await this.findActiveWithCourseOrThrow(id);
    this.coursesService.assertOwnership(existing.course, actor);

    const effectiveDayStart =
      dto.dayStart !== undefined ? dto.dayStart : existing.dayStart;
    const effectiveDayEnd =
      dto.dayEnd !== undefined ? dto.dayEnd : existing.dayEnd;
    this.validateDayRange(effectiveDayStart, effectiveDayEnd);

    const data: Prisma.ModuleUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.dayStart !== undefined) {
      data.dayStart = dto.dayStart;
    }
    if (dto.dayEnd !== undefined) {
      data.dayEnd = dto.dayEnd;
    }
    if (dto.moduleOrder !== undefined) {
      data.moduleOrder = dto.moduleOrder;
    }

    const updated = await this.prisma.module.update({
      where: { id },
      data,
    });

    await this.coursesService.invalidateCourseCaches(existing.courseId);
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const existing = await this.findActiveWithCourseOrThrow(id);
    this.coursesService.assertOwnership(existing.course, actor);

    // Chặn xóa học phần nếu đã có lượt làm bài Quiz hoặc có bài học đã hoàn thành (WP5 5.2 & D-19)
    const [quizAttemptCount, completedProgressCount] = await Promise.all([
      this.prisma.quizAttempt.count({
        where: {
          quiz: { moduleId: id },
        },
      }),
      this.prisma.userProgress.count({
        where: {
          isCompleted: true,
          lesson: { moduleId: id },
        },
      }),
    ]);

    if (quizAttemptCount > 0 || completedProgressCount > 0) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Không thể xóa học phần đã có học viên làm bài kiểm tra (quiz attempt) hoặc có tiến độ hoàn thành bài học.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        [
          {
            quizAttemptCount,
            completedProgressCount,
          },
        ],
      );
    }

    const removed = await this.prisma.$transaction(async (tx) => {
      const softDeleted = await tx.module.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      // Dồn lại thứ tự moduleOrder liên tục 1..n cho các học phần còn lại
      const remaining = await tx.module.findMany({
        where: { courseId: existing.courseId, deletedAt: null },
        orderBy: { moduleOrder: 'asc' },
        select: { id: true },
      });

      for (let i = 0; i < remaining.length; i++) {
        await tx.module.update({
          where: { id: remaining[i].id },
          data: { moduleOrder: i + 1 },
        });
      }

      return softDeleted;
    });

    await this.coursesService.invalidateCourseCaches(existing.courseId);
    this.logger.log(
      `Audit: actor=${actor.id} soft-deleted module=${id} in course=${existing.courseId}`,
    );
    return removed;
  }

  async reorder(
    courseId: string,
    dto: ReorderModulesDto,
    actor: AuthenticatedUser,
  ) {
    await this.coursesService.assertOwnershipByCourseId(courseId, actor);

    const activeModules = await this.prisma.module.findMany({
      where: { courseId, deletedAt: null },
      orderBy: { moduleOrder: 'asc' },
      select: { id: true },
    });

    validateReorderIds(
      activeModules.map((m) => m.id),
      dto.orderedIds,
      'học phần (module)',
    );

    // Transaction 2 bước (WP5 5.2 & mục 4.4):
    // Bước 1: đẩy sang khoảng tạm dương lớn (thỏa CHECK module_order > 0)
    // Bước 2: gán lại dãy liên tục 1..n
    const reordered = await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.orderedIds.length; i++) {
        await tx.module.update({
          where: { id: dto.orderedIds[i] },
          data: { moduleOrder: 100_000 + i + 1 },
        });
      }

      const results = [];
      for (let i = 0; i < dto.orderedIds.length; i++) {
        const updated = await tx.module.update({
          where: { id: dto.orderedIds[i] },
          data: { moduleOrder: i + 1 },
        });
        results.push(updated);
      }
      return results;
    });

    await this.coursesService.invalidateCourseCaches(courseId);
    this.logger.log(
      `Audit: actor=${actor.id} reordered ${dto.orderedIds.length} modules in course=${courseId}`,
    );
    return reordered;
  }

  private validateDayRange(
    dayStart?: number | null,
    dayEnd?: number | null,
  ): void {
    if (
      dayStart !== undefined &&
      dayStart !== null &&
      dayEnd !== undefined &&
      dayEnd !== null &&
      dayEnd < dayStart
    ) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Ngày kết thúc (dayEnd) phải lớn hơn hoặc bằng ngày bắt đầu (dayStart).',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private async findActiveWithCourseOrThrow(id: string) {
    const mod = await this.prisma.module.findFirst({
      where: { id, deletedAt: null, course: { deletedAt: null } },
      include: {
        course: {
          select: { id: true, createdById: true },
        },
      },
    });
    if (!mod) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy học phần ${id}.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return mod;
  }
}

