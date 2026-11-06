import { Injectable, UnprocessableEntityException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { SubmitQuizDto } from './quiz.dto';

@Injectable()
export class QuizService {
  constructor(private prisma: PrismaService) {}

  // Nộp bài và chấm điểm tự động (BR-01 & BR-03)
  async submitQuiz(quizId: string, userId: string, submitDto: SubmitQuizDto) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: { questions: { include: { relatedLesson: true } } },
    });

    if (!quiz) throw new NotFoundException('Không tìm thấy bài thi.');

    let correctAnswersCount = 0;
    const wrongQuestions = [];
    const suggestedLessonsMap = new Map();

    // Thuật toán chấm điểm
    for (const answer of submitDto.answers) {
      const question = quiz.questions.find((q: any) => q.id === answer.questionId);
      if (!question) continue;

      if (question.correctAnswer === answer.selectedOption) {
        correctAnswersCount++;
      } else {
        wrongQuestions.push(question);
        // Gợi ý ôn tập (BR-03)
        if (question.relatedLesson) {
          suggestedLessonsMap.set(question.relatedLesson.id, {
            lessonId: question.relatedLesson.id,
            lessonTitle: question.relatedLesson.title,
          });
        }
      }
    }

    const totalQuestions = quiz.questions.length;
    const scorePercentage = totalQuestions > 0 ? (correctAnswersCount / totalQuestions) * 100 : 0;
    const isPassed = scorePercentage >= Number(quiz.passingScore); // BR-01: Điểm đạt >= 70%

    // Lấy số lần thi (Attempt Number)
    const previousAttempts = await this.prisma.quizAttempt.count({
      where: { quizId, userId },
    });
    const attemptNumber = previousAttempts + 1;

    // Lưu lượt thi vào Database
    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        score: scorePercentage,
        isPassed,
        attemptNumber,
      },
    });

    const suggestedLessons = Array.from(suggestedLessonsMap.values());

    return {
      attemptId: attempt.id,
      score: scorePercentage,
      isPassed,
      attemptNumber,
      suggestedLessons: !isPassed ? suggestedLessons : [], // Chỉ gợi ý nếu thi rớt (BR-03)
    };
  }

  // API lấy danh sách gợi ý ôn tập (BR-03)
  async getRetakeSuggestions(quizId: string, userId: string) {
    const lastAttempt = await this.prisma.quizAttempt.findFirst({
      where: { quizId, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastAttempt) throw new NotFoundException('Không tìm thấy lịch sử làm bài.');
    if (lastAttempt.isPassed) return { message: 'Bạn đã hoàn thành bài kiểm tra này.' };

    // Giả lập trả về danh sách gợi ý ôn tập từ lần thi cuối
    return {
      quizId,
      lastAttemptScore: lastAttempt.score,
      message: 'Bạn chưa đạt điểm chuẩn 70%. Hệ thống đã ghi nhận lượt thi hỏng và kích hoạt chế độ thi lại.',
      // Logic bóc tách weakConcepts và suggestedLessons sẽ mở rộng từ CSDL
      suggestedLessons: [] // Thực tế sẽ lấy từ userAnswers JSON của QuizAttempt
    };
  }
}