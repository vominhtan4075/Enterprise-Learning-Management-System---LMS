import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { EnrollmentsService } from '../enrollments/enrollments.service.js';
import { computeEffectiveStatus } from '../enrollments/enrollment.helpers.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import {
  DomainEvents,
  LessonCompletedEvent,
  ModuleCompletedEvent,
  PathCompletedEvent,
  QuizAttemptCompletedEvent,
} from '../common/events/domain-events.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { EnrollmentStatus, RoleCode } from '../generated/prisma/client.js';
import { AccessService } from './access.service.js';
import { computeUnlock, type CourseNode } from './unlock-engine.js';
import { UpdateProgressDto } from './dto/progress.dto.js';

@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);
  private readonly strictLessonOrder: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly accessService: AccessService,
    private readonly enrollmentsService: EnrollmentsService,
  ) {
    this.strictLessonOrder =
      this.configService.get<boolean>('STRICT_LESSON_ORDER') ?? false;
  }

  async getMyProgress(actor: AuthenticatedUser) {
    if (actor.role === RoleCode.EMPLOYEE) {
      await this.enrollmentsService.ensureOnboardingPath(actor.id);
    }

    const now = new Date();
    const [pathEnrollments, courseEnrollments, completedLessons, passedQuizzes] =
      await Promise.all([
        this.prisma.pathEnrollment.findMany({
          where: { userId: actor.id, learningPath: { archivedAt: null } },
          orderBy: { createdAt: 'asc' },
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
            userId: actor.id,
            course: { deletedAt: null, isPublished: true },
          },
          orderBy: { createdAt: 'asc' },
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
          where: { userId: actor.id, isCompleted: true },
          select: { lessonId: true },
        }),
        this.prisma.quizAttempt.findMany({
          where: { userId: actor.id, isPassed: true },
          select: { quizId: true },
        }),
      ]);

    const completedLessonIds = new Set(completedLessons.map((l) => l.lessonId));
    const passedQuizIds = new Set(passedQuizzes.map((q) => q.quizId));

    let nextUp: {
      type: 'LESSON' | 'QUIZ';
      id: string;
      title: string;
      courseId: string;
      moduleId: string;
    } | null = null;

    const paths = pathEnrollments.map((pe) => {
      const activeSteps = pe.learningPath.pathCourses.filter(
        (pc) => !pc.course.deletedAt && pc.course.isPublished,
      );
      const courseNodes: CourseNode[] = activeSteps.map((pc) =>
        this.accessService.mapCourseToNode(pc.course, pc.stepOrder),
      );

      const engineOut = computeUnlock({
        courses: courseNodes,
        completedLessonIds,
        passedQuizIds,
        strictLessonOrder: this.strictLessonOrder,
      });

      let completedCourses = 0;
      let currentUnit: {
        moduleId: string;
        title: string;
        courseId: string;
      } | null = null;

      for (const pc of activeSteps) {
        if (engineOut.courses.get(pc.course.id) === 'COMPLETED') {
          completedCourses++;
        }
        for (const mod of pc.course.modules) {
          const modState = engineOut.modules.get(mod.id);
          if (!currentUnit && modState === 'UNLOCKED') {
            currentUnit = {
              moduleId: mod.id,
              title: mod.title,
              courseId: pc.course.id,
            };
          }

          if (!nextUp) {
            for (const les of mod.lessons) {
              if (engineOut.lessons.get(les.id)?.state === 'UNLOCKED') {
                nextUp = {
                  type: 'LESSON',
                  id: les.id,
                  title: les.title,
                  courseId: pc.course.id,
                  moduleId: mod.id,
                };
                break;
              }
            }
          }

          if (
            !nextUp &&
            mod.quiz &&
            engineOut.quizzes.get(mod.quiz.id)?.state === 'UNLOCKED'
          ) {
            nextUp = {
              type: 'QUIZ',
              id: mod.quiz.id,
              title: mod.quiz.title,
              courseId: pc.course.id,
              moduleId: mod.id,
            };
          }
        }
      }

      const status = computeEffectiveStatus(pe.status, pe.deadline, now);

      return {
        enrollmentId: pe.id,
        pathId: pe.pathId,
        code: pe.learningPath.code,
        title: pe.learningPath.title,
        progressPercentage: Number(pe.progressPercentage),
        deadline: pe.deadline,
        status,
        completedCourses,
        totalCourses: activeSteps.length,
        currentUnit,
      };
    });

    const courses = courseEnrollments.map((ce) => {
      const courseNode = this.accessService.mapCourseToNode(ce.course, 1);
      const engineOut = computeUnlock({
        courses: [courseNode],
        completedLessonIds,
        passedQuizIds,
        strictLessonOrder: this.strictLessonOrder,
      });

      let completedModules = 0;
      for (const mod of ce.course.modules) {
        if (engineOut.modules.get(mod.id) === 'COMPLETED') {
          completedModules++;
        }
        if (!nextUp) {
          for (const les of mod.lessons) {
            if (engineOut.lessons.get(les.id)?.state === 'UNLOCKED') {
              nextUp = {
                type: 'LESSON',
                id: les.id,
                title: les.title,
                courseId: ce.course.id,
                moduleId: mod.id,
              };
              break;
            }
          }
        }
        if (
          !nextUp &&
          mod.quiz &&
          engineOut.quizzes.get(mod.quiz.id)?.state === 'UNLOCKED'
        ) {
          nextUp = {
            type: 'QUIZ',
            id: mod.quiz.id,
            title: mod.quiz.title,
            courseId: ce.course.id,
            moduleId: mod.id,
          };
        }
      }

      const status = computeEffectiveStatus(ce.status, ce.deadline, now);

      return {
        enrollmentId: ce.id,
        courseId: ce.courseId,
        code: ce.course.code,
        title: ce.course.title,
        progressPercentage: Number(ce.progressPercentage),
        deadline: ce.deadline,
        status,
        completedModules,
        totalModules: ce.course.modules.length,
      };
    });

    const upcomingDeadlines = [
      ...paths
        .filter((p) => p.status !== EnrollmentStatus.COMPLETED)
        .map((p) => ({
          enrollmentId: p.enrollmentId,
          type: 'PATH' as const,
          targetId: p.pathId,
          title: p.title,
          deadline: p.deadline,
          status: p.status,
          progressPercentage: p.progressPercentage,
        })),
      ...courses
        .filter((c) => c.status !== EnrollmentStatus.COMPLETED)
        .map((c) => ({
          enrollmentId: c.enrollmentId,
          type: 'COURSE' as const,
          targetId: c.courseId,
          title: c.title,
          deadline: c.deadline,
          status: c.status,
          progressPercentage: c.progressPercentage,
        })),
    ].sort((a, b) => a.deadline.getTime() - b.deadline.getTime());

    return {
      userId: actor.id,
      paths,
      courses,
      nextUp,
      upcomingDeadlines,
    };
  }

  async updateLessonProgress(
    actor: AuthenticatedUser,
    dto: UpdateProgressDto,
  ) {
    if (dto.isCompleted === false) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Hệ thống không chấp nhận bỏ đánh dấu hoàn thành bài học (isCompleted=false) trong phiên bản MVP.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: dto.lessonId,
        deletedAt: null,
        module: { deletedAt: null, course: { deletedAt: null } },
      },
      include: {
        module: {
          select: {
            id: true,
            courseId: true,
            quiz: { select: { id: true } },
          },
        },
      },
    });

    if (!lesson) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy bài học ${dto.lessonId}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    // Kiểm tra quyền ghi danh + trạng thái mở khóa BR-02
    await this.accessService.assertCanAccessLesson(actor.id, lesson.id);

    const now = new Date();
    const progress = await this.prisma.userProgress.upsert({
      where: {
        userId_lessonId: {
          userId: actor.id,
          lessonId: lesson.id,
        },
      },
      create: {
        userId: actor.id,
        lessonId: lesson.id,
        isCompleted: true,
        completedAt: now,
      },
      update: {
        isCompleted: true,
        completedAt: now,
      },
    });

    await this.enrollmentsService.refreshUserEnrollmentsProgress(actor.id);
    await this.invalidateProgressCaches();

    const { merged } = await this.accessService.getUserUnlockSnapshot(actor.id);
    const moduleState = merged.modules.get(lesson.moduleId) ?? 'UNLOCKED';
    const quizId = lesson.module.quiz?.id;
    const quizState = quizId ? merged.quizzes.get(quizId)?.state : undefined;
    const quizUnlocked =
      quizState === 'UNLOCKED' || quizState === 'COMPLETED';

    let nextUnlocked: { type: 'LESSON' | 'QUIZ'; id: string } | null = null;
    for (const [lesId, info] of merged.lessons.entries()) {
      if (info.state === 'UNLOCKED') {
        nextUnlocked = { type: 'LESSON', id: lesId };
        break;
      }
    }
    if (!nextUnlocked && quizId && quizState === 'UNLOCKED') {
      nextUnlocked = { type: 'QUIZ', id: quizId };
    }

    this.eventEmitter.emit(
      DomainEvents.LESSON_COMPLETED,
      new LessonCompletedEvent(
        actor.id,
        lesson.id,
        lesson.moduleId,
        lesson.module.courseId,
        progress.completedAt ?? now,
      ),
    );

    if (moduleState === 'COMPLETED') {
      this.eventEmitter.emit(
        DomainEvents.MODULE_COMPLETED,
        new ModuleCompletedEvent(
          actor.id,
          lesson.moduleId,
          lesson.module.courseId,
          now,
        ),
      );
    }

    this.logger.log(
      `Audit: actor=${actor.id} completed lesson=${lesson.id} moduleState=${moduleState} quizUnlocked=${quizUnlocked}`,
    );

    return {
      lessonId: lesson.id,
      isCompleted: true,
      completedAt: progress.completedAt ?? now,
      moduleState,
      quizUnlocked,
      nextUnlocked,
    };
  }

  /**
   * Consumer nhận kết quả nộp bài Quiz từ SV04 (WP8 8.2 & WP9 9.4):
   * Tự động tính lại % tiến độ Enrollment, phát ModuleCompletedEvent và PathCompletedEvent
   */
  @OnEvent(DomainEvents.QUIZ_ATTEMPT_COMPLETED)
  async handleQuizAttemptCompleted(
    event: QuizAttemptCompletedEvent,
  ): Promise<void> {
    try {
      await this.enrollmentsService.refreshUserEnrollmentsProgress(
        event.userId,
      );
      await this.invalidateProgressCaches();

      if (event.isPassed) {
        this.eventEmitter.emit(
          DomainEvents.MODULE_COMPLETED,
          new ModuleCompletedEvent(
            event.userId,
            event.moduleId,
            event.courseId,
            event.completedAt,
          ),
        );

        const completedPaths = await this.prisma.pathEnrollment.findMany({
          where: {
            userId: event.userId,
            status: EnrollmentStatus.COMPLETED,
          },
          select: { pathId: true },
        });

        for (const cp of completedPaths) {
          this.eventEmitter.emit(
            DomainEvents.PATH_COMPLETED,
            new PathCompletedEvent(
              event.userId,
              cp.pathId,
              event.completedAt,
            ),
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `Failed to process QuizAttemptCompletedEvent for user=${event.userId}`,
        err,
      );
    }
  }

  private async invalidateProgressCaches(): Promise<void> {
    await Promise.all([
      this.redis.delByPattern('lms:dash:*'),
      this.redis.delByPattern('lms:competency:*'),
    ]);
  }
}
