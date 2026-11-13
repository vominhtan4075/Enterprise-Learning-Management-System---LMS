import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ModulesService } from './modules.service.js';
import { PrismaService } from '../prisma.service.js';
import { CoursesService } from '../courses/courses.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import { HttpStatus } from '@nestjs/common';
import { PositionLevel, RoleCode } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

describe('ModulesService (WP5 – 5.2 Module)', () => {
  let service: ModulesService;
  let prismaMock: {
    module: {
      findMany: ReturnType<typeof jest.fn>;
      findFirst: ReturnType<typeof jest.fn>;
      create: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
      updateMany: ReturnType<typeof jest.fn>;
    };
    quizAttempt: {
      count: ReturnType<typeof jest.fn>;
    };
    userProgress: {
      count: ReturnType<typeof jest.fn>;
    };
    $transaction: ReturnType<typeof jest.fn>;
  };
  let coursesServiceMock: {
    assertOwnershipByCourseId: ReturnType<typeof jest.fn>;
    assertOwnership: ReturnType<typeof jest.fn>;
    invalidateCourseCaches: ReturnType<typeof jest.fn>;
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

  const trainerB: AuthenticatedUser = {
    id: 'trainer-b',
    email: 'trainer.b@novatech.com',
    fullName: 'Trainer B',
    role: RoleCode.TRAINER,
    position: PositionLevel.SENIOR,
    department: 'Training',
    mustChangePassword: false,
    tokenVersion: 0,
  };

  beforeEach(() => {
    prismaMock = {
      module: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      quizAttempt: {
        count: jest.fn().mockResolvedValue(0 as never),
      },
      userProgress: {
        count: jest.fn().mockResolvedValue(0 as never),
      },
      $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
        cb(prismaMock),
      ),
    };

    coursesServiceMock = {
      assertOwnershipByCourseId: jest.fn().mockResolvedValue({
        id: 'course-1',
        createdById: trainerA.id,
      } as never),
      assertOwnership: jest.fn((course: { createdById: string | null }, actor: AuthenticatedUser) => {
        if (actor.role !== RoleCode.ADMIN && course.createdById !== actor.id) {
          throw new BusinessException(
            ErrorCode.AUTH_FORBIDDEN,
            'Không có quyền chỉnh sửa khóa học của giảng viên khác.',
            HttpStatus.FORBIDDEN,
          );
        }
      }),
      invalidateCourseCaches: jest.fn().mockResolvedValue(undefined as never),
    };

    service = new ModulesService(
      prismaMock as unknown as PrismaService,
      coursesServiceMock as unknown as CoursesService,
    );
  });

  describe('create()', () => {
    it('nên tự động xếp module mới vào cuối khóa học (maxOrder + 1) nếu không truyền moduleOrder', async () => {
      prismaMock.module.findMany.mockResolvedValue([
        { id: 'm-1', moduleOrder: 1 },
        { id: 'm-2', moduleOrder: 2 },
      ] as never);
      prismaMock.module.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'm-3', ...args.data }),
      );

      const res = await service.create(
        'course-1',
        { title: 'Học phần 3: Spring Boot', dayStart: 8, dayEnd: 14 },
        trainerA,
      );

      expect(prismaMock.module.updateMany).not.toHaveBeenCalled();
      expect(res.moduleOrder).toBe(3);
      expect(coursesServiceMock.invalidateCourseCaches).toHaveBeenCalledWith('course-1');
    });

    it('nên dồn các module phía sau lên +1 khi chèn vào giữa (moduleOrder <= maxOrder)', async () => {
      prismaMock.module.findMany.mockResolvedValue([
        { id: 'm-1', moduleOrder: 1 },
        { id: 'm-2', moduleOrder: 2 },
      ] as never);
      prismaMock.module.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'm-inserted', ...args.data }),
      );

      const res = await service.create(
        'course-1',
        { title: 'Học phần chèn giữa', moduleOrder: 2 },
        trainerA,
      );

      expect(prismaMock.module.updateMany).toHaveBeenCalledWith({
        where: {
          courseId: 'course-1',
          deletedAt: null,
          moduleOrder: { gte: 2 },
        },
        data: { moduleOrder: { increment: 1 } },
      });
      expect(res.moduleOrder).toBe(2);
    });

    it('nên trả về 400 BAD_REQUEST khi dayEnd < dayStart', async () => {
      await expect(
        service.create(
          'course-1',
          { title: 'Học phần lỗi ngày', dayStart: 10, dayEnd: 5 },
          trainerA,
        ),
      ).rejects.toMatchObject({
        errorCode: 'BAD_REQUEST',
        status: 400,
      });
    });
  });

  describe('update() & Ownership', () => {
    it('Trainer B sửa module thuộc khóa học của Trainer A -> 403 AUTH_FORBIDDEN', async () => {
      prismaMock.module.findFirst.mockResolvedValue({
        id: 'm-1',
        courseId: 'course-1',
        dayStart: 1,
        dayEnd: 7,
        course: { id: 'course-1', createdById: trainerA.id },
      } as never);

      await expect(
        service.update('m-1', { title: 'Hacked Module' }, trainerB),
      ).rejects.toMatchObject({
        errorCode: 'AUTH_FORBIDDEN',
        status: 403,
      });
    });
  });

  describe('remove()', () => {
    it('chặn xóa module khi đã có lượt làm bài Quiz hoặc có tiến độ hoàn thành bài học -> 422 UNPROCESSABLE_ENTITY', async () => {
      prismaMock.module.findFirst.mockResolvedValue({
        id: 'm-1',
        courseId: 'course-1',
        course: { id: 'course-1', createdById: trainerA.id },
      } as never);
      prismaMock.quizAttempt.count.mockResolvedValue(2 as never);

      await expect(service.remove('m-1', trainerA)).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
        status: 422,
      });
    });

    it('nên xóa mềm module và dồn lại moduleOrder liên tục 1..n cho các module còn lại', async () => {
      prismaMock.module.findFirst.mockResolvedValue({
        id: 'm-2',
        courseId: 'course-1',
        course: { id: 'course-1', createdById: trainerA.id },
      } as never);
      prismaMock.module.update.mockResolvedValue({ id: 'm-2', deletedAt: new Date() } as never);
      prismaMock.module.findMany.mockResolvedValue([
        { id: 'm-1' },
        { id: 'm-3' },
      ] as never);

      await service.remove('m-2', trainerA);

      expect(prismaMock.module.update).toHaveBeenCalledWith({
        where: { id: 'm-1' },
        data: { moduleOrder: 1 },
      });
      expect(prismaMock.module.update).toHaveBeenCalledWith({
        where: { id: 'm-3' },
        data: { moduleOrder: 2 },
      });
    });
  });

  describe('reorder()', () => {
    it('nên trả về 400 BAD_REQUEST khi danh sách orderedIds không khớp với tập module của khóa học', async () => {
      prismaMock.module.findMany.mockResolvedValue([
        { id: 'm-1' },
        { id: 'm-2' },
      ] as never);

      await expect(
        service.reorder('course-1', { orderedIds: ['m-1', 'm-999'] }, trainerA),
      ).rejects.toMatchObject({
        errorCode: 'BAD_REQUEST',
        status: 400,
      });
    });

    it('nên thực hiện transaction 2 bước (đẩy sang 100000+i+1 rồi gán lại 1..n)', async () => {
      prismaMock.module.findMany.mockResolvedValue([
        { id: 'm-1' },
        { id: 'm-2' },
      ] as never);
      prismaMock.module.update.mockImplementation((args: any) =>
        Promise.resolve({ id: args.where.id, moduleOrder: args.data.moduleOrder }),
      );

      const res = await service.reorder(
        'course-1',
        { orderedIds: ['m-2', 'm-1'] },
        trainerA,
      );

      expect(prismaMock.module.update).toHaveBeenNthCalledWith(1, {
        where: { id: 'm-2' },
        data: { moduleOrder: 100_001 },
      });
      expect(prismaMock.module.update).toHaveBeenNthCalledWith(2, {
        where: { id: 'm-1' },
        data: { moduleOrder: 100_002 },
      });
      expect(prismaMock.module.update).toHaveBeenNthCalledWith(3, {
        where: { id: 'm-2' },
        data: { moduleOrder: 1 },
      });
      expect(prismaMock.module.update).toHaveBeenNthCalledWith(4, {
        where: { id: 'm-1' },
        data: { moduleOrder: 2 },
      });
      expect(res).toEqual([
        { id: 'm-2', moduleOrder: 1 },
        { id: 'm-1', moduleOrder: 2 },
      ]);
    });
  });
});

