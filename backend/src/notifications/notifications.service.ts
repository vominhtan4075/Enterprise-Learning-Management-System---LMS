import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma.service.js';
import { MailService } from './mail.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import { paginate } from '../common/utils/pagination.util.js';
import {
  DomainEvents,
  EnrollmentCreatedEvent,
  PathCompletedEvent,
  QuizAttemptCompletedEvent,
} from '../common/events/domain-events.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import {
  EnrollmentStatus,
  NotificationType,
  Prisma,
  QuizType,
  RoleCode,
} from '../generated/prisma/client.js';
import { QueryNotificationsDto } from './dto/notification.dto.js';
import {
  buildReminderDedupeKey,
  calcReminderKind,
} from './reminder.helper.js';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async findAll(actor: AuthenticatedUser, query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.NotificationWhereInput = {
      userId: actor.id,
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [items, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId: actor.id, readAt: null },
      }),
    ]);

    return {
      ...paginate(items, total, page, limit),
      unreadCount,
    };
  }

  async markAsRead(id: string, actor: AuthenticatedUser) {
    const notif = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notif || notif.userId !== actor.id) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy thông báo ${id}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (notif.readAt) {
      return notif;
    }

    return this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(actor: AuthenticatedUser) {
    const res = await this.prisma.notification.updateMany({
      where: {
        userId: actor.id,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    return {
      updatedCount: res.count,
      readAt: new Date(),
    };
  }

  /**
   * Cron nhắc hạn hàng ngày lúc 08:00 sáng (ICT) hoặc kích hoạt thủ công qua API (WP10 10.4 & 10.9)
   */
  @Cron('0 8 * * *')
  async runDeadlineRemindersJob(now: Date = new Date()) {
    const [courseEnrollments, pathEnrollments] = await Promise.all([
      this.prisma.courseEnrollment.findMany({
        where: { status: EnrollmentStatus.IN_PROGRESS },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          course: { select: { id: true, code: true, title: true } },
          assignedBy: { select: { id: true, email: true, fullName: true } },
        },
      }),
      this.prisma.pathEnrollment.findMany({
        where: { status: EnrollmentStatus.IN_PROGRESS },
        include: {
          user: { select: { id: true, email: true, fullName: true } },
          learningPath: { select: { id: true, code: true, title: true } },
          assignedBy: { select: { id: true, email: true, fullName: true } },
        },
      }),
    ]);

    let remindersSent = 0;
    let overdueMarked = 0;

    const allItems = [
      ...courseEnrollments.map((ce) => ({
        id: ce.id,
        kindType: 'COURSE' as const,
        refType: 'course',
        targetId: ce.course.id,
        targetTitle: ce.course.title,
        deadline: ce.deadline,
        user: ce.user,
        assignedBy: ce.assignedBy,
      })),
      ...pathEnrollments.map((pe) => ({
        id: pe.id,
        kindType: 'PATH' as const,
        refType: 'path',
        targetId: pe.learningPath.id,
        targetTitle: pe.learningPath.title,
        deadline: pe.deadline,
        user: pe.user,
        assignedBy: pe.assignedBy,
      })),
    ];

    for (const item of allItems) {
      const reminderKind = calcReminderKind(item.deadline, now);
      if (!reminderKind) continue;

      if (reminderKind === 'OVERDUE') {
        if (item.kindType === 'COURSE') {
          await this.prisma.courseEnrollment.update({
            where: { id: item.id },
            data: { status: EnrollmentStatus.OVERDUE },
          });
        } else {
          await this.prisma.pathEnrollment.update({
            where: { id: item.id },
            data: { status: EnrollmentStatus.OVERDUE },
          });
        }
        overdueMarked++;

        const learnerKey = buildReminderDedupeKey(
          item.id,
          'OVERDUE',
          item.deadline,
          item.user.id,
        );
        const notifsToCreate: Prisma.NotificationCreateManyInput[] = [
          {
            userId: item.user.id,
            type: NotificationType.ENROLLMENT_OVERDUE,
            title: `Quá hạn hoàn thành: ${item.targetTitle}`,
            body: `Nội dung đào tạo "${item.targetTitle}" đã quá hạn chót (${item.deadline.toISOString().slice(0, 10)}). Vui lòng hoàn thành sớm hoặc liên hệ HR/Trainer.`,
            refType: item.refType,
            refId: item.targetId,
            dedupeKey: learnerKey,
          },
        ];

        if (item.assignedBy && item.assignedBy.id !== item.user.id) {
          notifsToCreate.push({
            userId: item.assignedBy.id,
            type: NotificationType.ENROLLMENT_OVERDUE,
            title: `Học viên quá hạn: ${item.user.fullName}`,
            body: `Học viên ${item.user.fullName} (${item.user.email}) đã quá hạn hoàn thành "${item.targetTitle}" (Hạn: ${item.deadline.toISOString().slice(0, 10)}).`,
            refType: item.refType,
            refId: item.targetId,
            dedupeKey: buildReminderDedupeKey(
              item.id,
              'OVERDUE',
              item.deadline,
              item.assignedBy.id,
            ),
          });
        }

        const created = await this.prisma.notification.createMany({
          data: notifsToCreate,
          skipDuplicates: true,
        });

        if (created.count > 0) {
          remindersSent += created.count;
          await this.mailService.sendMailSafe({
            to: item.user.email,
            subject: `[NovaTech LMS] Cảnh báo quá hạn đào tạo: ${item.targetTitle}`,
            text: `Xin chào ${item.user.fullName},\nNội dung "${item.targetTitle}" đã quá hạn hoàn thành (${item.deadline.toISOString().slice(0, 10)}).`,
          });
        }
      } else {
        const labelMap: Record<'D-3' | 'D-1' | 'D-0', string> = {
          'D-3': 'còn 3 ngày',
          'D-1': 'còn 1 ngày',
          'D-0': 'hết hạn trong hôm nay',
        };
        const dedupeKey = buildReminderDedupeKey(
          item.id,
          reminderKind,
          item.deadline,
          item.user.id,
        );

        const created = await this.prisma.notification.createMany({
          data: [
            {
              userId: item.user.id,
              type: NotificationType.DEADLINE_REMINDER,
              title: `Nhắc hạn đào tạo (${labelMap[reminderKind]}): ${item.targetTitle}`,
              body: `Nội dung đào tạo "${item.targetTitle}" sẽ ${labelMap[reminderKind]} (Hạn chót: ${item.deadline.toISOString().slice(0, 10)}).`,
              refType: item.refType,
              refId: item.targetId,
              dedupeKey,
            },
          ],
          skipDuplicates: true,
        });

        if (created.count > 0) {
          remindersSent += created.count;
          await this.mailService.sendMailSafe({
            to: item.user.email,
            subject: `[NovaTech LMS] Nhắc hạn đào tạo (${labelMap[reminderKind]}): ${item.targetTitle}`,
            text: `Xin chào ${item.user.fullName},\nNội dung "${item.targetTitle}" của bạn ${labelMap[reminderKind]} (Hạn: ${item.deadline.toISOString().slice(0, 10)}).`,
          });
        }
      }
    }

    return {
      scannedCount: allItems.length,
      remindersSent,
      overdueMarked,
    };
  }

  /**
   * Sau khi giao bài thành công (EnrollmentCreatedEvent), gửi email thông báo tới các nhân viên
   */
  @OnEvent(DomainEvents.ENROLLMENT_CREATED)
  async handleEnrollmentCreated(event: EnrollmentCreatedEvent): Promise<void> {
    try {
      const users = await this.prisma.user.findMany({
        where: { id: { in: event.userIds } },
        select: { id: true, email: true, fullName: true },
      });

      for (const u of users) {
        await this.mailService.sendMailSafe({
          to: u.email,
          subject: `[NovaTech LMS] Nội dung đào tạo mới: ${event.targetTitle}`,
          text: `Xin chào ${u.fullName},\nBạn vừa được giao ${event.targetType === 'PATH' ? 'Lộ trình học tập' : 'Khóa học'} "${event.targetTitle}".\nHạn hoàn thành: ${event.deadline.toISOString().slice(0, 10)}.`,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Lỗi xử lý gửi mail EnrollmentCreatedEvent: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Xử lý kết quả làm bài kiểm tra Quiz (WP10 10.4):
   * - Gửi thông báo QUIZ_PASSED / QUIZ_FAILED cho học viên.
   * - Đặc biệt ([W2] bước 6): nếu trượt bài kiểm tra tổng hợp cuối khóa (quizType = FINAL & isPassed = false),
   *   gửi cảnh báo FINAL_FAILED_ALERT tới Trainer đã giao và toàn bộ HR đang hoạt động.
   */
  @OnEvent(DomainEvents.QUIZ_ATTEMPT_COMPLETED)
  async handleQuizAttemptCompleted(
    event: QuizAttemptCompletedEvent,
  ): Promise<void> {
    try {
      const [learner, quiz] = await Promise.all([
        this.prisma.user.findUnique({
          where: { id: event.userId },
          select: { id: true, fullName: true, email: true, department: true },
        }),
        this.prisma.quiz.findUnique({
          where: { id: event.quizId },
          select: { id: true, title: true, quizType: true },
        }),
      ]);

      if (!learner || !quiz) return;

      const roundedScore = Math.round(event.score * 10) / 10;

      await this.prisma.notification.createMany({
        data: [
          {
            userId: learner.id,
            type: event.isPassed
              ? NotificationType.QUIZ_PASSED
              : NotificationType.QUIZ_FAILED,
            title: event.isPassed
              ? `Chúc mừng vượt qua bài kiểm tra: ${quiz.title}`
              : `Chưa đạt bài kiểm tra: ${quiz.title}`,
            body: event.isPassed
              ? `Bạn đã đạt ${roundedScore}% trong bài kiểm tra "${quiz.title}". Học phần tiếp theo đã được mở khóa!`
              : `Bạn đạt ${roundedScore}% (chưa đủ 70%) trong bài kiểm tra "${quiz.title}". Vui lòng xem danh sách bài học gợi ý ôn tập (BR-03) và làm lại.`,
            refType: 'quiz',
            refId: quiz.id,
            dedupeKey: `quiz:attempt:${event.attemptId}:${learner.id}`,
          },
        ],
        skipDuplicates: true,
      });

      const effectiveQuizType = quiz.quizType ?? event.quizType;
      if (effectiveQuizType === QuizType.FINAL && !event.isPassed) {
        const [hrUsers, pathEnrollments, courseEnrollments] = await Promise.all([
          this.prisma.user.findMany({
            where: {
              deletedAt: null,
              isActive: true,
              role: { code: RoleCode.HR },
            },
            select: { id: true, email: true, fullName: true },
          }),
          this.prisma.pathEnrollment.findMany({
            where: { userId: learner.id, assignedById: { not: null } },
            select: { assignedById: true },
          }),
          event.courseId
            ? this.prisma.courseEnrollment.findMany({
                where: {
                  userId: learner.id,
                  courseId: event.courseId,
                  assignedById: { not: null },
                },
                select: { assignedById: true },
              })
            : Promise.resolve([]),
        ]);

        const assignerIds = new Set<string>();
        for (const pe of pathEnrollments) {
          if (pe.assignedById) assignerIds.add(pe.assignedById);
        }
        for (const ce of courseEnrollments) {
          if (ce.assignedById) assignerIds.add(ce.assignedById);
        }

        const assigners =
          assignerIds.size > 0
            ? await this.prisma.user.findMany({
                where: {
                  id: { in: [...assignerIds] },
                  deletedAt: null,
                  isActive: true,
                },
                select: { id: true, email: true, fullName: true },
              })
            : [];

        const recipientsMap = new Map<
          string,
          { id: string; email: string; fullName: string }
        >();
        for (const hr of hrUsers) recipientsMap.set(hr.id, hr);
        for (const tr of assigners) recipientsMap.set(tr.id, tr);

        const alertRows: Prisma.NotificationCreateManyInput[] = [];
        for (const recipient of recipientsMap.values()) {
          alertRows.push({
            userId: recipient.id,
            type: NotificationType.FINAL_FAILED_ALERT,
            title: `Cảnh báo trượt bài thi tổng hợp (FINAL): ${learner.fullName}`,
            body: `Học viên ${learner.fullName} (${learner.email}) vừa thi trượt bài kiểm tra tổng hợp cuối khóa "${quiz.title}" với điểm ${roundedScore}% (< 70%).`,
            refType: 'quiz',
            refId: quiz.id,
            dedupeKey: `final:failed:${event.attemptId}:${recipient.id}`,
          });
        }

        if (alertRows.length > 0) {
          await this.prisma.notification.createMany({
            data: alertRows,
            skipDuplicates: true,
          });

          for (const recipient of recipientsMap.values()) {
            await this.mailService.sendMailSafe({
              to: recipient.email,
              subject: `[NovaTech LMS] CẢNH BÁO: Học viên ${learner.fullName} trượt bài kiểm tra tổng hợp FINAL`,
              text: `Xin chào ${recipient.fullName},\nHọc viên ${learner.fullName} (${learner.email}) đạt ${roundedScore}% trong bài thi tổng hợp "${quiz.title}". Hệ thống đã gửi gợi ý bài ôn tập cho học viên.`,
            });
          }
        }
      }
    } catch (err) {
      this.logger.error(
        `Lỗi xử lý thông báo QuizAttemptCompletedEvent: ${(err as Error).message}`,
      );
    }
  }

  @OnEvent(DomainEvents.PATH_COMPLETED)
  async handlePathCompleted(event: PathCompletedEvent): Promise<void> {
    try {
      const path = await this.prisma.learningPath.findUnique({
        where: { id: event.pathId },
        select: { id: true, title: true },
      });
      if (!path) return;

      await this.prisma.notification.createMany({
        data: [
          {
            userId: event.userId,
            type: NotificationType.QUIZ_PASSED,
            title: `Hoàn thành xuất sắc lộ trình: ${path.title}`,
            body: `Chúc mừng bạn đã hoàn thành 100% lộ trình đào tạo "${path.title}"! Kết quả đã được cập nhật vào Hồ sơ Năng lực cá nhân.`,
            refType: 'path',
            refId: path.id,
            dedupeKey: `path:completed:${path.id}:${event.userId}`,
          },
        ],
        skipDuplicates: true,
      });
    } catch (err) {
      this.logger.warn(
        `Lỗi tạo thông báo PathCompletedEvent: ${(err as Error).message}`,
      );
    }
  }
}
