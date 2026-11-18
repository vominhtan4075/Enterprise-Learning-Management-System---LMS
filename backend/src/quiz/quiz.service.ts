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
  ) {}

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
        questions: { include: { relatedLesson: true } },
        module: { 
          include: { 
            lessons: { orderBy: { lessonOrder: 'asc' }, take: 1 } 
          } 
        }
      },
    });

    if (!quiz) throw new NotFoundException('Không tìm thấy bài thi.');

    let correctAnswersCount = 0;
    const suggestedLessonsMap = new Map<string, SuggestedLesson>();
    const fallbackLesson = quiz.module?.lessons?.[0]; // Lấy bài học đầu tiên

    for (const answer of submitDto.answers) {
      const question = quiz.questions.find((q: any) => q.id === answer.questionId);
      if (!question) continue;

      if (question.correctAnswer === answer.selectedOption) {
        correctAnswersCount++;
      } else {
        const typedQuestion = question as any;
        
        // Thuật toán fallback bài học mặc định (BR-03)
        if (typedQuestion.relatedLesson) {
          suggestedLessonsMap.set(typedQuestion.relatedLesson.id, {
            lessonId: typedQuestion.relatedLesson.id,
            lessonTitle: typedQuestion.relatedLesson.title,
          });
        } else if (fallbackLesson) {
          suggestedLessonsMap.set(fallbackLesson.id, {
            lessonId: fallbackLesson.id,
            lessonTitle: fallbackLesson.title,
          });
        }
      }
    }

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

    const suggestedLessons: SuggestedLesson[] = Array.from(suggestedLessonsMap.values());

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
    if (lastAttempt.isPassed) return { message: 'Bạn đã hoàn thành bài kiểm tra này.' };

    return {
      quizId,
      lastAttemptScore: lastAttempt.score,
      message: 'Bạn chưa đạt điểm chuẩn 70%. Hệ thống đã ghi nhận lượt thi hỏng và kích hoạt chế độ thi lại.',
      suggestedLessons: [],
    };
  }
}