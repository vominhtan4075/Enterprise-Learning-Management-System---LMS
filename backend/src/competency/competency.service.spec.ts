import { jest, describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  CompetencyService,
  PositionCompetencySummary,
} from './competency.service.js';
import {
  evaluateCompetency,
  normalizeSkillName,
  PositionEnum,
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
    pathEnrollment: { findMany: AsyncMock };
    courseEnrollment: { findMany: AsyncMock };
  };
  let redis: {
    get: AsyncMock;
    set: AsyncMock;
    del: AsyncMock;
  };

  beforeEach(async () => {
    const createAsyncMock = (): AsyncMock => jest.fn<(...args: any[]) => Promise<any>>();

    prisma = {
      quiz: { findUnique: createAsyncMock() },
      quizAttempt: { findMany: createAsyncMock() },
      competencyMatrix: { upsert: createAsyncMock() },
      module: { findMany: createAsyncMock() },
      user: { findMany: createAsyncMock() },
      pathEnrollment: { findMany: createAsyncMock() },
      courseEnrollment: { findMany: createAsyncMock() },
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

    it('chuẩn hóa tên kỹ năng từ tiêu đề Học phần / Module', () => {
      expect(normalizeSkillName('Học phần 1: Java Core & Spring Boot')).toBe(
        'Java Core & Spring Boot',
      );
      expect(normalizeSkillName('Module 2 - PostgreSQL & RESTful API')).toBe(
        'PostgreSQL & RESTful API',
      );
      expect(normalizeSkillName('Docker & Redis')).toBe('Docker & Redis');
    });

    it('đánh giá chính xác PASSED / GAP và mức độ thành thạo cho cả 5 cấp bậc', () => {
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
      expect(evaluateCompetency(74.9, PositionEnum.JUNIOR).status).toBe('GAP');
      expect(evaluateCompetency(85, PositionEnum.SENIOR).status).toBe('PASSED');
      expect(evaluateCompetency(97, PositionEnum.LEAD).level).toBe('ADVANCED');
      expect(evaluateCompetency(88, PositionEnum.LEAD).status).toBe('GAP');
      // Fallback ngưỡng mặc định 70 nếu position không xác định
      expect(evaluateCompetency(72, 'UNKNOWN' as PositionEnum).requiredScore).toBe(70);
    });
  });

  describe('syncCompetencyFromQuiz', () => {
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
        skillName: 'Java Core',
        proficiencyScore: 85.5,
      });

      const result = await service.syncCompetencyFromQuiz('u-1', 'quiz-1');

      expect(prisma.competencyMatrix.upsert).toHaveBeenCalledWith({
        where: { userId_skillName: { userId: 'u-1', skillName: 'Java Core' } },
        update: { proficiencyScore: 85.5 },
        create: { userId: 'u-1', skillName: 'Java Core', proficiencyScore: 85.5 },
      });
      expect(redis.del).toHaveBeenCalledWith('lms:reports:competency-matrix:all:all:all');
      expect(result?.proficiencyScore).toBe(85.5);
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
    it('tổng hợp và giữ điểm cao nhất kể cả khi lượt thi sau có điểm thấp hơn lượt đầu', async () => {
      prisma.quizAttempt.findMany.mockResolvedValue([
        { userId: 'u-1', score: 90, quiz: { module: { title: 'Học phần 1: Java Core' } } },
        { userId: 'u-1', score: 60, quiz: { module: { title: 'Học phần 1: Java Core' } } },
        { userId: 'u-2', score: 75, quiz: { module: { title: 'Học phần 2: PostgreSQL' } } },
        { userId: 'u-3', score: 80, quiz: null },
      ]);
      prisma.competencyMatrix.upsert.mockResolvedValue({});

      const summary = await service.recalculateAllCompetencies();

      expect(summary).toEqual({ processedUsers: 2, updatedRecords: 2 });
      expect(prisma.competencyMatrix.upsert).toHaveBeenCalledWith({
        where: { userId_skillName: { userId: 'u-1', skillName: 'Java Core' } },
        update: { proficiencyScore: 90 },
        create: { userId: 'u-1', skillName: 'Java Core', proficiencyScore: 90 },
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

    it('tính toán ma trận năng lực, phân loại PASSED/GAP và tổng hợp đủ 5 cấp bậc khi Cache Miss', async () => {
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
            { skillName: 'Java Core', proficiencyScore: 85.0 },
            { skillName: 'PostgreSQL', proficiencyScore: 65.0 },
          ],
        },
        {
          id: 'u-senior',
          fullName: 'Trần Thị B',
          email: 'b@novatech.com',
          position: PositionEnum.SENIOR,
          department: 'Software Engineering',
          competencies: [{ skillName: 'Java Core', proficiencyScore: 90.0 }],
        },
      ]);

      const response = await service.getCompetencyMatrix({
        departmentId: 'Software Engineering',
        learningPathId: 'path-fresher-java',
      });

      expect(response.statusCode).toBe(200);
      expect(response.data.skills).toEqual(['Java Core', 'PostgreSQL']);
      expect(response.data.totalEmployees).toBe(2);

      const fresher = response.data.employees[0];
      expect(fresher.avgScore).toBe(75.0);
      expect(fresher.competencies[0].status).toBe('PASSED');
      expect(fresher.competencies[1].status).toBe('GAP');

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
    });

    it('getCompetencyMatrixForActor: lọc đúng học viên thuộc phạm vi phụ trách cho TRAINER và giữ nguyên toàn công ty cho HR/ADMIN', async () => {
      redis.get.mockResolvedValue(null);
      prisma.module.findMany.mockResolvedValue([
        { title: 'Học phần 1: Java Core' },
      ]);
      prisma.user.findMany.mockResolvedValue([
        {
          id: 'u-emp-scoped',
          fullName: 'Học Viên Trong Lớp',
          email: 'scoped@novatech.com',
          position: PositionEnum.FRESHER,
          department: 'Backend',
          competencyMatrices: [{ skillName: 'Java Core', proficiencyScore: 88 }],
        },
        {
          id: 'u-emp-outside',
          fullName: 'Học Viên Ngoài Lớp',
          email: 'outside@novatech.com',
          position: PositionEnum.SENIOR,
          department: 'QA',
          competencyMatrices: [{ skillName: 'Java Core', proficiencyScore: 95 }],
        },
      ]);
      prisma.pathEnrollment.findMany.mockResolvedValue([{ userId: 'u-emp-scoped' }]);
      prisma.courseEnrollment.findMany.mockResolvedValue([]);

      const trainerActor = {
        id: 'trainer-1',
        email: 'trainer@novatech.com',
        fullName: 'Trainer 1',
        role: 'TRAINER',
        position: PositionEnum.SENIOR,
        department: 'Training',
        mustChangePassword: false,
        tokenVersion: 0,
      } as any;

      const hrActor = {
        ...trainerActor,
        id: 'hr-1',
        role: 'HR',
      } as any;

      const trainerRes = await service.getCompetencyMatrixForActor(trainerActor, {});
      expect(trainerRes.data.totalEmployees).toBe(1);
      expect(trainerRes.data.employees.map((e: { userId: string }) => e.userId)).toEqual([
        'u-emp-scoped',
      ]);

      const hrRes = await service.getCompetencyMatrixForActor(hrActor, {});
      expect(hrRes.data.totalEmployees).toBe(2);
    });
  });
});