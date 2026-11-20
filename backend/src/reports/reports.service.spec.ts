import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { StreamableFile } from '@nestjs/common';
import { ReportsService } from './reports.service.js';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { CompetencyService } from '../competency/competency.service.js';
import {
  EnrollmentStatus,
  PositionLevel,
  RoleCode,
} from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

describe('WP11 – ReportsService (Dashboard, Competency Matrix, Completion, Quiz Scores, Excel Export)', () => {
  let service: ReportsService;
  let prismaMock: any;
  let redisMock: {
    remember: ReturnType<typeof jest.fn>;
  };
  let competencyServiceMock: {
    getCompetencyMatrix: ReturnType<typeof jest.fn>;
    aggregateByFivePositions: ReturnType<typeof jest.fn>;
  };

  const hrUser: AuthenticatedUser = {
    id: 'hr-1',
    email: 'hr@novatech.com',
    fullName: 'HR User',
    role: RoleCode.HR,
    position: PositionLevel.SENIOR,
    department: 'Human Resources',
    mustChangePassword: false,
    tokenVersion: 0,
  };

  const trainerUser: AuthenticatedUser = {
    id: 'trainer-1',
    email: 'trainer@novatech.com',
    fullName: 'Trainer 1',
    role: RoleCode.TRAINER,
    position: PositionLevel.SENIOR,
    department: 'Training',
    mustChangePassword: false,
    tokenVersion: 0,
  };

  const employeeUser: AuthenticatedUser = {
    id: 'emp-1',
    email: 'fresher.java@novatech.com',
    fullName: 'Lê Minh Khoa',
    role: RoleCode.EMPLOYEE,
    position: PositionLevel.FRESHER,
    department: 'Backend Development',
    mustChangePassword: false,
    tokenVersion: 0,
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        count: jest.fn().mockResolvedValue(100),
        findUnique: jest.fn().mockResolvedValue({
          id: employeeUser.id,
          fullName: employeeUser.fullName,
          email: employeeUser.email,
          department: employeeUser.department,
          position: PositionLevel.FRESHER,
          competencyMatrices: [
            {
              skillName: 'Java Core & Spring Boot',
              proficiencyScore: 87.5,
              updatedAt: new Date(),
            },
            {
              skillName: 'PostgreSQL & RESTful API',
              proficiencyScore: 60.0,
              updatedAt: new Date(),
            },
          ],
          pathEnrollments: [],
        }),
      },
      course: {
        count: jest.fn().mockResolvedValue(20),
      },
      learningPath: {
        count: jest.fn().mockResolvedValue(5),
      },
      pathEnrollment: {
        findMany: jest.fn().mockResolvedValue([
          {
            userId: 'emp-1',
            status: EnrollmentStatus.COMPLETED,
            deadline: new Date('2027-01-01T00:00:00Z'),
            progressPercentage: 100,
            user: {
              id: 'emp-1',
              fullName: 'Lê Minh Khoa',
              email: 'fresher.java@novatech.com',
              department: 'Backend Development',
              position: PositionLevel.FRESHER,
            },
            learningPath: {
              id: 'path-1',
              code: 'path-fresher-java',
              title: 'Onboarding Fresher Java',
            },
          },
        ]),
      },
      courseEnrollment: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userProgress: {
        count: jest.fn().mockResolvedValue(12),
      },
      quizAttempt: {
        findMany: jest.fn().mockResolvedValue([
          { score: 80, isPassed: true },
          { score: 90, isPassed: true },
        ]),
      },
      quiz: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'quiz-1',
            title: 'Quiz 1: Java Core',
            quizType: 'MODULE',
            passingScore: 70,
            module: {
              id: 'mod-1',
              title: 'Học phần 1: Java Core',
              moduleOrder: 1,
              course: {
                id: 'c-1',
                code: 'JAVA_CORE_01',
                title: 'Java Core & Spring Boot',
              },
            },
            quizAttempts: [
              { id: 'a1', userId: 'emp-1', score: 80, isPassed: true, attemptNumber: 1 },
              { id: 'a2', userId: 'emp-2', score: 60, isPassed: false, attemptNumber: 1 },
            ],
          },
        ]),
      },
    };

    redisMock = {
      remember: jest.fn(
        async (_k: string, _ttl: number, fn: () => Promise<unknown>) => fn(),
      ),
    };

    competencyServiceMock = {
      getCompetencyMatrix: jest.fn().mockResolvedValue({
        success: true,
        statusCode: 200,
        data: {
          skills: ['Java Core & Spring Boot', 'PostgreSQL & RESTful API'],
          totalEmployees: 2,
          employees: [
            {
              userId: 'emp-1',
              fullName: 'Lê Minh Khoa',
              department: 'Backend Development',
              position: 'FRESHER',
              avgScore: 87.5,
              competencies: [
                {
                  skillName: 'Java Core & Spring Boot',
                  score: 87.5,
                  requiredScore: 70,
                  status: 'PASSED',
                  level: 'ADVANCED',
                  gapDelta: 17.5,
                },
              ],
            },
            {
              userId: 'emp-outside',
              fullName: 'Outside Learner',
              department: 'QA',
              position: 'FRESHER',
              avgScore: 50,
              competencies: [],
            },
          ],
          positionSummary: [],
        },
      } as never),
      aggregateByFivePositions: jest.fn().mockReturnValue([]),
    };

    service = new ReportsService(
      prismaMock as unknown as PrismaService,
      redisMock as unknown as RedisService,
      competencyServiceMock as unknown as CompetencyService,
    );
  });

  it('getDashboard: nên trả về số liệu tổng quan toàn công ty cho HR/ADMIN và số liệu cá nhân cho EMPLOYEE', async () => {
    const hrDash = (await service.getDashboard(hrUser)) as any;
    expect(hrDash.role).toBe(RoleCode.HR);
    expect(hrDash.totalUsers).toBe(100);
    expect(hrDash.completionRate).toBe(100);
    expect(hrDash.avgQuizScore).toBe(85);

    const empDash = (await service.getDashboard(employeeUser)) as any;
    expect(empDash.role).toBe(RoleCode.EMPLOYEE);
    expect(empDash.completedLessonsCount).toBe(12);
    expect(empDash.competencySummary.passedCount).toBe(1);
    expect(empDash.competencySummary.gapCount).toBe(1);
  });

  it('getMyCompetencyMatrix: nên tính đúng hồ sơ năng lực cá nhân (PASSED / GAP) của học viên', async () => {
    const me = await service.getMyCompetencyMatrix(employeeUser);
    expect(me.userId).toBe(employeeUser.id);
    expect(me.requiredScore).toBe(70);
    expect(me.passedCount).toBe(1);
    expect(me.gapCount).toBe(1);
    expect(me.competencies).toHaveLength(2);
  });

  it('getCompetencyMatrix: TRAINER chỉ nhìn thấy học viên trong phạm vi lớp mình phụ trách', async () => {
    const res = await service.getCompetencyMatrix(trainerUser, {});
    expect(res.data.totalEmployees).toBe(1);
    expect(res.data.employees[0].userId).toBe('emp-1');
  });

  it('getCompletionReport & getQuizScoresReport: nên tổng hợp tỷ lệ hoàn thành theo phòng ban và điểm trung bình Quiz', async () => {
    const comp = await service.getCompletionReport(hrUser, {});
    expect(comp.summary.totalEnrollments).toBe(1);
    expect(comp.summary.overallCompletionRate).toBe(100);
    expect(comp.byDepartment[0].department).toBe('Backend Development');

    const quizReport = await service.getQuizScoresReport(hrUser, {});
    expect(quizReport.totalQuizzes).toBe(1);
    expect(quizReport.quizzes[0].avgScore).toBe(70);
    expect(quizReport.quizzes[0].passRate).toBe(50);
  });

  it('exportCompetencyMatrixExcel: nên sinh luồng tệp Excel (.xlsx) hợp lệ qua StreamableFile', async () => {
    const file = await service.exportCompetencyMatrixExcel(hrUser, {});
    expect(file).toBeInstanceOf(StreamableFile);
  });
});
