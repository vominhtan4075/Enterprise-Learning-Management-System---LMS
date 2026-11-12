import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { QuizService } from './quiz.service.js';
import { PrismaService } from '../prisma.service.js';

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
            lesson: { findUnique: jest.fn() },
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

  it('BR-03: Kích hoạt gợi ý bài học khi điểm < 70% kèm thông tin bài học', async () => {
    const mockQuiz = {
      id: 'quiz-1',
      passingScore: 70,
      questions: [
        { id: 'q1', correctAnswer: 'A', relatedLesson: { id: 'les-1', title: 'Lesson 1' } },
      ],
    };

    jest.spyOn(prisma.quiz, 'findUnique').mockResolvedValue(mockQuiz as any);
    jest.spyOn(prisma.quizAttempt, 'count').mockResolvedValue(0);
    jest.spyOn(prisma.quizAttempt, 'create').mockResolvedValue({ id: 'att-2' } as any);
    jest.spyOn(prisma.lesson, 'findUnique').mockResolvedValue({ id: 'les-1', title: 'Lesson 1' } as any);

    const result = await service.submitQuiz('quiz-1', 'user-1', {
      answers: [
        { questionId: 'q1', selectedOption: 'B' }, // Sai
      ],
    });

    expect(result.score).toBe(0);
    expect(result.isPassed).toBe(false);
    expect(result.attemptNumber).toBe(1);
    expect(result.suggestedLessons.length).toBe(1);
    expect(result.suggestedLessons[0].lessonId).toBe('les-1');
  });
});