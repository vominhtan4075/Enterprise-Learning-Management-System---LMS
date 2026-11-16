import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { HttpStatus } from '@nestjs/common';
import { LessonsService } from './lessons.service.js';
import { PrismaService } from '../prisma.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { FilesService } from '../files/files.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import {
  ContentType,
  PositionLevel,
  RoleCode,
} from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

describe('LessonsService (WP5 – 5.3 Lesson)', () => {
  let service: LessonsService;
  let prismaMock: {
    module: {
      findFirst: ReturnType<typeof jest.fn>;
    };
    lesson: {
      findMany: ReturnType<typeof jest.fn>;
      findFirst: ReturnType<typeof jest.fn>;
      create: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
      updateMany: ReturnType<typeof jest.fn>;
    };
    file: {
      findUnique: ReturnType<typeof jest.fn>;
    };
    question: {
      count: ReturnType<typeof jest.fn>;
    };
    $transaction: ReturnType<typeof jest.fn>;
  };
  let coursesServiceMock: {
    assertOwnership: ReturnType<typeof jest.fn>;
    invalidateCourseCaches: ReturnType<typeof jest.fn>;
    isUserEnrolledInCourse: ReturnType<typeof jest.fn>;
  };
  let filesServiceMock: {
    uploadPdf: ReturnType<typeof jest.fn>;
  };

  const trainerA: AuthenticatedUser = {
    id: 'trainer-a',
    email: 'trainer.a@novatech.com',
    fullName: 'Trainer A',
    role: RoleCode.TRAINER,
    position: PositionLevel.SENIOR,
    department: 'Training',
    mustChangePassword: false,
    tokenVersion: 0,
  };

  const employeeUser: AuthenticatedUser = {
    id: 'emp-1',
    email: 'emp1@novatech.com',
    fullName: 'Employee 1',
    role: RoleCode.EMPLOYEE,
    position: PositionLevel.FRESHER,
    department: 'Engineering',
    mustChangePassword: false,
    tokenVersion: 0,
  };

  beforeEach(() => {
    prismaMock = {
      module: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'mod-1',
          courseId: 'course-1',
          course: { id: 'course-1', createdById: trainerA.id, isPublished: true },
        } as never),
      },
      lesson: {
        findMany: jest.fn().mockResolvedValue([] as never),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      file: {
        findUnique: jest.fn(),
      },
      question: {
        count: jest.fn().mockResolvedValue(0 as never),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(prismaMock),
      ),
    };

    coursesServiceMock = {
      assertOwnership: jest.fn((course: { createdById: string | null }, actor: AuthenticatedUser) => {
        if (actor.role !== RoleCode.ADMIN && course.createdById !== actor.id) {
          throw new BusinessException(
            ErrorCode.AUTH_FORBIDDEN,
            'Forbidden',
            HttpStatus.FORBIDDEN,
          );
        }
      }),
      invalidateCourseCaches: jest.fn().mockResolvedValue(undefined as never),
      isUserEnrolledInCourse: jest.fn().mockResolvedValue(false as never),
    };

    filesServiceMock = {
      uploadPdf: jest.fn(),
    };

    service = new LessonsService(
      prismaMock as unknown as PrismaService,
      coursesServiceMock as unknown as CoursesService,
      filesServiceMock as unknown as FilesService,
    );
  });

  describe('create()', () => {
    it('nên chặn URL javascript: đối với bài học VIDEO -> 400 BAD_REQUEST', async () => {
      await expect(
        service.create(
          'mod-1',
          {
            title: 'XSS Video',
            contentType: ContentType.VIDEO,
            contentUrl: 'javascript:alert(1)',
          },
          trainerA,
        ),
      ).rejects.toMatchObject({
        errorCode: 'BAD_REQUEST',
        status: 400,
      });
    });

    it('nên tạo bài học PDF từ tệp tải lên qua FilesService và gán contentUrl = /api/v1/files/{id}', async () => {
      filesServiceMock.uploadPdf.mockResolvedValue({
        id: 'file-pdf-1',
      } as never);
      prismaMock.lesson.create.mockImplementation((args: any) =>
        Promise.resolve(args.data),
      );

      const res = await service.create(
        'mod-1',
        {
          title: 'Tài liệu Spring Security PDF',
          contentType: ContentType.PDF,
          durationMinutes: 30,
        },
        trainerA,
        {
          originalname: 'spring-security.pdf',
          mimetype: 'application/pdf',
          size: 1024,
          buffer: Buffer.from('%PDF-1.7 test'),
        },
      );

      expect(filesServiceMock.uploadPdf).toHaveBeenCalled();
      expect(res.fileId).toBe('file-pdf-1');
      expect(res.contentUrl).toBe('/api/v1/files/file-pdf-1');
      expect(res.lessonOrder).toBe(1);
    });

    it('nên tạo bài học MARKDOWN và tự động điền contentUrl = /api/v1/lessons/{id}/content', async () => {
      prismaMock.lesson.create.mockImplementation((args: any) =>
        Promise.resolve(args.data),
      );

      const res = await service.create(
        'mod-1',
        {
          title: 'Hướng dẫn Git Flow',
          contentType: ContentType.MARKDOWN,
          contentText: '# Quy trình Git Flow tại NovaTech',
        },
        trainerA,
      );

      expect(res.contentUrl).toBe(`/api/v1/lessons/${res.id}/content`);
      expect(res.contentText).toBe('# Quy trình Git Flow tại NovaTech');
    });

    it('nên dồn lessonOrder các bài học phía sau lên +1 khi chèn vào giữa', async () => {
      prismaMock.lesson.findMany.mockResolvedValue([
        { id: 'l-1', lessonOrder: 1 },
        { id: 'l-2', lessonOrder: 2 },
      ] as never);
      prismaMock.lesson.create.mockImplementation((args: any) =>
        Promise.resolve(args.data),
      );

      const res = await service.create(
        'mod-1',
        {
          title: 'Bài chèn vào vị trí 1',
          contentType: ContentType.VIDEO,
          contentUrl: 'https://www.youtube.com/watch?v=abc',
          lessonOrder: 1,
        },
        trainerA,
      );

      expect(prismaMock.lesson.updateMany).toHaveBeenCalledWith({
        where: {
          moduleId: 'mod-1',
          deletedAt: null,
          lessonOrder: { gte: 1 },
        },
        data: { lessonOrder: { increment: 1 } },
      });
      expect(res.lessonOrder).toBe(1);
    });
  });

  describe('findOne() cho EMPLOYEE', () => {
    it('EMPLOYEE xem bài học thuộc khóa học chưa ghi danh -> 403 COURSE_NOT_ENROLLED', async () => {
      prismaMock.lesson.findFirst.mockResolvedValue({
        id: 'l-1',
        moduleId: 'mod-1',
        module: {
          id: 'mod-1',
          courseId: 'course-1',
          course: {
            id: 'course-1',
            createdById: trainerA.id,
            isPublished: true,
          },
        },
      } as never);
      coursesServiceMock.isUserEnrolledInCourse.mockResolvedValue(false as never);

      await expect(
        service.findOne('l-1', employeeUser),
      ).rejects.toMatchObject({
        errorCode: 'NOT_ENROLLED',
        status: 403,
      });
    });
  });

  describe('remove()', () => {
    it('nên xóa mềm bài học, dồn lại thứ tự 1..n và trả về referencedQuestionsCount', async () => {
      prismaMock.lesson.findFirst.mockResolvedValue({
        id: 'l-1',
        moduleId: 'mod-1',
        module: {
          id: 'mod-1',
          courseId: 'course-1',
          course: { id: 'course-1', createdById: trainerA.id, isPublished: false },
        },
      } as never);
      prismaMock.question.count.mockResolvedValue(3 as never);
      prismaMock.lesson.update.mockResolvedValue({
        id: 'l-1',
        deletedAt: new Date(),
      } as never);
      prismaMock.lesson.findMany.mockResolvedValue([{ id: 'l-2' }] as never);

      const res = await service.remove('l-1', trainerA);

      expect(res.referencedQuestionsCount).toBe(3);
      expect(prismaMock.lesson.update).toHaveBeenCalledWith({
        where: { id: 'l-2' },
        data: { lessonOrder: 1 },
      });
    });
  });

  describe('reorder()', () => {
    it('nên thực hiện transaction 2 bước (100000+i+1 -> 1..n) khi sắp xếp lại bài học', async () => {
      prismaMock.lesson.findMany.mockResolvedValue([
        { id: 'l-1' },
        { id: 'l-2' },
      ] as never);
      prismaMock.lesson.update.mockImplementation((args: any) =>
        Promise.resolve({ id: args.where.id, lessonOrder: args.data.lessonOrder }),
      );

      const res = await service.reorder(
        'mod-1',
        { orderedIds: ['l-2', 'l-1'] },
        trainerA,
      );

      expect(prismaMock.lesson.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'l-2' },
        data: { lessonOrder: 100_001 },
      });
      expect(prismaMock.lesson.update).toHaveBeenNthCalledWith(3, {
        where: { id: 'l-2' },
        data: { lessonOrder: 1 },
      });
      expect(res).toEqual([
        { id: 'l-2', lessonOrder: 1 },
        { id: 'l-1', lessonOrder: 2 },
      ]);
    });
  });
});

