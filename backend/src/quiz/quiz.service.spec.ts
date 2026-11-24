import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { QuizService } from './quiz.service.js';
import { PrismaService } from '../prisma.service.js';
import { PositionLevel, QuizType, RoleCode } from '../generated/prisma/enums.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

interface MockPrisma {
  module: { findFirst: jest.Mock<(...args: any[]) => Promise<any>> };
  quiz: {
    findUnique: jest.Mock<(...args: any[]) => Promise<any>>;
    create: jest.Mock<(...args: any[]) => Promise<any>>;
    update: jest.Mock<(...args: any[]) => Promise<any>>;
    delete: jest.Mock<(...args: any[]) => Promise<any>>;
  };
  question: {
    count: jest.Mock<(...args: any[]) => Promise<any>>;
    create: jest.Mock<(...args: any[]) => Promise<any>>;
    findFirst: jest.Mock<(...args: any[]) => Promise<any>>;
    update: jest.Mock<(...args: any[]) => Promise<any>>;
    deleteMany: jest.Mock<(...args: any[]) => Promise<any>>;
  };
  quizAttempt: {
    count: jest.Mock<(...args: any[]) => Promise<any>>;
    create: jest.Mock<(...args: any[]) => Promise<any>>;
    findFirst: jest.Mock<(...args: any[]) => Promise<any>>;
    findMany: jest.Mock<(...args: any[]) => Promise<any>>;
    deleteMany: jest.Mock<(...args: any[]) => Promise<any>>;
  };
  lesson: {
    findUnique: jest.Mock<(...args: any[]) => Promise<any>>;
    findFirst: jest.Mock<(...args: any[]) => Promise<any>>;
  };
  pathEnrollment: {
    count: jest.Mock<(...args: any[]) => Promise<any>>;
  };
  $transaction: jest.Mock<(...args: any[]) => Promise<any>>;
}

describe('QuizService', () => {
  let service: QuizService;
  let prisma: MockPrisma;

  const trainerActor: AuthenticatedUser = {
    id: 'trainer-1',
    email: 'trainer@novatech.com',
    fullName: 'Giảng Viên Test',
    role: RoleCode.TRAINER,
    position: PositionLevel.SENIOR,
    department: 'Engineering',
    mustChangePassword: false,
    tokenVersion: 0,
  };

  beforeEach(async () => {
    const prismaMock: MockPrisma = {
      module: { findFirst: jest.fn<(...args: any[]) => Promise<any>>() },
      quiz: {
        findUnique: jest.fn<(...args: any[]) => Promise<any>>(),
        create: jest.fn<(...args: any[]) => Promise<any>>(),
        update: jest.fn<(...args: any[]) => Promise<any>>(),
        delete: jest.fn<(...args: any[]) => Promise<any>>(),
      },
      question: {
        count: jest.fn<(...args: any[]) => Promise<any>>(),
        create: jest.fn<(...args: any[]) => Promise<any>>(),
        findFirst: jest.fn<(...args: any[]) => Promise<any>>(),
        update: jest.fn<(...args: any[]) => Promise<any>>(),
        deleteMany: jest.fn<(...args: any[]) => Promise<any>>(),
      },
      quizAttempt: {
        count: jest.fn<(...args: any[]) => Promise<any>>(),
        create: jest.fn<(...args: any[]) => Promise<any>>(),
        findFirst: jest.fn<(...args: any[]) => Promise<any>>(),
        findMany: jest
          .fn<(...args: any[]) => Promise<any>>()
          .mockResolvedValue([]),
        deleteMany: jest.fn<(...args: any[]) => Promise<any>>(),
      },
      lesson: {
        findUnique: jest.fn<(...args: any[]) => Promise<any>>(),
        findFirst: jest.fn<(...args: any[]) => Promise<any>>(),
      },
      pathEnrollment: {
        count: jest.fn<(...args: any[]) => Promise<any>>(),
      },
      $transaction: jest.fn<(...args: any[]) => Promise<any>>(
        async (cb: (tx: MockPrisma) => Promise<any>): Promise<any> =>
          cb(prismaMock),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuizService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<QuizService>(QuizService);
    prisma = module.get(PrismaService);
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

    prisma.quiz.findUnique.mockResolvedValue(mockQuiz);
    prisma.quizAttempt.count.mockResolvedValue(0);
    prisma.quizAttempt.create.mockResolvedValue({ id: 'att-1' });

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
        {
          id: 'q1',
          correctAnswer: 'A',
          relatedLesson: { id: 'les-1', title: 'Lesson 1' },
        },
      ],
    };

    prisma.quiz.findUnique.mockResolvedValue(mockQuiz);
    prisma.quizAttempt.count.mockResolvedValue(0);
    prisma.quizAttempt.create.mockResolvedValue({ id: 'att-2' });

    const result = await service.submitQuiz('quiz-1', 'user-1', {
      answers: [{ questionId: 'q1', selectedOption: 'B' }],
    });

    expect(result.isPassed).toBe(false);
    expect(result.suggestedLessons.length).toBe(1);
    expect(result.suggestedLessons[0].lessonId).toBe('les-1');
  });

  it('BR-03: Xử lý fallback bài học đầu tiên của Module khi relatedLesson bị null', async () => {
    const mockQuiz = {
      id: 'quiz-1',
      passingScore: 70,
      module: {
        lessons: [{ id: 'fallback-les-1', title: 'Fallback Lesson 1' }],
      },
      questions: [{ id: 'q1', correctAnswer: 'A', relatedLesson: null }],
    };

    prisma.quiz.findUnique.mockResolvedValue(mockQuiz);
    prisma.quizAttempt.count.mockResolvedValue(0);
    prisma.quizAttempt.create.mockResolvedValue({ id: 'att-3' });

    const result = await service.submitQuiz('quiz-1', 'user-1', {
      answers: [{ questionId: 'q1', selectedOption: 'B' }],
    });

    expect(result.isPassed).toBe(false);
    expect(result.suggestedLessons.length).toBe(1);
    expect(result.suggestedLessons[0].lessonId).toBe('fallback-les-1');
  });

  it('BR-03: getRetakeSuggestions trả về đúng danh sách bài ôn từ câu sai (kèm fallback bài đầu module)', async () => {
    prisma.quizAttempt.findFirst.mockResolvedValue({
      id: 'att-fail',
      score: 0,
      isPassed: false,
      answers: [
        { questionId: 'q1', selectedOption: 'WRONG' },
        { questionId: 'q2', selectedOption: 'WRONG' },
      ],
    });

    prisma.quiz.findUnique.mockResolvedValue({
      id: 'quiz-1',
      module: {
        lessons: [{ id: 'fallback-les-1', title: 'Fallback Lesson 1' }],
      },
      questions: [
        {
          id: 'q1',
          correctAnswer: 'A',
          relatedLesson: { id: 'les-1', title: 'Lesson 1' },
        },
        {
          id: 'q2',
          correctAnswer: 'B',
          relatedLesson: null,
        },
      ],
    });

    const res = await service.getRetakeSuggestions('quiz-1', 'user-1');

    expect(res.suggestedLessons).toEqual([
      { lessonId: 'les-1', lessonTitle: 'Lesson 1' },
      { lessonId: 'fallback-les-1', lessonTitle: 'Fallback Lesson 1' },
    ]);
  });

  it('CRUD Quiz: Tạo mới đề thi thành công cho module chưa có quiz và chặn trùng 1-1 (409)', async () => {
    prisma.module.findFirst.mockResolvedValueOnce({
      id: 'mod-1',
      course: { id: 'course-1', createdById: 'trainer-1', deletedAt: null },
      quiz: null,
    });
    prisma.quiz.create.mockResolvedValueOnce({
      id: 'quiz-new',
      moduleId: 'mod-1',
      title: 'Quiz 1',
      quizType: QuizType.MODULE,
      isPublished: false,
    });

    const created = await service.createQuizForModule(
      'mod-1',
      { title: 'Quiz 1' },
      trainerActor,
    );
    expect(created.id).toBe('quiz-new');

    prisma.module.findFirst.mockResolvedValueOnce({
      id: 'mod-1',
      course: { id: 'course-1', createdById: 'trainer-1', deletedAt: null },
      quiz: { id: 'quiz-new' },
    });

    await expect(
      service.createQuizForModule('mod-1', { title: 'Quiz 2' }, trainerActor),
    ).rejects.toMatchObject({ status: 409 });
  });

  it('CRUD Quiz: Chặn xuất bản đề thi chưa có câu hỏi hoạt động (422)', async () => {
    prisma.quiz.findUnique.mockResolvedValueOnce({
      id: 'quiz-1',
      module: {
        id: 'mod-1',
        deletedAt: null,
        course: { id: 'course-1', createdById: 'trainer-1', deletedAt: null },
      },
    });
    prisma.question.count.mockResolvedValueOnce(0);

    await expect(
      service.updateQuiz('quiz-1', { isPublished: true }, trainerActor),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('CRUD Question: Kiểm tra correctAnswer phải khớp với options[].key (400)', async () => {
    prisma.quiz.findUnique.mockResolvedValueOnce({
      id: 'quiz-1',
      module: {
        id: 'mod-1',
        deletedAt: null,
        course: { id: 'course-1', createdById: 'trainer-1', deletedAt: null },
      },
    });

    await expect(
      service.createQuestion(
        'quiz-1',
        {
          questionText: 'Java hỗ trợ đa kế thừa class không?',
          options: [
            { key: 'A', text: 'Có' },
            { key: 'B', text: 'Không' },
          ],
          correctAnswer: 'C',
        },
        trainerActor,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('CRUD Question: Chặn xóa mềm câu hỏi active cuối cùng của đề đang xuất bản (422) và cho phép xóa khi còn câu khác', async () => {
    prisma.question.findFirst.mockResolvedValueOnce({
      id: 'q-last',
      quizId: 'quiz-1',
      isActive: true,
      quiz: {
        isPublished: true,
        module: {
          deletedAt: null,
          course: { id: 'course-1', createdById: 'trainer-1', deletedAt: null },
        },
      },
    });
    prisma.question.count.mockResolvedValueOnce(0);

    await expect(
      service.deleteQuestion('q-last', trainerActor),
    ).rejects.toMatchObject({ status: 422 });

    prisma.question.findFirst.mockResolvedValueOnce({
      id: 'q-1',
      quizId: 'quiz-1',
      isActive: true,
      quiz: {
        isPublished: true,
        module: {
          deletedAt: null,
          course: { id: 'course-1', createdById: 'trainer-1', deletedAt: null },
        },
      },
    });
    prisma.question.count.mockResolvedValueOnce(2);
    prisma.question.update.mockResolvedValueOnce({ id: 'q-1' });

    const deleted = await service.deleteQuestion('q-1', trainerActor);
    expect(deleted.id).toBe('q-1');
  });

  it('RBAC GET /quizzes/:id: EMPLOYEE nhận đề thi ẩn đáp án kèm thống kê lượt thi; chủ khóa học TRAINER nhận đầy đủ correctAnswer để biên soạn', async () => {
    const fullQuizRecord = {
      id: 'quiz-1',
      moduleId: 'mod-1',
      title: 'Quiz 1',
      maxAttempts: 3,
      module: {
        id: 'mod-1',
        title: 'Module 1',
        moduleOrder: 1,
        courseId: 'course-1',
        deletedAt: null,
        course: {
          id: 'course-1',
          code: 'JAVA_01',
          title: 'Java Core',
          createdById: 'trainer-1',
          deletedAt: null,
        },
      },
      questions: [
        {
          id: 'q1',
          questionText: 'Câu 1',
          options: [
            { key: 'A', text: 'A' },
            { key: 'B', text: 'B' },
          ],
          correctAnswer: 'A',
          explanation: 'Giải thích câu 1',
          skillName: 'Java',
          conceptTag: null,
          relatedLessonId: null,
          isActive: true,
        },
        {
          id: 'q2',
          questionText: 'Câu 2 (ẩn)',
          options: [
            { key: 'A', text: 'A' },
            { key: 'B', text: 'B' },
          ],
          correctAnswer: 'B',
          explanation: 'Giải thích câu 2',
          skillName: 'Java',
          conceptTag: null,
          relatedLessonId: null,
          isActive: false,
        },
      ],
      _count: { quizAttempts: 5 },
    };

    prisma.quiz.findUnique.mockResolvedValueOnce(fullQuizRecord);
    prisma.quizAttempt.findMany.mockResolvedValueOnce([
      { score: 50, isPassed: false },
    ]);
    const employeeView: any = await service.getQuizForTaking('quiz-1', {
      ...trainerActor,
      id: 'emp-1',
      role: RoleCode.EMPLOYEE,
    });
    expect(employeeView.questions).toHaveLength(1);
    expect(employeeView.questions[0].correctAnswer).toBeUndefined();
    expect(employeeView.questions[0].explanation).toBeUndefined();
    expect(employeeView.attemptsUsed).toBe(1);
    expect(employeeView.remainingAttempts).toBe(2);
    expect(employeeView.bestScore).toBe(50);
    expect(employeeView.hasPassed).toBe(false);

    prisma.quiz.findUnique.mockResolvedValueOnce(fullQuizRecord);
    const trainerView: any = await service.getQuizForTaking(
      'quiz-1',
      trainerActor,
    );
    expect(trainerView.questions).toHaveLength(2);
    expect(trainerView.questions[0].correctAnswer).toBe('A');
    expect(trainerView._count.quizAttempts).toBe(5);
  });

  it('BR-Quiz: Chặn nộp bài với 422 QUIZ_MAX_ATTEMPTS_REACHED khi học viên đã hết số lượt tối đa', async () => {
    prisma.quiz.findUnique.mockResolvedValueOnce({
      id: 'quiz-1',
      passingScore: 70,
      maxAttempts: 3,
      questions: [{ id: 'q1', correctAnswer: 'A', relatedLesson: null }],
    });
    prisma.quizAttempt.count.mockResolvedValueOnce(3);

    await expect(
      service.submitQuiz('quiz-1', 'emp-1', {
        answers: [{ questionId: 'q1', selectedOption: 'A' }],
      }),
    ).rejects.toMatchObject({
      errorCode: 'QUIZ_MAX_ATTEMPTS_REACHED',
      status: 422,
    });
  });

  it('deleteQuiz: TRAINER xóa được Quiz nháp chưa có lượt thi dù khóa học thuộc lộ trình; ADMIN xóa được cả Quiz đã có lượt thi', async () => {
    const draftQuiz = {
      id: 'quiz-draft',
      isPublished: false,
      module: {
        id: 'mod-1',
        deletedAt: null,
        courseId: 'course-1',
        course: { id: 'course-1', createdById: 'trainer-1', deletedAt: null },
      },
    };
    prisma.quiz.findUnique.mockResolvedValueOnce(draftQuiz);
    prisma.quizAttempt.count.mockResolvedValueOnce(0);
    prisma.pathEnrollment.count.mockResolvedValueOnce(10);

    const resTrainer = await service.deleteQuiz('quiz-draft', trainerActor);
    expect(resTrainer.id).toBe('quiz-draft');

    const activeQuizWithAttempts = {
      ...draftQuiz,
      id: 'quiz-with-attempts',
      isPublished: true,
    };
    prisma.quiz.findUnique.mockResolvedValueOnce(activeQuizWithAttempts);
    prisma.quizAttempt.count.mockResolvedValueOnce(5);

    await expect(
      service.deleteQuiz('quiz-with-attempts', trainerActor),
    ).rejects.toMatchObject({ status: 422 });

    prisma.quiz.findUnique.mockResolvedValueOnce(activeQuizWithAttempts);
    const resAdmin = await service.deleteQuiz('quiz-with-attempts', {
      ...trainerActor,
      id: 'admin-1',
      role: RoleCode.ADMIN,
    });
    expect(resAdmin.id).toBe('quiz-with-attempts');
    expect(prisma.quizAttempt.deleteMany).toHaveBeenCalledWith({
      where: { quizId: 'quiz-with-attempts' },
    });
  });
});
