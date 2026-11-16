import { QuizType } from '../../generated/prisma/client.js';

export const DomainEvents = {
  LESSON_COMPLETED: 'lesson.completed',
  MODULE_COMPLETED: 'module.completed',
  PATH_COMPLETED: 'path.completed',
  ENROLLMENT_CREATED: 'enrollment.created',
  QUIZ_ATTEMPT_COMPLETED: 'quiz.attempt.completed',
  USER_SYNCED_FROM_HRM: 'user.synced.hrm',
} as const;

export class LessonCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly lessonId: string,
    public readonly moduleId: string,
    public readonly courseId: string,
    public readonly completedAt: Date = new Date(),
  ) {}
}

export class ModuleCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly moduleId: string,
    public readonly courseId: string,
    public readonly completedAt: Date = new Date(),
  ) {}
}

export class PathCompletedEvent {
  constructor(
    public readonly userId: string,
    public readonly pathId: string,
    public readonly completedAt: Date = new Date(),
  ) {}
}

export class EnrollmentCreatedEvent {
  constructor(
    public readonly userIds: string[],
    public readonly targetType: 'COURSE' | 'PATH',
    public readonly targetId: string,
    public readonly targetTitle: string,
    public readonly deadline: Date,
    public readonly assignedById?: string,
  ) {}
}

export class QuizAttemptCompletedEvent {
  constructor(
    public readonly attemptId: string,
    public readonly userId: string,
    public readonly quizId: string,
    public readonly moduleId: string,
    public readonly courseId: string,
    public readonly quizType: QuizType,
    public readonly score: number,
    public readonly isPassed: boolean,
    public readonly completedAt: Date = new Date(),
  ) {}
}

export class UserSyncedFromHrmEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
    public readonly fullName: string,
    public readonly assignedPathId: string | null,
    public readonly temporaryPassword?: string,
  ) {}
}

