import { Injectable, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service.js';
import { AccessService } from '../progress/access.service.js';
import {
  DomainEvents,
  QuizAttemptCompletedEvent,
} from '../common/events/domain-events.js';
import { QuizType, RoleCode } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { SubmitQuizDto } from './quiz.dto.js';
import { CompetencyService } from '../competency/competency.service.js';

export interface SuggestedLesson {
  lessonId: string;
  lessonTitle: string;
}

@Injectable()
export class QuizService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly accessService?: AccessService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional() private readonly competencyService?: CompetencyService,
  ) { }

  async getQuizForTaking(quizId: string, actor?: AuthenticatedUser) {
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
        questions: {
          where: { deletedAt: null, isActive: true },
          select: {
            id: true,
            questionText: true,
            options: true,
            skillName: true,
            conceptTag: true,
            relatedLessonId: true,
          },
        },
      },
    });

    if (!quiz) {
      throw new NotFoundException('Không tìm thấy bài thi.');
    }

    if (actor?.role === RoleCode.EMPLOYEE && this.accessService) {
      await this.accessService.assertCanAccessQuiz(actor.id, quizId);
    }

    return quiz;
  }

  async submitQuiz(
    quizId: string,
    userId: string,
    submitDto: SubmitQuizDto,
    actor?: AuthenticatedUser,
  ) {
    if (actor?.role === RoleCode.EMPLOYEE && this.accessService) {
      await this.accessService.assertCanAccessQuiz(userId, quizId);
    }

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          where: { deletedAt: null, isActive: true },
          include: { relatedLesson: true },
        },
        module: {
          include: {
            lessons: {
              where: { deletedAt: null },
              orderBy: { lessonOrder: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!quiz) throw new NotFoundException('Không tìm thấy bài thi.');

    const { correctAnswersCount, suggestedLessons } = this.evaluateAnswers(
      quiz,
      submitDto.answers,
    );

    const totalQuestions = quiz.questions.length;
    const scorePercentage = totalQuestions > 0 ? (correctAnswersCount / totalQuestions) * 100 : 0;
    const isPassed = scorePercentage >= Number(quiz.passingScore);

    const previousAttempts = await this.prisma.quizAttempt.count({
      where: { quizId, userId },
    });
    const attemptNumber = previousAttempts + 1;

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        score: scorePercentage,
        isPassed,
        attemptNumber,
        answers: submitDto.answers as any,
        submittedAt: new Date(),
      },
    });

    if (this.eventEmitter) {
      this.eventEmitter.emit(
        DomainEvents.QUIZ_ATTEMPT_COMPLETED,
        new QuizAttemptCompletedEvent(
          attempt.id,
          userId,
          quizId,
          (quiz as any).moduleId ?? (quiz as any).module?.id ?? '',
          (quiz as any).module?.courseId ?? '',
          ((quiz as any).quizType as QuizType) ?? QuizType.MODULE,
          scorePercentage,
          isPassed,
        ),
      );
    } else if (this.competencyService) {
      // Cô lập lỗi đồng bộ competency theo WP9 9.4 khi chạy độc lập không qua EventEmitter
      await this.competencyService
        .syncCompetencyFromQuiz(userId, quizId)
        .catch(() => undefined);
    }

    return {
      attemptId: attempt.id,
      score: scorePercentage,
      isPassed,
      attemptNumber,
      suggestedLessons: !isPassed ? suggestedLessons : [],
    };
  }

  async getRetakeSuggestions(quizId: string, userId: string) {
    const lastAttempt = await this.prisma.quizAttempt.findFirst({
      where: { quizId, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastAttempt) throw new NotFoundException('Không tìm thấy lịch sử làm bài.');
    if (lastAttempt.isPassed) {
      return {
        message: 'Bạn đã hoàn thành bài kiểm tra này.',
        suggestedLessons: [],
      };
    }

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          where: { deletedAt: null, isActive: true },
          include: { relatedLesson: true },
        },
        module: {
          include: {
            lessons: {
              where: { deletedAt: null },
              orderBy: { lessonOrder: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    const savedAnswers = Array.isArray(lastAttempt.answers)
      ? (lastAttempt.answers as Array<{
          questionId: string;
          selectedOption?: string;
        }>)
      : [];

    const suggestedLessons = quiz
      ? this.evaluateAnswers(quiz, savedAnswers).suggestedLessons
      : [];

    return {
      quizId,
      lastAttemptScore: lastAttempt.score,
      message:
        'Bạn chưa đạt điểm chuẩn 70%. Hệ thống đã ghi nhận lượt thi hỏng và kích hoạt chế độ thi lại.',
      suggestedLessons,
    };
  }

  private evaluateAnswers(
    quiz: {
      questions: Array<{
        id: string;
        correctAnswer: string;
        relatedLesson?: { id: string; title: string } | null;
      }>;
      module?: { lessons?: Array<{ id: string; title: string }> } | null;
    },
    answers: Array<{
      questionId: string;
      selectedOption?: string;
    }>,
  ): { correctAnswersCount: number; suggestedLessons: SuggestedLesson[] } {
    let correctAnswersCount = 0;
    const suggestedLessonsMap = new Map<string, SuggestedLesson>();
    const fallbackLesson = quiz.module?.lessons?.[0];
    const answerByQuestionId = new Map<string, string | undefined>();

    for (const ans of answers) {
      if (!answerByQuestionId.has(ans.questionId)) {
        answerByQuestionId.set(ans.questionId, ans.selectedOption);
      }
    }

    for (const question of quiz.questions) {
      const chosenOption = answerByQuestionId.get(question.id);
      if (chosenOption !== undefined && question.correctAnswer === chosenOption) {
        correctAnswersCount++;
      } else if (question.relatedLesson) {
        suggestedLessonsMap.set(question.relatedLesson.id, {
          lessonId: question.relatedLesson.id,
          lessonTitle: question.relatedLesson.title,
        });
      } else if (fallbackLesson) {
        suggestedLessonsMap.set(fallbackLesson.id, {
          lessonId: fallbackLesson.id,
          lessonTitle: fallbackLesson.title,
        });
      }
    }

    return {
      correctAnswersCount,
      suggestedLessons: Array.from(suggestedLessonsMap.values()),
    };
  }
}