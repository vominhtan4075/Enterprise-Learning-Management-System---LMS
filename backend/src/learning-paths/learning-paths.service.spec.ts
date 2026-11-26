import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { LearningPathsService } from './learning-paths.service.js';
import {
  validatePathStructure,
  type ValidatableLearningPath,
} from './path-structure.validator.js';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import {
  PositionLevel,
  QuizType,
  RoleCode,
} from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

describe('WP6 – LearningPaths & PathStructureValidator', () => {
  const makeValidPath = (): ValidatableLearningPath => ({
    id: 'path-1',
    code: 'path-fresher-java',
    title: 'Lộ trình Onboarding Fresher Java',
    pathCourses: [
      ...[1, 2, 3, 4].map((step) => ({
        stepOrder: step,
        course: {
          id: `c-${step}`,
          code: `JAVA_0${step}`,
          title: `Khóa ${step}`,
          isPublished: true,
          deletedAt: null,
          modules: [
            {
              id: `m-${step}`,
              title: `Học phần ${step}`,
              moduleOrder: 1,
              lessons: [{ id: `l-${step}`, isRequired: true }],
              quiz: {
                id: `q-${step}`,
                quizType: QuizType.MODULE,
                isPublished: true,
              },
            },
          ],
        },
      })),
      {
        stepOrder: 5,
        course: {
          id: 'c-final',
          code: 'FRESHER_FINAL',
          title: 'Kiểm tra tổng hợp',
          isPublished: true,
          deletedAt: null,
          modules: [
            {
              id: 'm-final',
              title: 'Bài kiểm tra tổng hợp cuối khóa',
              moduleOrder: 1,
              lessons: [{ id: 'l-final', isRequired: true }],
              quiz: {
                id: 'q-final',
                quizType: QuizType.FINAL,
                isPublished: true,
              },
            },
          ],
        },
      },
    ],
  });

  describe('PathStructureValidator (LP-1, LP-2, LP-3)', () => {
    it('nên trả về valid=true cho lộ trình 5 khóa học (4 MODULE + 1 FINAL ở cuối)', () => {
      const result = validatePathStructure(makeValidPath());
      expect(result.valid).toBe(true);
      expect(result.unitCount).toBe(5);
      expect(result.hasFinal).toBe(true);
      expect(result.finalIsLast).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('nên cho phép thêm số lượng khóa học tùy ý miễn cuối lộ trình có Quiz đã xuất bản', () => {
      const twoCoursePath = makeValidPath();
      twoCoursePath.pathCourses = twoCoursePath.pathCourses.slice(0, 2);
      const result = validatePathStructure(twoCoursePath);
      expect(result.valid).toBe(true);
      expect(result.unitCount).toBe(2);
      expect(result.hasFinal).toBe(true);
      expect(result.finalIsLast).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('nên bắt lỗi FINAL_MISSING khi học phần cuối cùng không có bài kiểm tra Quiz', () => {
      const path = makeValidPath();
      path.pathCourses[path.pathCourses.length - 1].course.modules[0].quiz =
        null;
      const result = validatePathStructure(path);
      expect(result.valid).toBe(false);
      expect(result.hasFinal).toBe(false);
      expect(result.issues.some((i) => i.code === 'FINAL_MISSING')).toBe(true);
    });

    it('nên đối xử đồng nhất mọi Quiz (không phân biệt MODULE hay FINAL ở vị trí bất kỳ) miễn cuối lộ trình có Quiz đã xuất bản', () => {
      const path = makeValidPath();
      // Đổi stepOrder của khóa cũ (vốn mang nhãn FINAL) lên đầu lộ trình, cuối lộ trình vẫn có Quiz của c-4
      path.pathCourses[4].stepOrder = 0;
      const result = validatePathStructure(path);
      expect(result.valid).toBe(true);
      expect(result.hasFinal).toBe(true);
      expect(result.finalIsLast).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('nên bắt lỗi COURSE_NOT_PUBLISHED, UNIT_WITHOUT_LESSON và UNIT_WITHOUT_QUIZ (khi Quiz cuối chưa publish)', () => {
      const path = makeValidPath();
      path.pathCourses[0].course.isPublished = false;
      path.pathCourses[1].course.modules[0].lessons = [];
      path.pathCourses[1].course.modules[0].quiz = null;
      path.pathCourses[4].course.modules[0].quiz = {
        id: 'q-final',
        quizType: QuizType.FINAL,
        isPublished: false,
      };

      const result = validatePathStructure(path);
      expect(result.valid).toBe(false);
      const codes = result.issues.map((i) => i.code);
      expect(codes).toContain('COURSE_NOT_PUBLISHED');
      expect(codes).toContain('UNIT_WITHOUT_LESSON');
      expect(codes).toContain('UNIT_WITHOUT_QUIZ');
    });
  });

  describe('LearningPathsService', () => {
    let service: LearningPathsService;
    let prismaMock: {
      learningPath: {
        findMany: ReturnType<typeof jest.fn>;
        findFirst: ReturnType<typeof jest.fn>;
        findUnique: ReturnType<typeof jest.fn>;
        create: ReturnType<typeof jest.fn>;
        update: ReturnType<typeof jest.fn>;
      };
      course: {
        findFirst: ReturnType<typeof jest.fn>;
      };
      pathCourse: {
        findUnique: ReturnType<typeof jest.fn>;
        findMany: ReturnType<typeof jest.fn>;
        create: ReturnType<typeof jest.fn>;
        update: ReturnType<typeof jest.fn>;
        updateMany: ReturnType<typeof jest.fn>;
        delete: ReturnType<typeof jest.fn>;
      };
      pathEnrollment: {
        count: ReturnType<typeof jest.fn>;
      };
      $transaction: ReturnType<typeof jest.fn>;
    };
    let redisMock: {
      remember: ReturnType<typeof jest.fn>;
      delByPattern: ReturnType<typeof jest.fn>;
    };
    let configMock: {
      get: ReturnType<typeof jest.fn>;
    };

    const hrUser: AuthenticatedUser = {
      id: 'hr-1',
      email: 'hr@novatech.com',
      fullName: 'HR Specialist',
      role: RoleCode.HR,
      position: PositionLevel.SENIOR,
      department: 'HR',
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
        learningPath: {
          findMany: jest.fn(),
          findFirst: jest.fn().mockResolvedValue({
            id: 'path-1',
            code: 'path-fresher-java',
            archivedAt: null,
            pathCourses: [],
          } as never),
          findUnique: jest.fn().mockResolvedValue(null as never),
          create: jest.fn(),
          update: jest.fn(),
        },
        course: {
          findFirst: jest.fn(),
        },
        pathCourse: {
          findUnique: jest.fn().mockResolvedValue(null as never),
          findMany: jest.fn().mockResolvedValue([] as never),
          create: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn(),
          delete: jest.fn(),
        },
        pathEnrollment: {
          count: jest.fn().mockResolvedValue(0 as never),
        },
        $transaction: jest.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
          cb(prismaMock),
        ),
      };

      redisMock = {
        remember: jest.fn(
          async (_k: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
        ),
        delByPattern: jest.fn().mockResolvedValue(undefined as never),
      };

      configMock = {
        get: jest.fn().mockReturnValue(4),
      };

      service = new LearningPathsService(
        prismaMock as unknown as PrismaService,
        redisMock as unknown as RedisService,
        configMock as unknown as ConfigService,
      );
    });

    it('nên tự sinh mã slug code duy nhất khi tạo lộ trình không truyền code', async () => {
      prismaMock.learningPath.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'path-new', ...args.data }),
      );

      const res = await service.create(
        {
          title: 'Lộ trình Onboarding Fresher Java',
          targetPosition: PositionLevel.FRESHER,
        },
        hrUser,
      );

      expect(res.code).toMatch(/^path-fresher-/);
      expect(redisMock.delByPattern).toHaveBeenCalledWith('lms:paths:list*');
    });

    it('nên chặn thêm/xóa/sắp xếp khóa học với lỗi 422 PATH_IN_USE khi lộ trình đã có học viên (LP-6)', async () => {
      prismaMock.pathEnrollment.count.mockResolvedValue(5 as never);

      await expect(
        service.addCourse('path-1', { courseId: 'c-1' }, hrUser),
      ).rejects.toMatchObject({
        errorCode: 'PATH_IN_USE',
        status: 422,
      });
    });

    it('nên chặn thêm khóa học chưa xuất bản vào lộ trình -> 422 UNPROCESSABLE_ENTITY', async () => {
      prismaMock.course.findFirst.mockResolvedValue({
        id: 'c-draft',
        code: 'DRAFT_01',
        title: 'Khóa học nháp',
        isPublished: false,
      } as never);

      await expect(
        service.addCourse('path-1', { courseId: 'c-draft' }, hrUser),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
        status: 422,
      });
    });

    it('nên dồn stepOrder các khóa học phía sau lên +1 khi chèn khóa học vào giữa lộ trình', async () => {
      prismaMock.course.findFirst.mockResolvedValue({
        id: 'c-new',
        code: 'JAVA_02',
        title: 'Java 2',
        isPublished: true,
      } as never);
      prismaMock.pathCourse.findMany.mockResolvedValue([
        { id: 'pc-1', stepOrder: 1 },
        { id: 'pc-2', stepOrder: 2 },
      ] as never);
      prismaMock.pathCourse.create.mockImplementation((args: any) =>
        Promise.resolve({ id: 'pc-new', ...args.data }),
      );

      const res = await service.addCourse(
        'path-1',
        { courseId: 'c-new', stepOrder: 2 },
        hrUser,
      );

      expect(prismaMock.pathCourse.updateMany).toHaveBeenCalledWith({
        where: {
          pathId: 'path-1',
          stepOrder: { gte: 2 },
        },
        data: { stepOrder: { increment: 1 } },
      });
      expect(res.stepOrder).toBe(2);
    });

    it('EMPLOYEE xem lộ trình chưa được giao -> 404 NOT_FOUND', async () => {
      prismaMock.pathEnrollment.count.mockResolvedValue(0 as never);

      await expect(
        service.findOne('path-fresher-java', employeeUser),
      ).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
        status: 404,
      });
    });

    it('HR bị chặn xóa lộ trình đang có nhân viên IN_PROGRESS (422), còn ADMIN có toàn quyền thêm khóa học và lưu trữ lộ trình', async () => {
      prismaMock.pathEnrollment.count.mockResolvedValue(3 as never);

      await expect(service.remove('path-1', hrUser)).rejects.toMatchObject({
        errorCode: 'PATH_IN_USE',
        status: 422,
      });

      const adminUser: AuthenticatedUser = {
        ...hrUser,
        id: 'admin-1',
        role: RoleCode.ADMIN,
      };
      prismaMock.learningPath.update.mockResolvedValue({
        id: 'path-1',
        archivedAt: new Date(),
      } as never);

      const archived = await service.remove('path-1', adminUser);
      expect(archived.archivedAt).toBeDefined();
    });
  });
});
