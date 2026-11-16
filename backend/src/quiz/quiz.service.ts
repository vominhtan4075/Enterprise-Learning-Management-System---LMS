import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { SubmitQuizDto } from './quiz.dto.js';

export interface SuggestedLesson {
  lessonId: string;
  lessonTitle: string;
}

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  async submitQuiz(quizId: string, userId: string, submitDto: SubmitQuizDto) {
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
      },
    });

    const suggestedLessons: SuggestedLesson[] = Array.from(suggestedLessonsMap.values());

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