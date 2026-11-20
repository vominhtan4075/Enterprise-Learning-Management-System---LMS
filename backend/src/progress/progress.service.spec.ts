import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  computeUnlock,
  mergeEngineOutputs,
  type CourseNode,
} from './unlock-engine.js';
import { AccessService } from './access.service.js';
import { ProgressService } from './progress.service.js';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import { PositionLevel, RoleCode } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

describe('WP8 – Progress & Unlock Engine (BR-02 & LP-4)', () => {
  const buildFiveStepPathCourses = (): CourseNode[] => [
    ...[1, 2, 3, 4].map((step) => ({
      id: `course-${step}`,
      title: `Khóa ${step}`,
      stepOrder: step,
      modules: [
        {
          id: `mod-${step}`,
          title: `Học phần ${step}`,
          order: 1,
          lessons: [
            {
              id: `les-${step}-1`,
              title: `Bài ${step}.1`,
              order: 1,
              isRequired: true,
            },
            {
              id: `les-${step}-2`,
              title: `Bài ${step}.2 (Tự chọn)`,
              order: 2,
              isRequired: false,
            },
          ],
          quiz: {
            id: `quiz-${step}`,
            title: `Quiz Học phần ${step}`,
            type: 'MODULE' as const,
            isPublished: true,
          },
        },
      ],
    })),
    {
      id: 'course-final',
      title: 'Kiểm tra tổng hợp',
      stepOrder: 5,
      modules: [
        {
          id: 'mod-final',
          title: 'Học phần Tổng hợp',
          order: 1,
          lessons: [
            {
              id: 'les-final-1',
              title: 'Hướng dẫn quy chế thi cuối khóa',
              order: 1,
              isRequired: true,
            },
          ],
          quiz: {
            id: 'quiz-final',
            title: 'Bài kiểm tra tổng hợp cuối khóa',
            type: 'FINAL' as const,
            isPublished: true,
          },
        },
      ],
    },
  ];

  describe('computeUnlock() – Hàm thuần BR-02 & LP-4', () => {
    it('1. Lộ trình trống tiến độ: chỉ các bài học của Học phần 1 được UNLOCKED, Quiz 1 và các học phần sau đều LOCKED', () => {
      const out = computeUnlock({
        courses: buildFiveStepPathCourses(),
        completedLessonIds: new Set(),
        passedQuizIds: new Set(),
        strictLessonOrder: false,
      });

      expect(out.modules.get('mod-1')).toBe('UNLOCKED');
      expect(out.lessons.get('les-1-1')?.state).toBe('UNLOCKED');
      expect(out.lessons.get('les-1-2')?.state).toBe('UNLOCKED');
      expect(out.quizzes.get('quiz-1')?.state).toBe('LOCKED');
      expect(out.modules.get('mod-2')).toBe('LOCKED');
      expect(out.lessons.get('les-2-1')?.state).toBe('LOCKED');
      expect(out.quizzes.get('quiz-final')?.state).toBe('LOCKED');
    });

    it('2. Hoàn thành bài bắt buộc của Học phần 1 (bài tự chọn chưa học) -> mở khóa Quiz 1, nhưng Học phần 2 vẫn LOCKED', () => {
      const out = computeUnlock({
        courses: buildFiveStepPathCourses(),
        completedLessonIds: new Set(['les-1-1']),
        passedQuizIds: new Set(),
        strictLessonOrder: false,
      });

      expect(out.lessons.get('les-1-1')?.state).toBe('COMPLETED');
      expect(out.quizzes.get('quiz-1')?.state).toBe('UNLOCKED');
      expect(out.modules.get('mod-1')).toBe('UNLOCKED');
      expect(out.modules.get('mod-2')).toBe('LOCKED');
    });

    it('3. Đạt Quiz 1 -> Học phần 1 COMPLETED và mở khóa Học phần 2', () => {
      const out = computeUnlock({
        courses: buildFiveStepPathCourses(),
        completedLessonIds: new Set(['les-1-1']),
        passedQuizIds: new Set(['quiz-1']),
        strictLessonOrder: false,
      });

      expect(out.modules.get('mod-1')).toBe('COMPLETED');
      expect(out.courses.get('course-1')).toBe('COMPLETED');
      expect(out.modules.get('mod-2')).toBe('UNLOCKED');
      expect(out.lessons.get('les-2-1')?.state).toBe('UNLOCKED');
      expect(out.quizzes.get('quiz-2')?.state).toBe('LOCKED');
    });

    it('4. LP-4: Bài kiểm tra FINAL chỉ UNLOCKED khi cả 4 Quiz MODULE đã đạt và bài học bắt buộc của FINAL đã xong', () => {
      const out = computeUnlock({
        courses: buildFiveStepPathCourses(),
        completedLessonIds: new Set([
          'les-1-1',
          'les-2-1',
          'les-3-1',
          'les-4-1',
          'les-final-1',
        ]),
        passedQuizIds: new Set(['quiz-1', 'quiz-2', 'quiz-3', 'quiz-4']),
        strictLessonOrder: false,
      });

      expect(out.modules.get('mod-4')).toBe('COMPLETED');
      expect(out.modules.get('mod-final')).toBe('UNLOCKED');
      expect(out.quizzes.get('quiz-final')?.state).toBe('UNLOCKED');
    });

    it('5. strictLessonOrder=true: Bài học thứ 2 bị LOCKED nếu bài bắt buộc thứ 1 chưa hoàn thành', () => {
      const courses: CourseNode[] = [
        {
          id: 'c-1',
          stepOrder: 1,
          modules: [
            {
              id: 'm-1',
              order: 1,
              lessons: [
                { id: 'l-1', title: 'Bài 1', order: 1, isRequired: true },
                { id: 'l-2', title: 'Bài 2', order: 2, isRequired: true },
              ],
            },
          ],
        },
      ];

      const out = computeUnlock({
        courses,
        completedLessonIds: new Set(),
        passedQuizIds: new Set(),
        strictLessonOrder: true,
      });

      expect(out.lessons.get('l-1')?.state).toBe('UNLOCKED');
      expect(out.lessons.get('l-2')?.state).toBe('LOCKED');
    });

    it('6. mergeEngineOutputs: Một bài học LOCKED trong Lộ trình nhưng UNLOCKED ở Khóa học lẻ được giao riêng thì kết quả gộp là UNLOCKED', () => {
      const pathOut = computeUnlock({
        courses: buildFiveStepPathCourses(),
        completedLessonIds: new Set(),
        passedQuizIds: new Set(),
        strictLessonOrder: false,
      });

      const standaloneCourse2 = computeUnlock({
        courses: [buildFiveStepPathCourses()[1]],
        completedLessonIds: new Set(),
        passedQuizIds: new Set(),
        strictLessonOrder: false,
      });

      const merged = mergeEngineOutputs([pathOut, standaloneCourse2]);
      expect(pathOut.lessons.get('les-2-1')?.state).toBe('LOCKED');
      expect(merged.lessons.get('les-2-1')?.state).toBe('UNLOCKED');
    });

    it('7. Module hoặc Course rỗng phía sau học phần đang LOCKED không được tự động đánh dấu COMPLETED', () => {
      const courses: CourseNode[] = [
        {
          id: 'c-1',
          stepOrder: 1,
          modules: [
            {
              id: 'm-1',
              order: 1,
              lessons: [{ id: 'l-1', order: 1, isRequired: true }],
            },
            {
              id: 'm-2-empty',
              order: 2,
              lessons: [],
            },
          ],
        },
        {
          id: 'c-2-empty',
          stepOrder: 2,
          modules: [],
        },
      ];

      const out = computeUnlock({
        courses,
        completedLessonIds: new Set(),
        passedQuizIds: new Set(),
        strictLessonOrder: false,
      });

      expect(out.modules.get('m-1')).toBe('UNLOCKED');
      expect(out.modules.get('m-2-empty')).toBe('LOCKED');
      expect(out.courses.get('c-2-empty')).toBe('LOCKED');
    });
  });

  describe('AccessService & ProgressService', () => {
    let accessService: AccessService;
    let progressService: ProgressService;
    let prismaMock: any;
    let enrollmentsServiceMock: {
      ensureOnboardingPath: ReturnType<typeof jest.fn>;
      refreshUserEnrollmentsProgress: ReturnType<typeof jest.fn>;
    };

    const employeeUser: AuthenticatedUser = {
      id: 'emp-1',
      email: 'fresher.java@novatech.com',
      fullName: 'Fresher Java',
      role: RoleCode.EMPLOYEE,
      position: PositionLevel.FRESHER,
      department: 'Backend Division',
      mustChangePassword: false,
      tokenVersion: 0,
    };

    beforeEach(() => {
      const asyncMock = <T>(val: T) =>
        jest.fn<(...args: unknown[]) => Promise<T>>().mockResolvedValue(val);

      prismaMock = {
        pathEnrollment: {
          findMany: asyncMock([
            {
              id: 'pe-1',
              userId: employeeUser.id,
              pathId: 'path-1',
              status: 'IN_PROGRESS',
              progressPercentage: 0,
              deadline: new Date('2027-12-31T23:59:59Z'),
              learningPath: {
                id: 'path-1',
                code: 'path-fresher-java',
                title: 'Onboarding Fresher Java',
                pathCourses: [
                  {
                    stepOrder: 1,
                    course: {
                      id: 'c-1',
                      code: 'JAVA_01',
                      title: 'Java 1',
                      isPublished: true,
                      deletedAt: null,
                      modules: [
                        {
                          id: 'mod-1',
                          title: 'Học phần 1',
                          moduleOrder: 1,
                          lessons: [
                            {
                              id: 'les-1',
                              title: 'Bài 1',
                              lessonOrder: 1,
                              isRequired: true,
                            },
                          ],
                          quiz: {
                            id: 'quiz-1',
                            title: 'Quiz 1',
                            quizType: 'MODULE',
                            isPublished: true,
                          },
                        },
                        {
                          id: 'mod-2',
                          title: 'Học phần 2',
                          moduleOrder: 2,
                          lessons: [
                            {
                              id: 'les-2',
                              title: 'Bài 2',
                              lessonOrder: 1,
                              isRequired: true,
                            },
                          ],
                          quiz: {
                            id: 'quiz-2',
                            title: 'Quiz 2',
                            quizType: 'MODULE',
                            isPublished: true,
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            },
          ]),
        },
        courseEnrollment: {
          findMany: asyncMock([]),
        },
        userProgress: {
          findMany: asyncMock([]),
          upsert: asyncMock({
            lessonId: 'les-1',
            isCompleted: true,
            completedAt: new Date(),
          }),
        },
        quizAttempt: {
          findMany: asyncMock([]),
        },
        lesson: {
          findFirst: asyncMock({
            id: 'les-1',
            moduleId: 'mod-1',
            module: {
              id: 'mod-1',
              courseId: 'c-1',
              quiz: { id: 'quiz-1' },
            },
          }),
        },
      };

      const configMock = {
        get: jest.fn().mockReturnValue(false),
      } as unknown as ConfigService;

      accessService = new AccessService(
        prismaMock as unknown as PrismaService,
        configMock,
      );

      enrollmentsServiceMock = {
        ensureOnboardingPath: jest
          .fn()
          .mockResolvedValue({ assigned: false } as never),
        refreshUserEnrollmentsProgress: jest
          .fn()
          .mockResolvedValue(undefined as never),
      };

      progressService = new ProgressService(
        prismaMock as unknown as PrismaService,
        {
          delByPattern: jest.fn().mockResolvedValue(undefined as never),
        } as unknown as RedisService,
        configMock,
        { emit: jest.fn() } as unknown as EventEmitter2,
        accessService,
        enrollmentsServiceMock as unknown as EnrollmentsService,
      );
    });

    it('AccessService: chặn truy cập bài học của Học phần 2 khi chưa xong Học phần 1 -> 422 BR02_LOCK_CONSTRAINT', async () => {
      await expect(
        accessService.assertCanAccessLesson(employeeUser.id, 'les-2'),
      ).rejects.toMatchObject({
        errorCode: 'BR02_LOCK_CONSTRAINT',
        status: 422,
      });
    });

    it('AccessService: chặn truy cập Quiz 1 khi chưa học xong bài bắt buộc les-1 -> 422 BR02_LOCK_CONSTRAINT', async () => {
      await expect(
        accessService.assertCanAccessQuiz(employeeUser.id, 'quiz-1'),
      ).rejects.toMatchObject({
        errorCode: 'BR02_LOCK_CONSTRAINT',
        status: 422,
      });
    });

    it('AccessService: chặn truy cập bài học ngoài lộ trình được giao -> 403 NOT_ENROLLED', async () => {
      await expect(
        accessService.assertCanAccessLesson(employeeUser.id, 'les-999'),
      ).rejects.toMatchObject({
        errorCode: 'NOT_ENROLLED',
        status: 403,
      });
    });

    it('ProgressService: chặn truyền isCompleted=false -> 422 UNPROCESSABLE_ENTITY', async () => {
      await expect(
        progressService.updateLessonProgress(employeeUser, {
          lessonId: 'les-1',
          isCompleted: false,
        }),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
        status: 422,
      });
    });

    it('ProgressService: đánh dấu hoàn thành les-1 thành công và mở khóa quiz-1', async () => {
      // Sau khi upsert, lần đọc lại snapshot trả về les-1 đã hoàn thành
      prismaMock.userProgress.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ lessonId: 'les-1' }]);

      const res = await progressService.updateLessonProgress(employeeUser, {
        lessonId: 'les-1',
        isCompleted: true,
      });

      expect(res.lessonId).toBe('les-1');
      expect(res.isCompleted).toBe(true);
      expect(res.quizUnlocked).toBe(true);
      expect(
        enrollmentsServiceMock.refreshUserEnrollmentsProgress,
      ).toHaveBeenCalledWith(employeeUser.id);
    });
  });
});
