import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { LearningPathsService } from '../learning-paths/learning-paths.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import { paginate } from '../common/utils/pagination.util.js';
import {
  DomainEvents,
  EnrollmentCreatedEvent,
} from '../common/events/domain-events.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import {
  EnrollmentSource,
  EnrollmentStatus,
  NotificationType,
  PositionLevel,
  Prisma,
  RoleCode,
} from '../generated/prisma/client.js';
import {
  AssignPathDto,
  CreateEnrollmentDto,
  QueryEnrollmentsDto,
  UpdateEnrollmentDto,
} from './dto/enrollment.dto.js';
import {
  calculateProgressPercentage,
  computeEffectiveStatus,
  normalizeAndValidateDeadline,
} from './enrollment.helpers.js';

const MAX_BATCH_RECIPIENTS = 500;

@Injectable()
export class EnrollmentsService {
  private readonly logger = new Logger(EnrollmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
    private readonly learningPathsService: LearningPathsService,
  ) {}

  async assign(dto: CreateEnrollmentDto, actor: AuthenticatedUser) {
    if (!dto.courseId?.trim()) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Vui lòng truyền courseId của khóa học cần giao.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const deadline = normalizeAndValidateDeadline(dto.deadline);
    const isSingleUserRequest =
      Boolean(dto.userId?.trim()) &&
      (!dto.userIds || dto.userIds.length === 0) &&
      !dto.department &&
      !dto.position;

    const matchedUsers = await this.resolveTargetUsers(dto);

    return this.assignCourseToUsers(
      dto.courseId.trim(),
      matchedUsers,
      deadline,
      actor,
      isSingleUserRequest,
    );
  }

  async assignPath(dto: AssignPathDto, actor: AuthenticatedUser) {
    if (actor.role !== RoleCode.HR && actor.role !== RoleCode.ADMIN) {
      throw new BusinessException(
        ErrorCode.AUTH_FORBIDDEN,
        'Chỉ Nhân sự (HR) và Quản trị viên (ADMIN) mới có quyền giao Lộ trình học tập.',
        HttpStatus.FORBIDDEN,
      );
    }

    if (!dto.pathId?.trim()) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Vui lòng truyền pathId của lộ trình cần giao.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const deadline = normalizeAndValidateDeadline(dto.deadline);
    const isSingleUserRequest =
      Boolean(dto.userId?.trim()) &&
      (!dto.userIds || dto.userIds.length === 0) &&
      !dto.department &&
      !dto.targetPosition;

    const matchedUsers = await this.resolveTargetUsers({
      userId: dto.userId,
      userIds: dto.userIds,
      department: dto.department,
      position: dto.targetPosition,
    });

    return this.assignPathToUsers(
      dto.pathId.trim(),
      matchedUsers,
      deadline,
      actor,
      isSingleUserRequest,
      actor.role === RoleCode.ADMIN,
    );
  }

  /**
   * Tự động gán lộ trình Onboarding khi nhân sự mới được đồng bộ từ HRM hoặc đăng nhập lần đầu (Mục 3.7)
   */
  async ensureOnboardingPath(userId: string): Promise<{
    assigned: boolean;
    pathId?: string;
    enrollmentId?: string;
    reason?: string;
  }> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        deletedAt: null,
        isActive: true,
        role: { code: RoleCode.EMPLOYEE },
      },
      select: {
        id: true,
        fullName: true,
        position: true,
      },
    });

    if (!user) {
      return { assigned: false, reason: 'USER_NOT_ELIGIBLE' };
    }

    const existingCount = await this.prisma.pathEnrollment.count({
      where: { userId: user.id },
    });
    if (existingCount > 0) {
      return { assigned: false, reason: 'ALREADY_HAS_PATH' };
    }

    const positionToCode: Record<PositionLevel, string> = {
      [PositionLevel.INTERN]: 'path-intern',
      [PositionLevel.FRESHER]:
        this.configService.get<string>('ONBOARDING_PATH_CODE') ??
        'path-fresher-java',
      [PositionLevel.JUNIOR]: 'path-junior',
      [PositionLevel.SENIOR]: 'path-senior',
      [PositionLevel.LEAD]: 'path-lead',
    };

    const targetCode = positionToCode[user.position];
    const path = await this.prisma.learningPath.findFirst({
      where: { code: targetCode, archivedAt: null },
      select: { id: true, code: true, title: true, estimatedDays: true },
    });

    if (!path) {
      this.logger.warn(
        `NO_PATH_MAPPING: Không tìm thấy lộ trình chuẩn "${targetCode}" cho nhân viên ${user.id} (${user.position}).`,
      );
      return { assigned: false, reason: 'NO_PATH_MAPPING' };
    }

    const deadlineDays =
      this.configService.get<number>('ONBOARDING_DEADLINE_DAYS') ??
      (path.estimatedDays > 0 ? path.estimatedDays : 30);
    const deadline = new Date(Date.now() + deadlineDays * 86_400_000);

    const created = await this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.pathEnrollment.create({
        data: {
          userId: user.id,
          pathId: path.id,
          deadline,
          status: EnrollmentStatus.IN_PROGRESS,
          progressPercentage: 0,
          source: EnrollmentSource.AUTO_ONBOARDING,
        },
      });

      await tx.notification.createMany({
        data: [
          {
            userId: user.id,
            type: NotificationType.ENROLLMENT_ASSIGNED,
            title: `Lộ trình Onboarding: ${path.title}`,
            body: `Chào mừng ${user.fullName}! Bạn đã được tự động gán lộ trình "${path.title}" với hạn hoàn thành ${deadline.toISOString().slice(0, 10)}.`,
            refType: 'path',
            refId: path.id,
            dedupeKey: `enroll:path:${path.id}:${user.id}`,
          },
        ],
        skipDuplicates: true,
      });

      return enrollment;
    });

    await this.invalidateEnrollmentCaches();
    this.eventEmitter.emit(
      DomainEvents.ENROLLMENT_CREATED,
      new EnrollmentCreatedEvent(
        [user.id],
        'PATH',
        path.id,
        path.title,
        deadline,
      ),
    );

    return {
      assigned: true,
      pathId: path.id,
      enrollmentId: created.id,
    };
  }

  async findAll(actor: AuthenticatedUser, query: QueryEnrollmentsDto) {
    const now = new Date();
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const includeCourse =
      (!query.type || query.type === 'COURSE') && !query.pathId;
    const includePath =
      (!query.type || query.type === 'PATH') && !query.courseId;

    const userFilter: Prisma.UserWhereInput = { deletedAt: null };
    if (query.department?.trim()) {
      userFilter.department = {
        contains: query.department.trim(),
        mode: 'insensitive',
      };
    }

    const baseScope: {
      userId?: string;
      assignedById?: string;
    } = {};

    if (actor.role === RoleCode.EMPLOYEE) {
      baseScope.userId = actor.id;
    } else if (actor.role === RoleCode.TRAINER) {
      baseScope.assignedById = actor.id;
      if (query.userId) {
        baseScope.userId = query.userId;
      }
    } else if (query.userId) {
      baseScope.userId = query.userId;
    }

    const [courseEnrollments, pathEnrollments] = await Promise.all([
      includeCourse
        ? this.prisma.courseEnrollment.findMany({
            where: {
              ...baseScope,
              ...(query.courseId ? { courseId: query.courseId } : {}),
              user: userFilter,
            },
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  department: true,
                  position: true,
                },
              },
              course: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                  estimatedHours: true,
                },
              },
              assignedBy: {
                select: { id: true, fullName: true, email: true },
              },
            },
          })
        : Promise.resolve([]),
      includePath
        ? this.prisma.pathEnrollment.findMany({
            where: {
              ...baseScope,
              ...(query.pathId ? { pathId: query.pathId } : {}),
              user: userFilter,
            },
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: {
                  id: true,
                  fullName: true,
                  email: true,
                  department: true,
                  position: true,
                },
              },
              learningPath: {
                select: {
                  id: true,
                  code: true,
                  title: true,
                  targetPosition: true,
                  estimatedDays: true,
                },
              },
              assignedBy: {
                select: { id: true, fullName: true, email: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const unified = [
      ...courseEnrollments.map((ce) => {
        const effectiveStatus = computeEffectiveStatus(
          ce.status,
          ce.deadline,
          now,
        );
        return {
          id: ce.id,
          type: 'COURSE' as const,
          userId: ce.userId,
          user: ce.user,
          courseId: ce.courseId,
          pathId: null,
          target: {
            id: ce.course.id,
            code: ce.course.code,
            title: ce.course.title,
            type: 'COURSE' as const,
          },
          status: effectiveStatus,
          progressPercentage: Number(ce.progressPercentage),
          deadline: ce.deadline,
          assignedAt: ce.createdAt,
          completedAt: ce.completedAt,
          source: ce.source,
          assignedById: ce.assignedById,
          assignedBy: ce.assignedBy,
        };
      }),
      ...pathEnrollments.map((pe) => {
        const effectiveStatus = computeEffectiveStatus(
          pe.status,
          pe.deadline,
          now,
        );
        return {
          id: pe.id,
          type: 'PATH' as const,
          userId: pe.userId,
          user: pe.user,
          courseId: null,
          pathId: pe.pathId,
          target: {
            id: pe.learningPath.id,
            code: pe.learningPath.code,
            title: pe.learningPath.title,
            type: 'PATH' as const,
          },
          status: effectiveStatus,
          progressPercentage: Number(pe.progressPercentage),
          deadline: pe.deadline,
          assignedAt: pe.createdAt,
          completedAt: pe.completedAt,
          source: pe.source,
          assignedById: pe.assignedById,
          assignedBy: pe.assignedBy,
        };
      }),
    ].sort((a, b) => b.assignedAt.getTime() - a.assignedAt.getTime());

    const filtered = unified.filter((item) => {
      if (query.status && item.status !== query.status) {
        return false;
      }
      if (query.overdue === true && item.status !== EnrollmentStatus.OVERDUE) {
        return false;
      }
      if (query.overdue === false && item.status === EnrollmentStatus.OVERDUE) {
        return false;
      }
      return true;
    });

    const start = (page - 1) * limit;
    const pagedData = filtered.slice(start, start + limit);
    return paginate(pagedData, filtered.length, page, limit);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const now = new Date();
    const record = await this.findEnrollmentByIdOrThrow(id);

    this.assertReadScope(record.entry, actor);

    const effectiveStatus = computeEffectiveStatus(
      record.entry.status,
      record.entry.deadline,
      now,
    );

    return {
      ...record.entry,
      type: record.type,
      status: effectiveStatus,
      progressPercentage: Number(record.entry.progressPercentage),
      assignedAt: record.entry.createdAt,
    };
  }

  async updateDeadline(
    id: string,
    dto: UpdateEnrollmentDto,
    actor: AuthenticatedUser,
  ) {
    const newDeadline = normalizeAndValidateDeadline(dto.deadline);
    const record = await this.findEnrollmentByIdOrThrow(id);

    if (actor.role === RoleCode.TRAINER) {
      if (record.entry.assignedById !== actor.id) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          `Không tìm thấy bản ghi giao bài ${id}.`,
          HttpStatus.NOT_FOUND,
        );
      }
    }

    const nextStatus =
      record.entry.status === EnrollmentStatus.COMPLETED
        ? EnrollmentStatus.COMPLETED
        : EnrollmentStatus.IN_PROGRESS;

    const updated = await this.prisma.$transaction(async (tx) => {
      // Reset nhắc hạn cũ để cron WP10 có thể nhắc lại theo deadline mới
      await tx.notification.deleteMany({
        where: {
          userId: record.entry.userId,
          dedupeKey: { startsWith: `reminder:${id}:` },
        },
      });

      if (record.type === 'COURSE') {
        return tx.courseEnrollment.update({
          where: { id },
          data: {
            deadline: newDeadline,
            status: nextStatus,
          },
        });
      }

      return tx.pathEnrollment.update({
        where: { id },
        data: {
          deadline: newDeadline,
          status: nextStatus,
        },
      });
    });

    this.logger.log(
      `Audit: actor=${actor.id} updated deadline of ${record.type} enrollment=${id} to ${newDeadline.toISOString()}`,
    );

    return {
      ...updated,
      type: record.type,
      progressPercentage: Number(updated.progressPercentage),
    };
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const record = await this.findEnrollmentByIdOrThrow(id);

    // D-19: xóa enrollment nhưng giữ nguyên lịch sử UserProgress và QuizAttempt
    if (record.type === 'COURSE') {
      await this.prisma.courseEnrollment.delete({ where: { id } });
    } else {
      await this.prisma.pathEnrollment.delete({ where: { id } });
    }

    await this.invalidateEnrollmentCaches();
    this.logger.log(
      `Audit: actor=${actor.id} deleted ${record.type} enrollment=${id}`,
    );
    return { id, type: record.type, deleted: true };
  }

  /**
   * Tính lại % tiến độ và trạng thái COMPLETED cho toàn bộ Enrollment của 1 user (gọi từ WP8 khi hoàn thành bài học hoặc đạt Quiz)
   */
  async refreshUserEnrollmentsProgress(userId: string): Promise<void> {
    const [courseEnrollments, pathEnrollments, completedLessons, passedQuizzes] =
      await Promise.all([
        this.prisma.courseEnrollment.findMany({
          where: { userId },
          include: {
            course: {
              include: {
                modules: {
                  where: { deletedAt: null },
                  include: {
                    lessons: {
                      where: { deletedAt: null, isRequired: true },
                      select: { id: true },
                    },
                    quiz: {
                      select: { id: true, isPublished: true },
                    },
                  },
                },
              },
            },
          },
        }),
        this.prisma.pathEnrollment.findMany({
          where: { userId },
          include: {
            learningPath: {
              include: {
                pathCourses: {
                  include: {
                    course: {
                      include: {
                        modules: {
                          where: { deletedAt: null },
                          include: {
                            lessons: {
                              where: { deletedAt: null, isRequired: true },
                              select: { id: true },
                            },
                            quiz: {
                              select: { id: true, isPublished: true },
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
    const now = new Date();

    for (const ce of courseEnrollments) {
      let totalItems = 0;
      let doneItems = 0;

      for (const mod of ce.course.modules) {
        for (const les of mod.lessons) {
          totalItems++;
          if (completedLessonIds.has(les.id)) doneItems++;
        }
        if (mod.quiz?.isPublished) {
          totalItems++;
          if (passedQuizIds.has(mod.quiz.id)) doneItems++;
        }
      }

      const pct = calculateProgressPercentage(totalItems, doneItems);
      const isDone = totalItems > 0 && doneItems >= totalItems;

      await this.prisma.courseEnrollment.update({
        where: { id: ce.id },
        data: {
          progressPercentage: pct,
          status: isDone ? EnrollmentStatus.COMPLETED : ce.status,
          completedAt: isDone ? (ce.completedAt ?? now) : ce.completedAt,
        },
      });
    }

    for (const pe of pathEnrollments) {
      let totalItems = 0;
      let doneItems = 0;

      for (const pc of pe.learningPath.pathCourses) {
        if (pc.course.deletedAt) continue;
        for (const mod of pc.course.modules) {
          for (const les of mod.lessons) {
            totalItems++;
            if (completedLessonIds.has(les.id)) doneItems++;
          }
          if (mod.quiz?.isPublished) {
            totalItems++;
            if (passedQuizIds.has(mod.quiz.id)) doneItems++;
          }
        }
      }

      const pct = calculateProgressPercentage(totalItems, doneItems);
      const isDone = totalItems > 0 && doneItems >= totalItems;

      await this.prisma.pathEnrollment.update({
        where: { id: pe.id },
        data: {
          progressPercentage: pct,
          status: isDone ? EnrollmentStatus.COMPLETED : pe.status,
          completedAt: isDone ? (pe.completedAt ?? now) : pe.completedAt,
        },
      });
    }
  }

  private async assignCourseToUsers(
    courseId: string,
    matchedUsers: Array<{ id: string; email: string; fullName: string }>,
    deadline: Date,
    actor: AuthenticatedUser,
    isSingleUserRequest: boolean,
  ) {
    const course = await this.prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      include: {
        modules: {
          where: { deletedAt: null },
          include: {
            lessons: {
              where: { deletedAt: null, isRequired: true },
              select: { id: true },
            },
            quiz: {
              select: { id: true, isPublished: true },
            },
          },
        },
      },
    });

    if (!course) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy khóa học ${courseId}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (!course.isPublished && actor.role !== RoleCode.ADMIN) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        `Khóa học "${course.title}" (${course.code}) chưa được xuất bản nên không thể giao cho học viên.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const existing = await this.prisma.courseEnrollment.findMany({
      where: {
        courseId: course.id,
        userId: { in: matchedUsers.map((u) => u.id) },
      },
      select: { userId: true },
    });

    const existingUserIds = new Set(existing.map((e) => e.userId));
    const skipped = matchedUsers
      .filter((u) => existingUserIds.has(u.id))
      .map((u) => ({ userId: u.id, reason: 'ALREADY_ENROLLED' as const }));
    const toCreateUsers = matchedUsers.filter((u) => !existingUserIds.has(u.id));

    if (isSingleUserRequest && toCreateUsers.length === 0) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Nhân viên này đã được giao khóa học này trước đó.',
        HttpStatus.CONFLICT,
      );
    }

    const requiredLessonIds: string[] = [];
    const publishedQuizIds: string[] = [];
    for (const mod of course.modules) {
      for (const l of mod.lessons) requiredLessonIds.push(l.id);
      if (mod.quiz?.isPublished) publishedQuizIds.push(mod.quiz.id);
    }
    const totalItems = requiredLessonIds.length + publishedQuizIds.length;

    const now = new Date();
    const createdRecords: Array<{
      id: string;
      userId: string;
      deadline: Date;
      status: EnrollmentStatus;
      createdAt: Date;
    }> = [];

    if (toCreateUsers.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        const [progressRows, attemptRows] = await Promise.all([
          requiredLessonIds.length > 0
            ? tx.userProgress.findMany({
                where: {
                  userId: { in: toCreateUsers.map((u) => u.id) },
                  lessonId: { in: requiredLessonIds },
                  isCompleted: true,
                },
                select: { userId: true, lessonId: true },
              })
            : Promise.resolve([]),
          publishedQuizIds.length > 0
            ? tx.quizAttempt.findMany({
                where: {
                  userId: { in: toCreateUsers.map((u) => u.id) },
                  quizId: { in: publishedQuizIds },
                  isPassed: true,
                },
                select: { userId: true, quizId: true },
              })
            : Promise.resolve([]),
        ]);

        const enrollRows: Prisma.CourseEnrollmentCreateManyInput[] = [];
        const notifRows: Prisma.NotificationCreateManyInput[] = [];

        for (const u of toCreateUsers) {
          const doneLessons = new Set(
            progressRows.filter((p) => p.userId === u.id).map((p) => p.lessonId),
          ).size;
          const doneQuizzes = new Set(
            attemptRows.filter((a) => a.userId === u.id).map((a) => a.quizId),
          ).size;
          const doneItems = doneLessons + doneQuizzes;
          const pct = calculateProgressPercentage(totalItems, doneItems);
          const isCompleted = totalItems > 0 && doneItems >= totalItems;
          const id = randomUUID();
          const status = isCompleted
            ? EnrollmentStatus.COMPLETED
            : EnrollmentStatus.IN_PROGRESS;

          enrollRows.push({
            id,
            userId: u.id,
            courseId: course.id,
            deadline,
            status,
            progressPercentage: pct,
            completedAt: isCompleted ? now : null,
            assignedById: actor.id,
            source: EnrollmentSource.MANUAL,
            createdAt: now,
          });

          createdRecords.push({
            id,
            userId: u.id,
            deadline,
            status,
            createdAt: now,
          });

          notifRows.push({
            userId: u.id,
            type: NotificationType.ENROLLMENT_ASSIGNED,
            title: `Khóa học mới được giao: ${course.title}`,
            body: `Bạn đã được giao khóa học "${course.title}" (${course.code}). Hạn hoàn thành: ${deadline.toISOString().slice(0, 10)}.`,
            refType: 'course',
            refId: course.id,
            dedupeKey: `enroll:course:${course.id}:${u.id}`,
          });
        }

        await tx.courseEnrollment.createMany({
          data: enrollRows,
          skipDuplicates: true,
        });

        await tx.notification.createMany({
          data: notifRows,
          skipDuplicates: true,
        });
      });

      await this.invalidateEnrollmentCaches();

      this.eventEmitter.emit(
        DomainEvents.ENROLLMENT_CREATED,
        new EnrollmentCreatedEvent(
          createdRecords.map((r) => r.userId),
          'COURSE',
          course.id,
          course.title,
          deadline,
          actor.id,
        ),
      );
    }

    const first = createdRecords[0];
    this.logger.log(
      `Audit: actor=${actor.id} assigned course=${course.id} created=${createdRecords.length} skipped=${skipped.length}`,
    );

    return {
      createdCount: createdRecords.length,
      skippedCount: skipped.length,
      matched: matchedUsers.length,
      enrollmentIds: createdRecords.map((r) => r.id),
      skipped,
      ...(first
        ? {
            enrollmentId: first.id,
            assignedAt: first.createdAt,
            deadline: first.deadline,
            status: first.status,
          }
        : {}),
    };
  }

  private async assignPathToUsers(
    pathIdOrCode: string,
    matchedUsers: Array<{ id: string; email: string; fullName: string }>,
    deadline: Date,
    actor: AuthenticatedUser,
    isSingleUserRequest: boolean,
    allowIncomplete: boolean,
  ) {
    const path = await this.learningPathsService.getOrderedStructure(
      pathIdOrCode,
    );

    const validation = await this.learningPathsService.validateStructure(
      path.id,
    );
    if (!validation.valid && !allowIncomplete) {
      throw new BusinessException(
        ErrorCode.PATH_STRUCTURE_INVALID,
        'Cấu trúc lộ trình học tập chưa hợp lệ để giao cho học viên (Yêu cầu đủ 4 học phần MODULE + 1 bài kiểm tra FINAL ở cuối lộ trình – LP-1..LP-3).',
        HttpStatus.UNPROCESSABLE_ENTITY,
        validation.issues,
      );
    }

    const existing = await this.prisma.pathEnrollment.findMany({
      where: {
        pathId: path.id,
        userId: { in: matchedUsers.map((u) => u.id) },
      },
      select: { userId: true },
    });

    const existingUserIds = new Set(existing.map((e) => e.userId));
    const skipped = matchedUsers
      .filter((u) => existingUserIds.has(u.id))
      .map((u) => ({ userId: u.id, reason: 'ALREADY_ENROLLED' as const }));
    const toCreateUsers = matchedUsers.filter((u) => !existingUserIds.has(u.id));

    if (isSingleUserRequest && toCreateUsers.length === 0) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Nhân viên này đã được giao lộ trình học tập này trước đó.',
        HttpStatus.CONFLICT,
      );
    }

    const requiredLessonIds: string[] = [];
    const publishedQuizIds: string[] = [];
    for (const pc of path.pathCourses) {
      if (pc.course.deletedAt) continue;
      for (const mod of pc.course.modules) {
        for (const l of mod.lessons) {
          if (l.isRequired) requiredLessonIds.push(l.id);
        }
        if (mod.quiz?.isPublished) {
          publishedQuizIds.push(mod.quiz.id);
        }
      }
    }
    const totalItems = requiredLessonIds.length + publishedQuizIds.length;

    const now = new Date();
    const createdRecords: Array<{
      id: string;
      userId: string;
      deadline: Date;
      status: EnrollmentStatus;
      createdAt: Date;
    }> = [];

    if (toCreateUsers.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        const [progressRows, attemptRows] = await Promise.all([
          requiredLessonIds.length > 0
            ? tx.userProgress.findMany({
                where: {
                  userId: { in: toCreateUsers.map((u) => u.id) },
                  lessonId: { in: requiredLessonIds },
                  isCompleted: true,
                },
                select: { userId: true, lessonId: true },
              })
            : Promise.resolve([]),
          publishedQuizIds.length > 0
            ? tx.quizAttempt.findMany({
                where: {
                  userId: { in: toCreateUsers.map((u) => u.id) },
                  quizId: { in: publishedQuizIds },
                  isPassed: true,
                },
                select: { userId: true, quizId: true },
              })
            : Promise.resolve([]),
        ]);

        const enrollRows: Prisma.PathEnrollmentCreateManyInput[] = [];
        const notifRows: Prisma.NotificationCreateManyInput[] = [];

        for (const u of toCreateUsers) {
          const doneLessons = new Set(
            progressRows.filter((p) => p.userId === u.id).map((p) => p.lessonId),
          ).size;
          const doneQuizzes = new Set(
            attemptRows.filter((a) => a.userId === u.id).map((a) => a.quizId),
          ).size;
          const doneItems = doneLessons + doneQuizzes;
          const pct = calculateProgressPercentage(totalItems, doneItems);
          const isCompleted = totalItems > 0 && doneItems >= totalItems;
          const id = randomUUID();
          const status = isCompleted
            ? EnrollmentStatus.COMPLETED
            : EnrollmentStatus.IN_PROGRESS;

          enrollRows.push({
            id,
            userId: u.id,
            pathId: path.id,
            deadline,
            status,
            progressPercentage: pct,
            completedAt: isCompleted ? now : null,
            assignedById: actor.id,
            source: EnrollmentSource.MANUAL,
            createdAt: now,
          });

          createdRecords.push({
            id,
            userId: u.id,
            deadline,
            status,
            createdAt: now,
          });

          notifRows.push({
            userId: u.id,
            type: NotificationType.ENROLLMENT_ASSIGNED,
            title: `Lộ trình học tập mới: ${path.title}`,
            body: `Bạn đã được giao lộ trình "${path.title}" (${path.code}). Hạn hoàn thành: ${deadline.toISOString().slice(0, 10)}.`,
            refType: 'path',
            refId: path.id,
            dedupeKey: `enroll:path:${path.id}:${u.id}`,
          });
        }

        await tx.pathEnrollment.createMany({
          data: enrollRows,
          skipDuplicates: true,
        });

        await tx.notification.createMany({
          data: notifRows,
          skipDuplicates: true,
        });
      });

      await this.invalidateEnrollmentCaches();

      this.eventEmitter.emit(
        DomainEvents.ENROLLMENT_CREATED,
        new EnrollmentCreatedEvent(
          createdRecords.map((r) => r.userId),
          'PATH',
          path.id,
          path.title,
          deadline,
          actor.id,
        ),
      );
    }

    const first = createdRecords[0];
    this.logger.log(
      `Audit: actor=${actor.id} assigned path=${path.id} created=${createdRecords.length} skipped=${skipped.length}`,
    );

    return {
      createdCount: createdRecords.length,
      skippedCount: skipped.length,
      matched: matchedUsers.length,
      enrollmentIds: createdRecords.map((r) => r.id),
      skipped,
      ...(first
        ? {
            enrollmentId: first.id,
            assignedAt: first.createdAt,
            deadline: first.deadline,
            status: first.status,
          }
        : {}),
    };
  }

  /**
   * TargetResolver: Resolve danh sách EMPLOYEE đang hoạt động theo userId / userIds[] / department / position
   */
  async resolveTargetUsers(dto: {
    userId?: string;
    userIds?: string[];
    department?: string;
    position?: PositionLevel;
  }): Promise<Array<{ id: string; email: string; fullName: string }>> {
    const explicitIds = new Set<string>();
    if (dto.userId?.trim()) {
      explicitIds.add(dto.userId.trim());
    }
    if (dto.userIds?.length) {
      for (const id of dto.userIds) {
        if (id?.trim()) explicitIds.add(id.trim());
      }
    }

    const hasExplicitIds = explicitIds.size > 0;
    const hasDepartment = Boolean(dto.department?.trim());
    const hasPosition = Boolean(dto.position);

    if (!hasExplicitIds && !hasDepartment && !hasPosition) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Vui lòng chỉ định đối tượng nhận bài (userId, userIds, department hoặc position).',
        HttpStatus.BAD_REQUEST,
      );
    }

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      isActive: true,
      role: { code: RoleCode.EMPLOYEE },
    };

    if (hasExplicitIds) {
      where.id = { in: [...explicitIds] };
    }
    if (hasDepartment) {
      where.department = {
        equals: dto.department!.trim(),
        mode: 'insensitive',
      };
    }
    if (hasPosition) {
      where.position = dto.position;
    }

    const matched = await this.prisma.user.findMany({
      where,
      select: { id: true, email: true, fullName: true },
      orderBy: { createdAt: 'asc' },
    });

    if (matched.length === 0) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Không tìm thấy nhân viên (EMPLOYEE đang hoạt động) phù hợp với điều kiện giao bài.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    if (matched.length > MAX_BATCH_RECIPIENTS) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        `Số lượng nhân viên nhận bài (${matched.length}) vượt quá giới hạn tối đa ${MAX_BATCH_RECIPIENTS} người/lần.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return matched;
  }

  private async findEnrollmentByIdOrThrow(id: string): Promise<{
    type: 'COURSE' | 'PATH';
    entry: any;
  }> {
    const courseEnroll = await this.prisma.courseEnrollment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            department: true,
            position: true,
          },
        },
        course: {
          select: {
            id: true,
            code: true,
            title: true,
            estimatedHours: true,
          },
        },
        assignedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (courseEnroll) {
      return { type: 'COURSE', entry: courseEnroll };
    }

    const pathEnroll = await this.prisma.pathEnrollment.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            department: true,
            position: true,
          },
        },
        learningPath: {
          select: {
            id: true,
            code: true,
            title: true,
            targetPosition: true,
            estimatedDays: true,
          },
        },
        assignedBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    if (pathEnroll) {
      return { type: 'PATH', entry: pathEnroll };
    }

    throw new BusinessException(
      ErrorCode.NOT_FOUND,
      `Không tìm thấy bản ghi giao bài ${id}.`,
      HttpStatus.NOT_FOUND,
    );
  }

  /**
   * Kiểm tra phạm vi quyền xem Enrollment (Mục 5.3 – trả 404 thay vì 403 nếu ngoài scope để không lộ ID)
   */
  private assertReadScope(
    entry: { userId: string; assignedById: string | null },
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === RoleCode.ADMIN || actor.role === RoleCode.HR) {
      return;
    }

    if (actor.role === RoleCode.TRAINER && entry.assignedById === actor.id) {
      return;
    }

    if (actor.role === RoleCode.EMPLOYEE && entry.userId === actor.id) {
      return;
    }

    throw new BusinessException(
      ErrorCode.NOT_FOUND,
      'Không tìm thấy bản ghi giao bài.',
      HttpStatus.NOT_FOUND,
    );
  }

  private async invalidateEnrollmentCaches(): Promise<void> {
    await Promise.all([
      this.redis.delByPattern('lms:courses:list:*'),
      this.redis.delByPattern('lms:paths:list*'),
    ]);
  }
}
