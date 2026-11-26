import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import {
  computeUnlock,
  mergeEngineOutputs,
  type CourseNode,
  type EngineOutput,
  type UnlockState,
} from './unlock-engine.js';

@Injectable()
export class AccessService {
  private readonly strictLessonOrder: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.strictLessonOrder =
      this.configService.get<boolean>('STRICT_LESSON_ORDER') ?? false;
  }

  /**
   * Nạp toàn bộ ngữ cảnh ghi danh (PathEnrollment + CourseEnrollment) và tiến độ của userId,
   * sau đó chạy Unlock Engine (computeUnlock) và gộp kết quả theo quy tắc mục 3.4.
   */
  async getUserUnlockSnapshot(userId: string): Promise<{
    merged: EngineOutput;
    completedLessonIds: Set<string>;
    passedQuizIds: Set<string>;
  }> {
    const [pathEnrollments, courseEnrollments, completedLessons, passedQuizzes] =
      await Promise.all([
        this.prisma.pathEnrollment.findMany({
          where: { userId, learningPath: { archivedAt: null } },
          include: {
            learningPath: {
              include: {
                pathCourses: {
                  orderBy: { stepOrder: 'asc' },
                  include: {
                    course: {
                      include: {
                        modules: {
                          where: { deletedAt: null },
                          orderBy: { moduleOrder: 'asc' },
                          include: {
                            lessons: {
                              where: { deletedAt: null },
                              orderBy: { lessonOrder: 'asc' },
                              select: {
                                id: true,
                                title: true,
                                lessonOrder: true,
                                isRequired: true,
                              },
                            },
                            quiz: {
                              select: {
                                id: true,
                                title: true,
                                quizType: true,
                                isPublished: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.courseEnrollment.findMany({
          where: {
            userId,
            course: { deletedAt: null, isPublished: true },
          },
          include: {
            course: {
              include: {
                modules: {
                  where: { deletedAt: null },
                  orderBy: { moduleOrder: 'asc' },
                  include: {
                    lessons: {
                      where: { deletedAt: null },
                      orderBy: { lessonOrder: 'asc' },
                      select: {
                        id: true,
                        title: true,
                        lessonOrder: true,
                        isRequired: true,
                      },
                    },
                    quiz: {
                      select: {
                        id: true,
                        title: true,
                        quizType: true,
                        isPublished: true,
                      },
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.userProgress.findMany({
          where: { userId, isCompleted: true },
          select: { lessonId: true },
        }),
        this.prisma.quizAttempt.findMany({
          where: { userId, isPassed: true },
          select: { quizId: true },
        }),
      ]);

    const completedLessonIds = new Set(completedLessons.map((l) => l.lessonId));
    const passedQuizIds = new Set(passedQuizzes.map((q) => q.quizId));

    const outputs: EngineOutput[] = [];
    const pathCourseIds = new Set<string>();

    for (const pe of pathEnrollments) {
      const activePathCourses = pe.learningPath.pathCourses.filter(
        (pc) => !pc.course.deletedAt && pc.course.isPublished,
      );
      for (const pc of activePathCourses) {
        pathCourseIds.add(pc.course.id);
      }

      const courseNodes: CourseNode[] = activePathCourses.map((pc) =>
        this.mapCourseToNode(pc.course, pc.stepOrder),
      );

      outputs.push(
        computeUnlock({
          courses: courseNodes,
          completedLessonIds,
          passedQuizIds,
          strictLessonOrder: this.strictLessonOrder,
        }),
      );
    }

    // Nếu khóa học đã nằm trong Lộ trình của học viên thì bắt buộc tuân theo thứ tự mở khóa tuần tự của Lộ trình (không cho CourseEnrollment mở khóa vượt cấp)
    for (const ce of courseEnrollments) {
      if (pathCourseIds.has(ce.courseId)) {
        continue;
      }
      const courseNode = this.mapCourseToNode(ce.course, 1);
      outputs.push(
        computeUnlock({
          courses: [courseNode],
          completedLessonIds,
          passedQuizIds,
          strictLessonOrder: this.strictLessonOrder,
        }),
      );
    }

    return {
      merged: mergeEngineOutputs(outputs),
      completedLessonIds,
      passedQuizIds,
    };
  }

  /**
   * Kiểm tra quyền truy cập & trạng thái mở khóa BR-02 của một bài học đối với học viên (WP8 8.2):
   * - Chưa được giao -> 403 NOT_ENROLLED
   * - Đang bị khóa -> 422 BR02_LOCK_CONSTRAINT
   */
  async assertCanAccessLesson(
    userId: string,
    lessonId: string,
  ): Promise<{ state: UnlockState; isCompleted: boolean }> {
    const { merged } = await this.getUserUnlockSnapshot(userId);
    const info = merged.lessons.get(lessonId);

    if (!info) {
      throw new BusinessException(
        ErrorCode.NOT_ENROLLED,
        'Bạn chưa được ghi danh vào khóa học hoặc lộ trình chứa bài học này.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (info.state === 'LOCKED') {
      throw new BusinessException(
        ErrorCode.BR02_LOCK_CONSTRAINT,
        info.lockedReason ??
          'Bài học này đang bị khóa theo quy tắc học tuần tự (BR-02).',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return {
      state: info.state,
      isCompleted: info.state === 'COMPLETED',
    };
  }

  /**
   * Kiểm tra quyền truy cập & trạng thái mở khóa BR-02 / LP-4 của một bài Quiz đối với học viên (WP8 8.2 & WP9 9.3):
   * - Chưa được giao -> 403 NOT_ENROLLED
   * - Đang bị khóa -> 422 BR02_LOCK_CONSTRAINT
   */
  async assertCanAccessQuiz(
    userId: string,
    quizId: string,
  ): Promise<{ state: UnlockState; isPassed: boolean }> {
    const { merged } = await this.getUserUnlockSnapshot(userId);
    const info = merged.quizzes.get(quizId);

    if (!info) {
      throw new BusinessException(
        ErrorCode.NOT_ENROLLED,
        'Bạn chưa được ghi danh vào khóa học hoặc lộ trình chứa bài kiểm tra này.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (info.state === 'LOCKED') {
      throw new BusinessException(
        ErrorCode.BR02_LOCK_CONSTRAINT,
        info.lockedReason ??
          'Bài kiểm tra này đang bị khóa theo quy tắc học tuần tự (BR-02).',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return {
      state: info.state,
      isPassed: info.state === 'COMPLETED',
    };
  }

  /**
   * WP9 9.5 Helper cho BR-03: Lấy bài học đầu tiên của một học phần khi câu hỏi có relatedLessonId = null
   */
  async getFirstLessonOfModule(moduleId: string) {
    return this.prisma.lesson.findFirst({
      where: { moduleId, deletedAt: null },
      orderBy: { lessonOrder: 'asc' },
      select: {
        id: true,
        title: true,
        contentType: true,
        lessonOrder: true,
        moduleId: true,
      },
    });
  }

  /**
   * WP9 9.5 Helper cho BR-03: Lấy thông tin Học phần và Khóa học của một Quiz
   */
  async getModuleOfQuiz(quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            moduleOrder: true,
            courseId: true,
          },
        },
      },
    });
    return quiz?.module ?? null;
  }

  mapCourseToNode(course: any, stepOrder: number): CourseNode {
    return {
      id: course.id,
      title: course.title,
      stepOrder,
      modules: (course.modules ?? []).map((mod: any) => ({
        id: mod.id,
        title: mod.title,
        order: mod.moduleOrder,
        lessons: (mod.lessons ?? []).map((les: any) => ({
          id: les.id,
          title: les.title,
          order: les.lessonOrder,
          isRequired: les.isRequired,
        })),
        quiz: mod.quiz
          ? {
              id: mod.quiz.id,
              title: mod.quiz.title,
              type: mod.quiz.quizType,
              isPublished: mod.quiz.isPublished,
            }
          : null,
      })),
    };
  }
}
