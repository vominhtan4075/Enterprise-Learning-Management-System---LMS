import {
  HttpStatus,
  Injectable,
  Logger,
  StreamableFile,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PrismaService } from '../prisma.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { RoleCode } from '../generated/prisma/enums.js';

export interface UploadedFilePayload {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const PDF_MAGIC_PREFIX = '%PDF-';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly uploadDir: string;
  private readonly maxUploadBytes: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly coursesService: CoursesService,
  ) {
    const dir = this.configService.get<string>('UPLOAD_DIR') ?? './uploads';
    this.uploadDir = resolve(dir);
    const maxMb = this.configService.get<number>('MAX_UPLOAD_MB') ?? 20;
    this.maxUploadBytes = maxMb * 1024 * 1024;
  }

  /**
   * Kiểm tra magic bytes %PDF- ở đầu buffer (không tin tưởng header Content-Type đơn thuần)
   */
  validatePdfBuffer(file?: UploadedFilePayload): void {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Vui lòng đính kèm tệp PDF hợp lệ.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (file.size > this.maxUploadBytes || file.buffer.length > this.maxUploadBytes) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        `Kích thước tệp vượt quá giới hạn cho phép (${Math.round(this.maxUploadBytes / (1024 * 1024))} MB).`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const headerAscii = file.buffer.subarray(0, 5).toString('ascii');
    if (headerAscii !== PDF_MAGIC_PREFIX) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Tệp tải lên không phải là định dạng PDF hợp lệ (sai chữ ký magic bytes %PDF-).',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async uploadPdf(file: UploadedFilePayload, actor: AuthenticatedUser) {
    this.validatePdfBuffer(file);

    await mkdir(this.uploadDir, { recursive: true });

    const storageKey = `${randomUUID()}.pdf`;
    const filePath = join(this.uploadDir, storageKey);
    const checksum = createHash('sha256').update(file.buffer).digest('hex');

    await writeFile(filePath, file.buffer);

    const created = await this.prisma.file.create({
      data: {
        storageKey,
        originalName: file.originalname,
        mimeType: 'application/pdf',
        sizeBytes: file.buffer.length,
        checksum,
        uploadedById: actor.id,
      },
    });

    this.logger.log(
      `Audit: actor=${actor.id} uploaded PDF file=${created.id} (${created.sizeBytes} bytes, sha256=${checksum.slice(0, 12)}...)`,
    );

    return {
      ...created,
      url: `/api/v1/files/${created.id}`,
    };
  }

  async downloadFile(
    id: string,
    actor: AuthenticatedUser,
  ): Promise<{ streamable: StreamableFile; originalName: string; mimeType: string }> {
    const fileRecord = await this.prisma.file.findUnique({
      where: { id },
      include: {
        lessons: {
          where: { deletedAt: null },
          select: {
            id: true,
            module: {
              select: {
                deletedAt: true,
                courseId: true,
                course: {
                  select: {
                    id: true,
                    isPublished: true,
                    deletedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!fileRecord) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy tệp tài liệu ${id}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Nếu là EMPLOYEE: bắt buộc tệp phải thuộc ít nhất 1 khóa học đã publish mà học viên được giao
    if (actor.role === RoleCode.EMPLOYEE) {
      const validCourseIds = fileRecord.lessons
        .filter(
          (l) =>
            l.module.deletedAt === null &&
            l.module.course.deletedAt === null &&
            l.module.course.isPublished,
        )
        .map((l) => l.module.courseId);

      let hasAccess = false;
      for (const courseId of validCourseIds) {
        const enrolled = await this.coursesService.isUserEnrolledInCourse(
          actor.id,
          courseId,
        );
        if (enrolled) {
          hasAccess = true;
          break;
        }
      }

      if (!hasAccess) {
        throw new BusinessException(
          ErrorCode.NOT_ENROLLED,
          'Bạn chưa được ghi danh vào khóa học chứa tài liệu này.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const filePath = join(this.uploadDir, fileRecord.storageKey);
    if (!existsSync(filePath)) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Tệp vật lý không tồn tại trên máy chủ.',
        HttpStatus.NOT_FOUND,
      );
    }

    const stream = createReadStream(filePath);
    return {
      streamable: new StreamableFile(stream),
      originalName: fileRecord.originalName,
      mimeType: fileRecord.mimeType,
    };
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const fileRecord = await this.prisma.file.findUnique({
      where: { id },
      include: {
        lessons: {
          where: { deletedAt: null },
          select: { id: true, title: true },
        },
      },
    });

    if (!fileRecord) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy tệp tài liệu ${id}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (
      actor.role !== RoleCode.ADMIN &&
      fileRecord.uploadedById !== actor.id
    ) {
      throw new BusinessException(
        ErrorCode.AUTH_FORBIDDEN,
        'Bạn chỉ có quyền xóa tệp tài liệu do chính mình tải lên.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (fileRecord.lessons.length > 0) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Không thể xóa tệp đang được gắn với bài học đang hoạt động.',
        HttpStatus.UNPROCESSABLE_ENTITY,
        [{ referencedLessons: fileRecord.lessons }],
      );
    }

    const filePath = join(this.uploadDir, fileRecord.storageKey);
    if (existsSync(filePath)) {
      await unlink(filePath).catch(() => undefined);
    }

    await this.prisma.file.delete({ where: { id } });

    this.logger.log(`Audit: actor=${actor.id} deleted file=${id}`);
    return { id, deleted: true };
  }
}

