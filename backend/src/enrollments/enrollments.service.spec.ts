import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EnrollmentsService } from './enrollments.service.js';
import {
  computeEffectiveStatus,
  normalizeAndValidateDeadline,
} from './enrollment.helpers.js';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { LearningPathsService } from '../learning-paths/learning-paths.service.js';
import {
  EnrollmentStatus,
  PositionLevel,
  RoleCode,
} from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

describe('WP7 – EnrollmentsService & Helpers', () => {
  describe('enrollment.helpers', () => {
    it('computeEffectiveStatus: COMPLETED luôn giữ nguyên, IN_PROGRESS quá hạn chuyển thành OVERDUE', () => {
      const now = new Date('2026-11-16T12:00:00Z');
      const past = new Date('2026-11-10T12:00:00Z');
      const future = new Date('2026-11-30T12:00:00Z');

      expect(
        computeEffectiveStatus(EnrollmentStatus.COMPLETED, past, now),
      ).toBe(EnrollmentStatus.COMPLETED);
      expect(
        computeEffectiveStatus(EnrollmentStatus.IN_PROGRESS, past, now),
      ).toBe(EnrollmentStatus.OVERDUE);
      expect(
        computeEffectiveStatus(EnrollmentStatus.IN_PROGRESS, future, now),
      ).toBe(EnrollmentStatus.IN_PROGRESS);
    });

    it('normalizeAndValidateDeadline: chặn deadline trong quá khứ -> 400 BAD_REQUEST', () => {
      const now = new Date('2026-11-16T12:00:00Z');
      expect(() =>
        normalizeAndValidateDeadline('2026-01-01T00:00:00Z', now),
      ).toThrow();
    });
  });

  describe('EnrollmentsService', () => {
    let service: EnrollmentsService;
    let prismaMock: {
      user: {
        findMany: ReturnType<typeof jest.fn>;
        findFirst: ReturnType<typeof jest.fn>;
      };
      course: {
        findFirst: ReturnType<typeof jest.fn>;
      };
      courseEnrollment: {
        findMany: ReturnType<typeof jest.fn>;
        findUnique: ReturnType<typeof jest.fn>;
        createMany: ReturnType<typeof jest.fn>;
        update: ReturnType<typeof jest.fn>;
        delete: ReturnType<typeof jest.fn>;
      };
      pathEnrollment: {
        findMany: ReturnType<typeof jest.fn>;
        findUnique: ReturnType<typeof jest.fn>;
        count: ReturnType<typeof jest.fn>;
        create: ReturnType<typeof jest.fn>;
        createMany: ReturnType<typeof jest.fn>;
        update: ReturnType<typeof jest.fn>;
        delete: ReturnType<typeof jest.fn>;
      };
      learningPath: {
        findFirst: ReturnType<typeof jest.fn>;
      };
      userProgress: {
        findMany: ReturnType<typeof jest.fn>;
      };
      quizAttempt: {
        findMany: ReturnType<typeof jest.fn>;
      };
      notification: {
        createMany: ReturnType<typeof jest.fn>;
        deleteMany: ReturnType<typeof jest.fn>;
      };
      $transaction: ReturnType<typeof jest.fn>;
    };
    let redisMock: {
      delByPattern: ReturnType<typeof jest.fn>;
    };
    let eventEmitterMock: {
      emit: ReturnType<typeof jest.fn>;
    };
    let learningPathsServiceMock: {
      getOrderedStructure: ReturnType<typeof jest.fn>;
      validateStructure: ReturnType<typeof jest.fn>;
    };

    const hrUser: AuthenticatedUser = {
      id: 'hr-1',
      email: 'hr@novatech.com',
      fullName: 'HR User',
      role: RoleCode.HR,
      position: PositionLevel.SENIOR,
      department: 'HR',
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

    const futureDeadline = '2027-12-31T23:59:59.000Z';

    beforeEach(() => {
      prismaMock = {
        user: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'emp-1', email: 'emp1@novatech.com', fullName: 'Emp 1' },
          ] as never),
          findFirst: jest.fn(),
        },
        course: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'course-1',
            code: 'JAVA_01',
            title: 'Java Core',
            isPublished: true,
            modules: [
              {
                id: 'mod-1',
                lessons: [{ id: 'les-1' }],
                quiz: { id: 'quiz-1', isPublished: true },
              },
            ],
          } as never),
        },
        courseEnrollment: {
          findMany: jest.fn().mockResolvedValue([] as never),
          findUnique: jest.fn(),
          createMany: jest.fn().mockResolvedValue({ count: 1 } as never),
          update: jest.fn(),
          delete: jest.fn(),
        },
        pathEnrollment: {
          findMany: jest.fn().mockResolvedValue([] as never),
          findUnique: jest.fn(),
          count: jest.fn().mockResolvedValue(0 as never),
          create: jest.fn(),
          createMany: jest.fn().mockResolvedValue({ count: 1 } as never),
          update: jest.fn(),
          delete: jest.fn(),
        },
        learningPath: {
          findFirst: jest.fn(),
        },
        userProgress: {
          findMany: jest.fn().mockResolvedValue([] as never),
        },
        quizAttempt: {
          findMany: jest.fn().mockResolvedValue([] as never),
        },
        notification: {
          createMany: jest.fn().mockResolvedValue({ count: 1 } as never),
          deleteMany: jest.fn().mockResolvedValue({ count: 0 } as never),
        },
        $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
          cb(prismaMock),
        ),
      };

      redisMock = {
        delByPattern: jest.fn().mockResolvedValue(undefined as never),
      };

      eventEmitterMock = {
        emit: jest.fn(),
      };

      learningPathsServiceMock = {
        getOrderedStructure: jest.fn().mockResolvedValue({
          id: 'path-1',
          code: 'path-fresher-java',
          title: 'Onboarding Fresher Java',
          pathCourses: [],
        } as never),
        validateStructure: jest.fn().mockResolvedValue({
          valid: true,
          issues: [],
        } as never),
      };

      service = new EnrollmentsService(
        prismaMock as unknown as PrismaService,
        redisMock as unknown as RedisService,
        { get: jest.fn() } as unknown as ConfigService,
        eventEmitterMock as unknown as EventEmitter2,
        learningPathsServiceMock as unknown as LearningPathsService,
      );
    });

    it('nên giao khóa học cho 1 user (201), tạo thông báo ENROLLMENT_ASSIGNED và phát EnrollmentCreatedEvent', async () => {
      const res = await service.assign(
        {
          userId: 'emp-1',
          courseId: 'course-1',
          deadline: futureDeadline,
        },
        hrUser,
      );

      expect(res.createdCount).toBe(1);
      expect(res.skippedCount).toBe(0);
      expect(res.enrollmentId).toBeDefined();
      expect(prismaMock.courseEnrollment.createMany).toHaveBeenCalled();
      expect(prismaMock.notification.createMany).toHaveBeenCalled();
      expect(eventEmitterMock.emit).toHaveBeenCalled();
    });

    it('nên trả về 409 CONFLICT khi giao đơn lẻ (userId) cho nhân viên đã có enrollment', async () => {
      prismaMock.courseEnrollment.findMany.mockResolvedValue([
        { userId: 'emp-1' },
      ] as never);

      await expect(
        service.assign(
          {
            userId: 'emp-1',
            courseId: 'course-1',
            deadline: futureDeadline,
          },
          hrUser,
        ),
      ).rejects.toMatchObject({
        errorCode: 'CONFLICT',
        status: 409,
      });
    });

    it('nên bỏ qua người đã có enrollment và ghi vào skipped[] khi giao hàng loạt theo phòng ban', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'emp-1', email: 'e1@novatech.com', fullName: 'E1' },
        { id: 'emp-2', email: 'e2@novatech.com', fullName: 'E2' },
      ] as never);
      prismaMock.courseEnrollment.findMany.mockResolvedValue([
        { userId: 'emp-1' },
      ] as never);

      const res = await service.assign(
        {
          department: 'Backend Division',
          courseId: 'course-1',
          deadline: futureDeadline,
        },
        hrUser,
      );

      expect(res.matched).toBe(2);
      expect(res.createdCount).toBe(1);
      expect(res.skippedCount).toBe(1);
      expect(res.skipped).toEqual([
        { userId: 'emp-1', reason: 'ALREADY_ENROLLED' },
      ]);
    });

    it('nên chặn giao lộ trình có cấu trúc không hợp lệ -> 422 PATH_STRUCTURE_INVALID', async () => {
      learningPathsServiceMock.validateStructure.mockResolvedValue({
        valid: false,
        issues: [{ code: 'FINAL_MISSING', message: 'Thiếu bài FINAL' }],
      } as never);

      await expect(
        service.assignPath(
          {
            pathId: 'path-fresher-java',
            targetPosition: PositionLevel.FRESHER,
            deadline: futureDeadline,
          },
          hrUser,
        ),
      ).rejects.toMatchObject({
        errorCode: 'PATH_STRUCTURE_INVALID',
        status: 422,
      });
    });

    it('Trainer không được phép giao Lộ trình (assignPath) -> 403 AUTH_FORBIDDEN', async () => {
      await expect(
        service.assignPath(
          {
            pathId: 'path-fresher-java',
            targetPosition: PositionLevel.FRESHER,
            deadline: futureDeadline,
          },
          trainerB,
        ),
      ).rejects.toMatchObject({
        errorCode: 'AUTH_FORBIDDEN',
        status: 403,
      });
    });

    it('Trainer B không được phép xem hoặc sửa deadline của enrollment do người khác giao -> 404 NOT_FOUND', async () => {
      prismaMock.courseEnrollment.findUnique.mockResolvedValue({
        id: 'enr-1',
        userId: 'emp-1',
        assignedById: 'hr-1',
        status: EnrollmentStatus.IN_PROGRESS,
        deadline: new Date(futureDeadline),
        progressPercentage: 0,
      } as never);

      await expect(
        service.updateDeadline(
          'enr-1',
          { deadline: futureDeadline },
          trainerB,
        ),
      ).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
        status: 404,
      });
    });
  });
});
