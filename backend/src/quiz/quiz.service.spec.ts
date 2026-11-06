import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { QuizService } from './quiz.service';
import { PrismaService } from '../prisma.service';

describe('QuizService', () => {
  let service: QuizService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        {
          provide: PrismaService,
          useValue: {
            quiz: { findUnique: jest.fn() },
            quizAttempt: { count: jest.fn(), create: jest.fn(), findFirst: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('BR-01: Chấm điểm bài thi và trả về isPassed = true nếu >= 70%', async () => {
    const mockQuiz = {
      id: 'quiz-1',
      passingScore: 70,
      questions: [
        { id: 'q1', correctAnswer: 'A', relatedLesson: null },
        { id: 'q2', correctAnswer: 'B', relatedLesson: null },
      ],
    };

    jest.spyOn(prisma.quiz, 'findUnique').mockResolvedValue(mockQuiz as any);
    jest.spyOn(prisma.quizAttempt, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.quizAttempt, 'create').mockResolvedValue({ id: 'att-1' } as any);

    const result = await service.submitQuiz('quiz-1', 'user-1', {
      answers: [
        { questionId: 'q1', selectedOption: 'A' },
        { questionId: 'q2', selectedOption: 'B' },
      ],
    });

    expect(result.score).toBe(100);
    expect(result.isPassed).toBe(true);
    expect(result.suggestedLessons.length).toBe(0);
  });

  it('BR-03: Kích hoạt gợi ý bài học khi điểm < 70%', async () => {
    const mockQuiz = {
      id: 'quiz-1',
      passingScore: 70,
      questions: [
        { id: 'q1', correctAnswer: 'A', relatedLesson: { id: 'les-1', title: 'Lesson 1' } },
        { id: 'q2', correctAnswer: 'B', relatedLesson: { id: 'les-2', title: 'Lesson 2' } },
      ],
    };

    jest.spyOn(prisma.quiz, 'findUnique').mockResolvedValue(mockQuiz as any);
    jest.spyOn(prisma.quizAttempt, 'count').mockResolvedValue(1); // Lượt thi thứ 2
    jest.spyOn(prisma.quizAttempt, 'create').mockResolvedValue({ id: 'att-2' } as any);

    const result = await service.submitQuiz('quiz-1', 'user-1', {
      answers: [
        { questionId: 'q1', selectedOption: 'B' }, // Sai
        { questionId: 'q2', selectedOption: 'A' }, // Sai
      ],
    });

    expect(result.score).toBe(0);
    expect(result.isPassed).toBe(false);
    expect(result.attemptNumber).toBe(2);
    expect(result.suggestedLessons.length).toBe(2); // Trả về danh sách bài học cần ôn
  });
});