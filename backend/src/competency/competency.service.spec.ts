import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  CompetencyService,
  PositionCompetencySummary,
} from './competency.service.js';
import {
  ALL_POSITIONS,
  evaluateCompetency,
  normalizeSkillName,
  PositionEnum,
  roundScore,
} from './competency.constants.js';
import { CompetencyMatrixQueryDto } from './dto/competency-query.dto.js';
import { PrismaService } from '../prisma.service.js';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

describe('CompetencyService & CompetencyConstants', () => {
  let service: CompetencyService;
  let prisma: {
    quiz: { findUnique: AsyncMock };
    quizAttempt: { findMany: AsyncMock };
    competencyMatrix: { upsert: AsyncMock };
    module: { findMany: AsyncMock };
    user: { findMany: AsyncMock };
  };
  let redis: {
    get: AsyncMock;
    set: AsyncMock;
    del: AsyncMock;
    keys?: AsyncMock;
  };

  beforeEach(async () => {
    const createAsyncMock = (): AsyncMock => jest.fn<(...args: any[]) => Promise<any>>();

    prisma = {
      quiz: { findUnique: createAsyncMock() },
      quizAttempt: { findMany: createAsyncMock() },
      competencyMatrix: { upsert: createAsyncMock() },
      module: { findMany: createAsyncMock() },
      user: { findMany: createAsyncMock() },
    };

    redis = {
      get: createAsyncMock(),
      set: createAsyncMock(),
      del: createAsyncMock(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompetencyService,
        { provide: PrismaService, useValue: prisma },
        { provide: 'REDIS_CLIENT', useValue: redis },
      ],
    }).compile();

    service = module.get<CompetencyService>(CompetencyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Pure Helpers & Query DTO', () => {
    it('khởi tạo CompetencyMatrixQueryDto hợp lệ', () => {
      const dto = new CompetencyMatrixQueryDto();
      dto.departmentId = 'Engineering';
      dto.learningPathId = 'path-1';
      dto.position = PositionEnum.JUNIOR;

      expect(dto.position).toBe(PositionEnum.JUNIOR);
    });

    it('kiểm tra danh sách 5 cấp bậc chuẩn ALL_POSITIONS và hàm roundScore()', () => {
      expect(ALL_POSITIONS).toEqual(['INTERN', 'FRESHER', 'JUNIOR', 'SENIOR', 'LEAD']);
      expect(roundScore(69.99999999999999)).toBe(70);
      expect(roundScore(69.99)).toBe(69.99);
      expect(roundScore(84.236)).toBe(84.24);
      expect(roundScore(Number.NaN)).toBe(0);
      expect(roundScore(Number.POSITIVE_INFINITY)).toBe(0);
    });

    it('chuẩn hóa tên kỹ năng từ tiêu đề Học phần / Module và Taxonomy khóa học mới', () => {
      expect(normalizeSkillName('Học phần 1: Java Core & Spring Boot')).toBe(
        'Java Core & Spring Boot',
      );
      expect(normalizeSkillName('Module 2 - PostgreSQL & RESTful API')).toBe(
        'PostgreSQL & RESTful API',
      );
      expect(normalizeSkillName('Docker & Redis')).toBe('Docker & Redis');
      expect(normalizeSkillName('Chương 3: React & Next.js App Router')).toBe(
        'React & Next.js Frontend',
      );
      expect(normalizeSkillName('Cloud Computing AWS & Kubernetes')).toBe(
        'Cloud Infrastructure & DevOps',
      );
      expect(normalizeSkillName('Application Security & OWASP')).toBe(
        'Application Security & Auth',
      );
      expect(normalizeSkillName('Playwright E2E & CI/CD')).toBe(
        'Automated Testing & CI/CD',
      );
      expect(normalizeSkillName('Học phần 5: Agile Scrum')).toBe('Agile Scrum');
      expect(normalizeSkillName('   ')).toBe('General Engineering');
    });

    it('đánh giá chính xác PASSED / GAP / NOT_ASSESSED và mức độ thành thạo cho cả 5 cấp bậc', () => {
      expect(evaluateCompetency(null, PositionEnum.FRESHER)).toEqual({
        requiredScore: 70,
        status: 'NOT_ASSESSED',
        level: 'UNRATED',
        gapDelta: -70,
      });
      expect(evaluateCompetency(82, PositionEnum.INTERN)).toEqual({
        requiredScore: 60,
        status: 'PASSED',
        level: 'ADVANCED',
        gapDelta: 22,
      });
      expect(evaluateCompetency(70, PositionEnum.FRESHER)).toEqual({
        requiredScore: 70,
        status: 'PASSED',
        level: 'PROFICIENT',
        gapDelta: 0,
      });
      expect(evaluateCompetency(65, PositionEnum.FRESHER)).toEqual({
        requiredScore: 70,
        status: 'GAP',
        level: 'NEEDS_IMPROVEMENT',
        gapDelta: -5,
      });
      // Vá lỗi UAT: 69.99 không bị làm tròn 1 chữ số thành 70.0 để lọt ngưỡng Fresher
      expect(evaluateCompetency(69.99, PositionEnum.FRESHER)).toEqual({
        requiredScore: 70,
        status: 'GAP',
        level: 'NEEDS_IMPROVEMENT',
        gapDelta: -0.01,
      });
      expect(evaluateCompetency(74.9, PositionEnum.JUNIOR).status).toBe('GAP');
      expect(evaluateCompetency(85, PositionEnum.SENIOR).status).toBe('PASSED');
      expect(evaluateCompetency(96.9, PositionEnum.SENIOR).level).toBe('PROFICIENT');
      expect(evaluateCompetency(97, PositionEnum.LEAD).level).toBe('ADVANCED');
      expect(evaluateCompetency(88, PositionEnum.LEAD).status).toBe('GAP');
      // Fallback ngưỡng mặc định 70 nếu position không xác định
      expect(evaluateCompetency(72, 'UNKNOWN' as PositionEnum).requiredScore).toBe(70);
    });
  });

  describe('handleQuizAttemptCompleted & syncCompetencyFromQuiz', () => {
    it('handleQuizAttemptCompleted gọi đồng bộ thành công và bắt lỗi an toàn khi có ngoại lệ', async () => {
      prisma.quiz.findUnique.mockResolvedValueOnce({
        id: 'quiz-1',
        module: { title: 'Học phần 1: Java Core' },
      });
      prisma.quizAttempt.findMany.mockResolvedValueOnce([{ score: 80 }]);
      prisma.competencyMatrix.upsert.mockResolvedValueOnce({ proficiencyScore: 80 });

      await expect(
        service.handleQuizAttemptCompleted({
          userId: 'u-1',
          quizId: 'quiz-1',
          attemptId: 'att-1',
          score: 80,
          isPassed: true,
        } as any),
      ).resolves.toBeUndefined();

      // Khi quiz không tồn tại, event handler không làm crash luồng sự kiện
      prisma.quiz.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.handleQuizAttemptCompleted({
          userId: 'u-1',
          quizId: 'quiz-404',
          attemptId: 'att-2',
          score: 80,
          isPassed: true,
        } as any),
      ).resolves.toBeUndefined();
    });

    it('ném NotFoundException nếu Quiz hoặc Module không tồn tại', async () => {
      prisma.quiz.findUnique.mockResolvedValue(null);

      await expect(service.syncCompetencyFromQuiz('u-1', 'quiz-404')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('trả về null nếu học viên chưa có lượt thi QuizAttempt nào', async () => {
      prisma.quiz.findUnique.mockResolvedValue({
        id: 'quiz-1',
        module: { title: 'Học phần 1: Java Core' },
      });
      prisma.quizAttempt.findMany.mockResolvedValue([]);

      const result = await service.syncCompetencyFromQuiz('u-1', 'quiz-1');
      expect(result).toBeNull();
      expect(prisma.competencyMatrix.upsert).not.toHaveBeenCalled();
    });

    it('chọn điểm cao nhất từ nhiều lượt thi (Retake), upsert CompetencyMatrix và xóa cache', async () => {
      prisma.quiz.findUnique.mockResolvedValue({
        id: 'quiz-1',
        module: { title: 'Học phần 1: Java Core' },
      });
      prisma.quizAttempt.findMany.mockResolvedValue([
        { score: 50.0 },
        { score: 85.5 },
        { score: 80.0 },
      ]);
      prisma.competencyMatrix.upsert.mockResolvedValue({
        id: 'cm-1',
        userId: 'u-1',
        skillName: 'Java Core & Spring Boot',
        proficiencyScore: 85.5,
      });

      const result = await service.syncCompetencyFromQuiz('u-1', 'quiz-1');

      expect(prisma.competencyMatrix.upsert).toHaveBeenCalledWith({
        where: {
          userId_skillName: { userId: 'u-1', skillName: 'Java Core & Spring Boot' },
        },
        update: { proficiencyScore: 85.5 },
        create: {
          userId: 'u-1',
          skillName: 'Java Core & Spring Boot',
          proficiencyScore: 85.5,
        },
      });
      expect(redis.del).toHaveBeenCalledWith('lms:reports:competency-matrix:all:all:all');
      expect(result?.proficiencyScore).toBe(85.5);
    });

    it('tính trung bình MAX(score) của nhiều Quiz khác nhau thuộc cùng một nhóm kỹ năng', async () => {
      prisma.quiz.findUnique.mockResolvedValue({
        id: 'quiz-react-2',
        module: { title: 'Học phần 2: React Hooks nâng cao' },
      });
      prisma.quizAttempt.findMany.mockResolvedValue([
        // Quiz React 1: thi 2 lần (60 -> 80) => MAX = 80
        { quizId: 'quiz-react-1', score: 60, quiz: { module: { title: 'React Basics' } } },
        { quizId: 'quiz-react-1', score: 80, quiz: { module: { title: 'React Basics' } } },
        // Quiz React 2: thi 1 lần (90) => MAX = 90
        {
          quizId: 'quiz-react-2',
          score: 90,
          quiz: { module: { title: 'Học phần 2: React Hooks nâng cao' } },
        },
        // Quiz thuộc kỹ năng khác (Java) => bỏ qua khi đồng bộ React
        { quizId: 'quiz-java-1', score: 100, quiz: { module: { title: 'Java Core' } } },
      ]);
      prisma.competencyMatrix.upsert.mockResolvedValue({
        userId: 'u-1',
        skillName: 'React & Next.js Frontend',
        proficiencyScore: 85,
      });

      const result = await service.syncCompetencyFromQuiz('u-1', 'quiz-react-2');

      expect(prisma.competencyMatrix.upsert).toHaveBeenCalledWith({
        where: {
          userId_skillName: { userId: 'u-1', skillName: 'React & Next.js Frontend' },
        },
        update: { proficiencyScore: 85 },
        create: {
          userId: 'u-1',
          skillName: 'React & Next.js Frontend',
          proficiencyScore: 85,
        },
      });
      expect(result?.proficiencyScore).toBe(85);
    });

    it('hoạt động bình thường khi không cấu hình Redis', async () => {
      const serviceWithoutRedis = new CompetencyService(prisma as unknown as PrismaService);
      prisma.quiz.findUnique.mockResolvedValue({
        id: 'quiz-1',
        module: { title: 'Học phần 1: Java Core' },
      });
      prisma.quizAttempt.findMany.mockResolvedValue([{ score: 78 }]);
      prisma.competencyMatrix.upsert.mockResolvedValue({ proficiencyScore: 78 });

      const result = await serviceWithoutRedis.syncCompetencyFromQuiz('u-1', 'quiz-1');
      expect(result?.proficiencyScore).toBe(78);
    });
  });

  describe('recalculateAllCompetencies', () => {
    it('tổng hợp MAX(score) trên từng Quiz và tính trung bình theo nhóm kỹ năng cho toàn bộ nhân sự', async () => {
      prisma.quizAttempt.findMany.mockResolvedValue([
        {
          userId: 'u-1',
          quizId: 'q-java-1',
          score: 90,
          quiz: { module: { title: 'Học phần 1: Java Core' } },
        },
        {
          userId: 'u-1',
          quizId: 'q-java-1',
          score: 60,
          quiz: { module: { title: 'Học phần 1: Java Core' } },
        },
        {
          userId: 'u-2',
          quizId: 'q-pg-1',
          score: 75,
          quiz: { module: { title: 'Học phần 2: PostgreSQL' } },
        },
        { userId: 'u-3', quizId: 'q-orphan', score: 80, quiz: null },
      ]);
      prisma.competencyMatrix.upsert.mockResolvedValue({});

      const summary = await service.recalculateAllCompetencies();

      expect(summary).toEqual({ processedUsers: 2, updatedRecords: 2 });
      expect(prisma.competencyMatrix.upsert).toHaveBeenCalledWith({
        where: {
          userId_skillName: { userId: 'u-1', skillName: 'Java Core & Spring Boot' },
        },
        update: { proficiencyScore: 90 },
        create: {
          userId: 'u-1',
          skillName: 'Java Core & Spring Boot',
          proficiencyScore: 90,
        },
      });
    });
  });

  describe('getCompetencyMatrix & aggregateByFivePositions', () => {
    it('trả về dữ liệu trực tiếp từ Redis nếu Cache Hit', async () => {
      const cachedPayload = {
        success: true,
        statusCode: 200,
        data: { totalEmployees: 150, employees: [], positionSummary: [] },
      };
      redis.get.mockResolvedValue(JSON.stringify(cachedPayload));

      const result = await service.getCompetencyMatrix({});

      expect(result).toEqual(cachedPayload);
      expect(prisma.user.findMany).not.toHaveBeenCalled();
    });

    it('tính toán ma trận năng lực, phân loại PASSED/GAP/NOT_ASSESSED và tổng hợp đủ 5 cấp bậc khi Cache Miss', async () => {
      redis.get.mockResolvedValue(null);
      prisma.module.findMany.mockResolvedValue([
        { title: 'Học phần 1: Java Core' },
        { title: 'Học phần 2: PostgreSQL' },
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u-fresher',
          fullName: 'Nguyễn Văn A',
          email: 'a@novatech.com',
          position: PositionEnum.FRESHER,
          department: 'Software Engineering',
          competencies: [
            { skillName: 'Java Core & Spring Boot', proficiencyScore: 85.0 },
            { skillName: 'PostgreSQL & RESTful API', proficiencyScore: 65.0 },
          ],
        },
        {
          id: 'u-senior',
          fullName: 'Trần Thị B',
          email: 'b@novatech.com',
          position: PositionEnum.SENIOR,
          department: 'Software Engineering',
          competencies: [{ skillName: 'Java Core & Spring Boot', proficiencyScore: 90.0 }],
        },
      ]);

      const response = await service.getCompetencyMatrix({
        departmentId: 'Software Engineering',
        learningPathId: 'path-fresher-java',
      });

      expect(response.statusCode).toBe(200);
      expect(response.data.skills).toEqual([
        'Java Core & Spring Boot',
        'PostgreSQL & RESTful API',
      ]);
      expect(response.data.totalEmployees).toBe(2);

      const fresher = response.data.employees[0];
      expect(fresher.avgScore).toBe(75.0);
      expect(fresher.competencies[0].status).toBe('PASSED');
      expect(fresher.competencies[1].status).toBe('GAP');

      // u-senior mới hoàn thành Java Core (90.0), chưa thi PostgreSQL (NOT_ASSESSED) nên avgScore giữ nguyên 90.0
      const senior = response.data.employees[1];
      expect(senior.avgScore).toBe(90.0);
      expect(senior.competencies[0].status).toBe('PASSED');
      expect(senior.competencies[1]).toMatchObject({
        skillName: 'PostgreSQL & RESTful API',
        score: null,
        status: 'NOT_ASSESSED',
        level: 'UNRATED',
      });

      expect(response.data.positionSummary).toHaveLength(5);
      const fresherSummary = response.data.positionSummary.find(
        (p: PositionCompetencySummary) => p.position === PositionEnum.FRESHER,
      );
      expect(fresherSummary).toEqual({
        position: PositionEnum.FRESHER,
        requiredScore: 70.0,
        totalEmployees: 1,
        assessedEmployees: 1,
        avgProficiencyScore: 75.0,
        passedSkillCount: 1,
        gapSkillCount: 1,
        passedRate: 50.0,
      });

      const leadSummary = response.data.positionSummary.find(
        (p: PositionCompetencySummary) => p.position === PositionEnum.LEAD,
      );
      expect(leadSummary?.totalEmployees).toBe(0);
      expect(leadSummary?.passedRate).toBe(0);

      expect(redis.set).toHaveBeenCalledTimes(1);

      // Kiểm tra xóa cả cache key có bộ lọc khi đồng bộ lại điểm
      redis.keys = jest
        .fn<(...args: any[]) => Promise<any>>()
        .mockResolvedValue(['lms:reports:competency-matrix:extra']);
      prisma.quizAttempt.findMany.mockResolvedValue([]);
      await service.recalculateAllCompetencies();
      expect(redis.del).toHaveBeenCalledWith(
        'lms:reports:competency-matrix:all:all:all',
        'lms:reports:competency-matrix:Software Engineering:path-fresher-java:all',
        'lms:reports:competency-matrix:extra',
      );
    });

    it('xử lý lọc theo position, trường hợp không có Module/Redis và nhân sự chưa có department/kỹ năng', async () => {
      const serviceWithoutRedis = new CompetencyService(prisma as unknown as PrismaService);
      prisma.module.findMany.mockResolvedValue([]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u-intern',
          fullName: 'Lê Văn C',
          email: 'c@novatech.com',
          position: PositionEnum.INTERN,
          department: null,
          competencies: [],
        },
      ]);

      const response = await serviceWithoutRedis.getCompetencyMatrix({
        position: PositionEnum.INTERN,
      });

      expect(response.data.employees[0]).toEqual({
        userId: 'u-intern',
        fullName: 'Lê Văn C',
        department: 'Unassigned',
        position: PositionEnum.INTERN,
        avgScore: 0,
        competencies: [],
      });

      const internSummary = response.data.positionSummary.find(
        (p: PositionCompetencySummary) => p.position === PositionEnum.INTERN,
      );
      expect(internSummary).toEqual({
        position: PositionEnum.INTERN,
        requiredScore: 60.0,
        totalEmployees: 1,
        assessedEmployees: 0,
        avgProficiencyScore: 0,
        passedSkillCount: 0,
        gapSkillCount: 0,
        passedRate: 0,
      });
    });

    it('vẫn hoạt động ổn định nếu Redis gặp lỗi khi xóa cache', async () => {
      redis.del.mockRejectedValueOnce(new Error('Redis connection timeout'));
      prisma.quizAttempt.findMany.mockResolvedValue([]);

      await expect(service.recalculateAllCompetencies()).resolves.toEqual({
        processedUsers: 0,
        updatedRecords: 0,
      });
    });
  });
});