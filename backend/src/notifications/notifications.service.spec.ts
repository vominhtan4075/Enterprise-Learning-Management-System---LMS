import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import {
  buildReminderDedupeKey,
  calcReminderKind,
} from './reminder.helper.js';
import { NotificationsService } from './notifications.service.js';
import { MailService } from './mail.service.js';
import { PrismaService } from '../prisma.service.js';
import { QuizAttemptCompletedEvent } from '../common/events/domain-events.js';
import {
  NotificationType,
  PositionLevel,
  QuizType,
  RoleCode,
} from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

describe('WP10 – Notifications & Deadline Reminders', () => {
  describe('reminder.helper – calcReminderKind & buildReminderDedupeKey', () => {
    const now = new Date('2026-11-18T08:00:00Z');

    it('nên phân loại chính xác các mốc D-3, D-1, D-0, OVERDUE và null', () => {
      expect(
        calcReminderKind(new Date(now.getTime() + 5 * 86_400_000), now),
      ).toBeNull();
      expect(
        calcReminderKind(new Date(now.getTime() + 60 * 3_600_000), now),
      ).toBe('D-3');
      expect(
        calcReminderKind(new Date(now.getTime() + 36 * 3_600_000), now),
      ).toBe('D-1');
      expect(
        calcReminderKind(new Date(now.getTime() + 12 * 3_600_000), now),
      ).toBe('D-0');
      expect(
        calcReminderKind(new Date(now.getTime() - 1_000), now),
      ).toBe('OVERDUE');
    });

    it('nên sinh dedupeKey mới khi ngày deadline được gia hạn sang ngày khác', () => {
      const k1 = buildReminderDedupeKey(
        'enr-1',
        'D-3',
        new Date('2026-11-20T23:59:59Z'),
        'emp-1',
      );
      const k2 = buildReminderDedupeKey(
        'enr-1',
        'D-3',
        new Date('2026-11-30T23:59:59Z'),
        'emp-1',
      );
      expect(k1).not.toBe(k2);
    });
  });

  describe('NotificationsService', () => {
    let service: NotificationsService;
    let prismaMock: any;
    let mailServiceMock: {
      sendMailSafe: ReturnType<typeof jest.fn>;
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
      prismaMock = {
        notification: {
          findMany: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          findUnique: jest.fn(),
          update: jest.fn(),
          updateMany: jest.fn().mockResolvedValue({ count: 3 }),
          createMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        courseEnrollment: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
        },
        pathEnrollment: {
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn(),
        },
        user: {
          findUnique: jest.fn(),
          findMany: jest.fn().mockResolvedValue([]),
        },
        quiz: {
          findUnique: jest.fn(),
        },
      };

      mailServiceMock = {
        sendMailSafe: jest.fn().mockResolvedValue(true as never),
      };

      service = new NotificationsService(
        prismaMock as unknown as PrismaService,
        mailServiceMock as unknown as MailService,
      );
    });

    it('chặn đọc thông báo của người dùng khác -> 404 NOT_FOUND', async () => {
      prismaMock.notification.findUnique.mockResolvedValue({
        id: 'notif-1',
        userId: 'other-user',
        readAt: null,
      });

      await expect(
        service.markAsRead('notif-1', employeeUser),
      ).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
        status: 404,
      });
    });

    it('runDeadlineRemindersJob: đánh dấu OVERDUE và tạo thông báo ENROLLMENT_OVERDUE cho cả học viên lẫn người giao', async () => {
      const now = new Date('2026-11-18T08:00:00Z');
      prismaMock.pathEnrollment.findMany.mockResolvedValue([
        {
          id: 'pe-1',
          deadline: new Date('2026-11-15T23:59:59Z'),
          user: {
            id: 'emp-1',
            email: 'emp1@novatech.com',
            fullName: 'Emp 1',
          },
          learningPath: {
            id: 'path-1',
            code: 'path-fresher-java',
            title: 'Onboarding Fresher Java',
          },
          assignedBy: {
            id: 'trainer-1',
            email: 'trainer@novatech.com',
            fullName: 'Trainer 1',
          },
        },
      ]);

      const res = await service.runDeadlineRemindersJob(now);

      expect(res.overdueMarked).toBe(1);
      expect(prismaMock.pathEnrollment.update).toHaveBeenCalledWith({
        where: { id: 'pe-1' },
        data: { status: 'OVERDUE' },
      });
      expect(prismaMock.notification.createMany).toHaveBeenCalled();
    });

    it('handleQuizAttemptCompleted: khi trượt bài thi FINAL (isPassed=false) phải gửi FINAL_FAILED_ALERT tới Trainer đã giao và toàn bộ HR ([W2] bước 6)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'emp-1',
        fullName: 'Nguyễn Văn Huấn',
        email: 'huan.nguyen@novatech.com',
        department: 'Backend Division',
      });
      prismaMock.quiz.findUnique.mockResolvedValue({
        id: 'quiz-final-1',
        title: 'Kiểm tra Tổng hợp Onboarding',
        quizType: QuizType.FINAL,
      });
      // Lần 1: tìm danh sách HR; Lần 2: tìm thông tin Trainer đã giao
      prismaMock.user.findMany
        .mockResolvedValueOnce([
          { id: 'hr-1', email: 'hr@novatech.com', fullName: 'HR Specialist' },
        ])
        .mockResolvedValueOnce([
          {
            id: 'trainer-1',
            email: 'trainer@novatech.com',
            fullName: 'Trainer 1',
          },
        ]);
      prismaMock.pathEnrollment.findMany.mockResolvedValue([
        { assignedById: 'trainer-1' },
      ]);

      const event = new QuizAttemptCompletedEvent(
        'att-99',
        'emp-1',
        'quiz-final-1',
        'mod-final',
        'course-final',
        QuizType.FINAL,
        50,
        false,
      );

      await service.handleQuizAttemptCompleted(event);

      // Lần 1: tạo QUIZ_FAILED cho học viên; Lần 2: tạo FINAL_FAILED_ALERT cho HR + Trainer
      expect(prismaMock.notification.createMany).toHaveBeenCalledTimes(2);
      const secondCallArgs =
        prismaMock.notification.createMany.mock.calls[1][0];
      expect(secondCallArgs.data).toHaveLength(2);
      expect(secondCallArgs.data[0].type).toBe(
        NotificationType.FINAL_FAILED_ALERT,
      );
      expect(mailServiceMock.sendMailSafe).toHaveBeenCalledTimes(2);
    });
  });
});
