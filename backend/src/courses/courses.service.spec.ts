import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { CoursesService } from './courses.service.js';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { PositionLevel, RoleCode } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

describe('CoursesService (WP5 – 5.1 Course)', () => {
  let service: CoursesService;
  let prismaMock: {
    course: {
      findUnique: ReturnType<typeof jest.fn>;
      findFirst: ReturnType<typeof jest.fn>;
      findMany: ReturnType<typeof jest.fn>;
      count: ReturnType<typeof jest.fn>;
      create: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
    };
    module: {
      count: ReturnType<typeof jest.fn>;
    };
    lesson: {
      count: ReturnType<typeof jest.fn>;
    };
    courseEnrollment: {
      count: ReturnType<typeof jest.fn>;
    };
    pathEnrollment: {
      count: ReturnType<typeof jest.fn>;
    };
    pathCourse: {
      findMany: ReturnType<typeof jest.fn>;
    };
  };
  let redisMock: {
    remember: ReturnType<typeof jest.fn>;
    del: ReturnType<typeof jest.fn>;
    delByPattern: ReturnType<typeof jest.fn>;
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
      course: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      module: {
        count: jest.fn(),
      },
      lesson: {
        count: jest.fn(),
      },
      courseEnrollment: {
        count: jest.fn().mockResolvedValue(0 as never),
      },
      pathEnrollment: {
        count: jest.fn().mockResolvedValue(0 as never),
      },
      pathCourse: {
        findMany: jest.fn().mockResolvedValue([] as never),
      },
    };

    redisMock = {
      remember: jest.fn(async (_k: string, _ttl: number, fn: () => Promise<unknown>) => fn()),
      del: jest.fn().mockResolvedValue(undefined as never),
      delByPattern: jest.fn().mockResolvedValue(undefined as never),
    };

    service = new CoursesService(
      prismaMock as unknown as PrismaService,
      redisMock as unknown as RedisService,
    );
  });

  describe('create()', () => {
    it('nên trả về 409 CONFLICT khi mã khóa học (code) đã tồn tại', async () => {
      prismaMock.course.findUnique.mockResolvedValue({ id: 'c-existing' } as never);

      await expect(
        service.create(
          { code: 'JAVA_01', title: 'Java Core' },
          trainerA,
        ),
      ).rejects.toMatchObject({
        errorCode: 'CONFLICT',
        status: 409,
      });
    });

    it('nên tạo khóa học mới với isPublished=false và createdById = actor.id', async () => {
      prismaMock.course.findUnique.mockResolvedValue(null as never);
      prismaMock.course.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'c-new', ...args.data }),
      );

      const res = await service.create(
        { code: 'java_01', title: 'Java Core', estimatedHours: 16 },
        trainerA,
      );

      expect(res.code).toBe('JAVA_01');
      expect(res.isPublished).toBe(false);
      expect(res.createdById).toBe(trainerA.id);
      expect(redisMock.delByPattern).toHaveBeenCalledWith('lms:courses:list:*');
    });
  });

  describe('Ownership & update()', () => {
    it('Trainer B sửa khóa học của Trainer A -> 403 AUTH_FORBIDDEN', async () => {
      prismaMock.course.findFirst.mockResolvedValue({
        id: 'c-1',
        code: 'JAVA_01',
        createdById: trainerA.id,
      } as never);

      await expect(
        service.update('c-1', { title: 'Hacked Title' }, trainerB),
      ).rejects.toMatchObject({
        errorCode: 'AUTH_FORBIDDEN',
        status: 403,
      });
    });

    it('chặn đổi mã code khi khóa học đã được giao cho học viên -> 422', async () => {
      prismaMock.course.findFirst.mockResolvedValue({
        id: 'c-1',
        code: 'JAVA_01',
        createdById: trainerA.id,
      } as never);
      prismaMock.courseEnrollment.count.mockResolvedValue(3 as never);

      await expect(
        service.update('c-1', { code: 'JAVA_02' }, trainerA),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
        status: 422,
      });
    });
  });

  describe('publish()', () => {
    it('chặn xuất bản khóa học chưa có đủ >= 1 module và >= 1 lesson -> 422', async () => {
      prismaMock.course.findFirst.mockResolvedValue({
        id: 'c-1',
        createdById: trainerA.id,
      } as never);
      prismaMock.module.count.mockResolvedValue(1 as never);
      prismaMock.lesson.count.mockResolvedValue(0 as never);

      await expect(
        service.publish('c-1', { isPublished: true }, trainerA),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
        status: 422,
      });
    });

    it('chặn hủy xuất bản khi khóa học đang được giao -> 422', async () => {
      prismaMock.course.findFirst.mockResolvedValue({
        id: 'c-1',
        createdById: trainerA.id,
      } as never);
      prismaMock.pathEnrollment.count.mockResolvedValue(2 as never);

      await expect(
        service.publish('c-1', { isPublished: false }, trainerA),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
        status: 422,
      });
    });
  });

  describe('findOne() cho EMPLOYEE', () => {
    it('EMPLOYEE xem khóa học chưa được giao -> 404 NOT_FOUND', async () => {
      prismaMock.course.findFirst.mockResolvedValue({
        id: 'c-1',
        isPublished: true,
        modules: [],
      } as never);
      prismaMock.courseEnrollment.count.mockResolvedValue(0 as never);
      prismaMock.pathEnrollment.count.mockResolvedValue(0 as never);

      await expect(
        service.findOne('c-1', employeeUser),
      ).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
        status: 404,
      });
    });

    it('EMPLOYEE xem khóa học đã được giao -> ẩn contentUrl và contentText trong cây bài học', async () => {
      prismaMock.course.findFirst.mockResolvedValue({
        id: 'c-1',
        isPublished: true,
        modules: [
          {
            id: 'm-1',
            title: 'Module 1',
            lessons: [
              {
                id: 'l-1',
                title: 'Lesson 1',
                contentUrl: 'https://secret-video-url',
                contentText: 'Secret markdown content',
              },
            ],
          },
        ],
      } as never);
      prismaMock.courseEnrollment.count.mockResolvedValue(1 as never);

      const res = await service.findOne('c-1', employeeUser);
      const lesson = res.modules[0].lessons[0] as Record<string, unknown>;
      expect(lesson.id).toBe('l-1');
      expect('contentUrl' in lesson).toBe(false);
      expect('contentText' in lesson).toBe(false);
    });
  });

  describe('remove()', () => {
    it('chặn xóa khóa học đang nằm trong LearningPath hoặc có học viên IN_PROGRESS -> 422 kèm details', async () => {
      prismaMock.course.findFirst.mockResolvedValue({
        id: 'c-1',
        createdById: trainerA.id,
      } as never);
      prismaMock.pathCourse.findMany.mockResolvedValue([
        {
          learningPath: {
            id: 'path-fresher-java',
            code: 'path-fresher-java',
            title: 'Onboarding Fresher Java',
          },
        },
      ] as never);

      await expect(service.remove('c-1', trainerA)).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
        status: 422,
      });
    });
  });
});

