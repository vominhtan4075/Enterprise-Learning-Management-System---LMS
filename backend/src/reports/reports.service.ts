import { HttpStatus, Injectable, Logger, StreamableFile } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { createHash } from 'node:crypto';
import { ErrorCode } from '../common/constants/error-codes.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { CompetencyService } from '../competency/competency.service.js';
import {
  evaluateCompetency,
  normalizeSkillName,
  POSITION_REQUIRED_SCORES,
  type PositionEnum,
} from '../competency/competency.constants.js';
import { computeEffectiveStatus } from '../enrollments/enrollment.helpers.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import {
  EnrollmentStatus,
  Prisma,
  RoleCode,
} from '../generated/prisma/client.js';
import { QueryDashboardDto, QueryReportsDto } from './dto/report.dto.js';

const DASHBOARD_CACHE_TTL = 60;

interface ParsedDashboardRange {
  fromRaw: string | null;
  toRaw: string | null;
  from?: Date;
  to?: Date;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly competencyService: CompetencyService,
  ) {}

  /**
   * GET /api/v1/reports/dashboard (WP11):
   * Trả dữ liệu tổng quan tùy biến theo Role của JWT Token:
   * - ADMIN / HR: Tổng quan toàn công ty (nhân sự, khóa học, lộ trình, tỷ lệ hoàn thành, quá hạn, biểu đồ, hoạt động).
   * - TRAINER: Tổng quan các khóa học do mình phụ trách và học viên được mình giao bài.
   * - EMPLOYEE: Tổng quan tiến độ học tập cá nhân, số kỹ năng đạt chuẩn và phân bố điểm quiz.
   */
  async getDashboard(
    actor: AuthenticatedUser,
    query: QueryDashboardDto = {},
  ) {
    const range = this.parseDateRange(query);
    const cacheKey = `lms:dash:${actor.role}:${actor.id}:${range.fromRaw ?? 'all'}:${range.toRaw ?? 'all'}`;

    return this.redis.remember(cacheKey, DASHBOARD_CACHE_TTL, async () => {
      if (actor.role === RoleCode.EMPLOYEE) {
        return this.buildEmployeeDashboard(actor, range);
      }

      if (actor.role === RoleCode.TRAINER) {
        return this.buildTrainerDashboard(actor, range);
      }

      return this.buildOrganizationDashboard(actor, range);
    });
  }

  /**
   * GET /api/v1/reports/competency-matrix & alias /reports/competency (HR, ADMIN, TRAINER)
   */
  async getCompetencyMatrix(actor: AuthenticatedUser, query: QueryReportsDto) {
    const departmentFilter = query.departmentId ?? query.department;
    const matrixResult = await this.competencyService.getCompetencyMatrix({
      departmentId: departmentFilter,
      learningPathId: query.learningPathId,
      position: query.position as PositionEnum | undefined,
    });

    // Nếu là TRAINER: chỉ lọc những học viên mà Trainer này phụ trách (giao bài hoặc học khóa học của Trainer)
    const skills: string[] = matrixResult?.data?.skills ?? [];

    if (actor.role === RoleCode.TRAINER) {
      const scopedUserIds = await this.getTrainerScopedLearnerIds(actor.id);
      const allEmployees = matrixResult?.data?.employees ?? [];
      const filteredEmployees = allEmployees.filter((e: { userId: string }) =>
        scopedUserIds.has(e.userId),
      );
      const positionSummary =
        this.competencyService.aggregateByFivePositions(filteredEmployees);

      return {
        ...matrixResult,
        data: {
          ...matrixResult.data,
          totalEmployees: filteredEmployees.length,
          employees: filteredEmployees,
          positionSummary,
          matrix: this.mapEmployeesToFrontendMatrix(skills, filteredEmployees),
        },
      };
    }

    const employees = matrixResult?.data?.employees ?? [];
    return {
      ...matrixResult,
      data: {
        ...matrixResult.data,
        matrix: this.mapEmployeesToFrontendMatrix(skills, employees),
      },
    };
  }

  /**
   * GET /api/v1/reports/competency-matrix/me (Hồ sơ năng lực cá nhân của học viên đang đăng nhập)
   */
  async getMyCompetencyMatrix(actor: AuthenticatedUser) {
    const user = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        id: true,
        fullName: true,
        email: true,
        department: true,
        position: true,
        competencyMatrices: {
          select: {
            skillName: true,
            proficiencyScore: true,
            updatedAt: true,
          },
          orderBy: { skillName: 'asc' },
        },
        pathEnrollments: {
          select: {
            pathId: true,
            learningPath: {
              select: {
                id: true,
                code: true,
                title: true,
                pathCourses: {
                  orderBy: { stepOrder: 'asc' },
                  select: {
                    course: {
                      select: {
                        modules: {
                          where: { deletedAt: null },
                          orderBy: { moduleOrder: 'asc' },
                          select: { title: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const position = (user?.position ?? actor.position) as PositionEnum;
    const requiredScore = POSITION_REQUIRED_SCORES[position] ?? 70;

    const scoreMap = new Map<string, number>();
    for (const row of user?.competencyMatrices ?? []) {
      scoreMap.set(row.skillName, Number(row.proficiencyScore));
    }

    const expectedSkills = new Set<string>();
    for (const pe of user?.pathEnrollments ?? []) {
      for (const pc of pe.learningPath.pathCourses) {
        for (const mod of pc.course.modules) {
          expectedSkills.add(normalizeSkillName(mod.title));
        }
      }
    }
    for (const k of scoreMap.keys()) {
      expectedSkills.add(k);
    }

    const competencies = [...expectedSkills].map((skillName) => {
      const rawScore = scoreMap.get(skillName) ?? 0;
      const evaluation = evaluateCompetency(rawScore, position);
      return {
        skillName,
        score: Math.round(rawScore * 10) / 10,
        requiredScore: evaluation.requiredScore,
        status: evaluation.status,
        level: evaluation.level,
        gapDelta: evaluation.gapDelta,
      };
    });

    const avgScore =
      competencies.length > 0
        ? Math.round(
            (competencies.reduce((s, c) => s + c.score, 0) /
              competencies.length) *
              10,
          ) / 10
        : 0;

    const passedCount = competencies.filter((c) => c.status === 'PASSED').length;
    const gapCount = competencies.length - passedCount;

    return {
      userId: actor.id,
      fullName: user?.fullName ?? actor.fullName,
      email: user?.email ?? actor.email,
      department: user?.department ?? actor.department ?? 'Unassigned',
      position,
      requiredScore,
      avgScore,
      passedCount,
      gapCount,
      competencies,
    };
  }

  /**
   * GET /api/v1/reports/completion (Báo cáo tỷ lệ hoàn thành theo phòng ban & cá nhân – [OV] §9)
   */
  async getCompletionReport(
    actor: AuthenticatedUser,
    query: QueryReportsDto,
  ) {
    const queryHash = createHash('md5')
      .update(JSON.stringify({ role: actor.role, id: actor.id, query }))
      .digest('hex');
    const cacheKey = `lms:dash:completion:${queryHash}`;

    return this.redis.remember(cacheKey, DASHBOARD_CACHE_TTL, async () => {
      const now = new Date();
      const departmentFilter = query.department ?? query.departmentId;

      const userWhere: Prisma.UserWhereInput = {
        deletedAt: null,
        isActive: true,
        role: { code: RoleCode.EMPLOYEE },
        ...(departmentFilter
          ? {
              department: {
                equals: departmentFilter.trim(),
                mode: 'insensitive',
              },
            }
          : {}),
        ...(query.position ? { position: query.position } : {}),
      };

      const trainerScope: Prisma.PathEnrollmentWhereInput =
        actor.role === RoleCode.TRAINER ? { assignedById: actor.id } : {};
      const trainerCourseScope: Prisma.CourseEnrollmentWhereInput =
        actor.role === RoleCode.TRAINER
          ? {
              OR: [
                { assignedById: actor.id },
                { course: { createdById: actor.id } },
              ],
            }
          : {};

      const [pathEnrollments, courseEnrollments] = await Promise.all([
        this.prisma.pathEnrollment.findMany({
          where: {
            ...trainerScope,
            user: userWhere,
            ...(query.learningPathId ? { pathId: query.learningPathId } : {}),
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                department: true,
                position: true,
              },
            },
            learningPath: {
              select: { id: true, code: true, title: true },
            },
          },
        }),
        this.prisma.courseEnrollment.findMany({
          where: {
            ...trainerCourseScope,
            user: userWhere,
            ...(query.courseId ? { courseId: query.courseId } : {}),
          },
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                department: true,
                position: true,
              },
            },
            course: {
              select: { id: true, code: true, title: true },
            },
          },
        }),
      ]);

      const deptStatsMap = new Map<
        string,
        {
          department: string;
          totalEnrollments: number;
          completed: number;
          inProgress: number;
          overdue: number;
          sumProgress: number;
        }
      >();

      const userStatsMap = new Map<
        string,
        {
          userId: string;
          fullName: string;
          email: string;
          department: string;
          position: string;
          totalEnrollments: number;
          completed: number;
          inProgress: number;
          overdue: number;
          sumProgress: number;
        }
      >();

      const recordItem = (
        u: {
          id: string;
          fullName: string;
          email: string;
          department: string | null;
          position: string;
        },
        rawStatus: EnrollmentStatus,
        deadline: Date,
        progressPct: number,
      ) => {
        const effStatus = computeEffectiveStatus(rawStatus, deadline, now);
        const deptName = u.department ?? 'Unassigned';

        const dStat = deptStatsMap.get(deptName) ?? {
          department: deptName,
          totalEnrollments: 0,
          completed: 0,
          inProgress: 0,
          overdue: 0,
          sumProgress: 0,
        };
        dStat.totalEnrollments++;
        dStat.sumProgress += progressPct;
        if (effStatus === EnrollmentStatus.COMPLETED) dStat.completed++;
        else if (effStatus === EnrollmentStatus.OVERDUE) dStat.overdue++;
        else dStat.inProgress++;
        deptStatsMap.set(deptName, dStat);

        const uStat = userStatsMap.get(u.id) ?? {
          userId: u.id,
          fullName: u.fullName,
          email: u.email,
          department: deptName,
          position: u.position,
          totalEnrollments: 0,
          completed: 0,
          inProgress: 0,
          overdue: 0,
          sumProgress: 0,
        };
        uStat.totalEnrollments++;
        uStat.sumProgress += progressPct;
        if (effStatus === EnrollmentStatus.COMPLETED) uStat.completed++;
        else if (effStatus === EnrollmentStatus.OVERDUE) uStat.overdue++;
        else uStat.inProgress++;
        userStatsMap.set(u.id, uStat);
      };

      for (const pe of pathEnrollments) {
        recordItem(
          pe.user,
          pe.status,
          pe.deadline,
          Number(pe.progressPercentage),
        );
      }

      for (const ce of courseEnrollments) {
        recordItem(
          ce.user,
          ce.status,
          ce.deadline,
          Number(ce.progressPercentage),
        );
      }

      const byDepartment = [...deptStatsMap.values()].map((d) => ({
        department: d.department,
        totalEnrollments: d.totalEnrollments,
        completed: d.completed,
        inProgress: d.inProgress,
        overdue: d.overdue,
        completionRate:
          d.totalEnrollments > 0
            ? Math.round((d.completed / d.totalEnrollments) * 1000) / 10
            : 0,
        avgProgressPercentage:
          d.totalEnrollments > 0
            ? Math.round((d.sumProgress / d.totalEnrollments) * 10) / 10
            : 0,
      }));

      const byEmployee = [...userStatsMap.values()].map((u) => ({
        userId: u.userId,
        fullName: u.fullName,
        email: u.email,
        department: u.department,
        position: u.position,
        totalEnrollments: u.totalEnrollments,
        completed: u.completed,
        inProgress: u.inProgress,
        overdue: u.overdue,
        completionRate:
          u.totalEnrollments > 0
            ? Math.round((u.completed / u.totalEnrollments) * 1000) / 10
            : 0,
        avgProgressPercentage:
          u.totalEnrollments > 0
            ? Math.round((u.sumProgress / u.totalEnrollments) * 10) / 10
            : 0,
      }));

      const totalEnrollments = byDepartment.reduce(
        (s, d) => s + d.totalEnrollments,
        0,
      );
      const totalCompleted = byDepartment.reduce((s, d) => s + d.completed, 0);
      const totalOverdue = byDepartment.reduce((s, d) => s + d.overdue, 0);

      return {
        summary: {
          totalEnrollments,
          totalCompleted,
          totalOverdue,
          overallCompletionRate:
            totalEnrollments > 0
              ? Math.round((totalCompleted / totalEnrollments) * 1000) / 10
              : 0,
        },
        byDepartment,
        byEmployee,
      };
    });
  }

  /**
   * GET /api/v1/reports/quiz-scores (Báo cáo điểm trung bình & tỷ lệ đỗ Quiz – [OV] §9)
   */
  async getQuizScoresReport(
    actor: AuthenticatedUser,
    query: QueryReportsDto,
  ) {
    const quizzes = await this.prisma.quiz.findMany({
      where: {
        module: {
          deletedAt: null,
          course: {
            deletedAt: null,
            ...(query.courseId ? { id: query.courseId } : {}),
            ...(actor.role === RoleCode.TRAINER
              ? { createdById: actor.id }
              : {}),
            ...(query.learningPathId
              ? {
                  pathCourses: {
                    some: { pathId: query.learningPathId },
                  },
                }
              : {}),
          },
        },
      },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            moduleOrder: true,
            course: {
              select: { id: true, code: true, title: true },
            },
          },
        },
        quizAttempts: {
          select: {
            id: true,
            userId: true,
            score: true,
            isPassed: true,
            attemptNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const items = quizzes.map((q) => {
      const attempts = q.quizAttempts;
      const totalAttempts = attempts.length;
      const passedAttempts = attempts.filter((a) => a.isPassed).length;
      const uniqueLearners = new Set(attempts.map((a) => a.userId)).size;
      const avgScore =
        totalAttempts > 0
          ? Math.round(
              (attempts.reduce((s, a) => s + Number(a.score), 0) /
                totalAttempts) *
                10,
            ) / 10
          : 0;
      const passRate =
        totalAttempts > 0
          ? Math.round((passedAttempts / totalAttempts) * 1000) / 10
          : 0;

      return {
        quizId: q.id,
        quizTitle: q.title,
        quizType: q.quizType,
        passingScore: Number(q.passingScore),
        moduleId: q.module.id,
        moduleTitle: q.module.title,
        courseId: q.module.course.id,
        courseCode: q.module.course.code,
        courseTitle: q.module.course.title,
        totalAttempts,
        uniqueLearners,
        passedAttempts,
        avgScore,
        passRate,
      };
    });

    const totalAttemptsAll = items.reduce((s, i) => s + i.totalAttempts, 0);
    const overallAvgScore =
      items.length > 0
        ? Math.round(
            (items.reduce((s, i) => s + i.avgScore, 0) / items.length) * 10,
          ) / 10
        : 0;

    return {
      totalQuizzes: items.length,
      totalAttempts: totalAttemptsAll,
      overallAvgScore,
      quizzes: items,
    };
  }

  /**
   * GET /api/v1/reports/competency-matrix/export (Xuất file Excel .xlsx Ma trận Năng lực)
   */
  async exportCompetencyMatrixExcel(
    actor: AuthenticatedUser,
    query: QueryReportsDto,
  ): Promise<StreamableFile> {
    const matrixRes = await this.getCompetencyMatrix(actor, query);
    const data = matrixRes?.data ?? {
      skills: [],
      employees: [],
      positionSummary: [],
    };
    const skills: string[] = data.skills ?? [];
    const employees: any[] = data.employees ?? [];
    const positionSummary: any[] = data.positionSummary ?? [];

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'NovaTech Corporate LMS';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Competency Matrix');

    const headerColumns = [
      { header: 'Họ và tên', key: 'fullName', width: 26 },
      { header: 'Phòng ban', key: 'department', width: 24 },
      { header: 'Cấp bậc', key: 'position', width: 14 },
      { header: 'Điểm TB (%)', key: 'avgScore', width: 14 },
      ...skills.map((skill, idx) => ({
        header: `${skill} (%)`,
        key: `skill_${idx}`,
        width: 22,
      })),
    ];

    sheet.columns = headerColumns;
    sheet.getRow(1).font = { bold: true };

    for (const emp of employees) {
      const rowData: Record<string, unknown> = {
        fullName: emp.fullName,
        department: emp.department,
        position: emp.position,
        avgScore: emp.avgScore,
      };

      const compMap = new Map<string, any>(
        (emp.competencies ?? []).map((c: any) => [c.skillName, c]),
      );

      skills.forEach((skill, idx) => {
        const comp = compMap.get(skill);
        rowData[`skill_${idx}`] = comp
          ? `${comp.score}% (${comp.status})`
          : '0% (GAP)';
      });

      sheet.addRow(rowData);
    }

    const summarySheet = workbook.addWorksheet('Position Summary');
    summarySheet.columns = [
      { header: 'Cấp bậc', key: 'position', width: 16 },
      { header: 'Điểm chuẩn yêu cầu (%)', key: 'requiredScore', width: 22 },
      { header: 'Tổng nhân sự', key: 'totalEmployees', width: 16 },
      { header: 'Đã đánh giá', key: 'assessedEmployees', width: 16 },
      { header: 'Điểm TB (%)', key: 'avgProficiencyScore', width: 16 },
      { header: 'Số kỹ năng Đạt (PASSED)', key: 'passedSkillCount', width: 24 },
      { header: 'Số kỹ năng Thiếu hụt (GAP)', key: 'gapSkillCount', width: 26 },
      { header: 'Tỷ lệ Đạt (%)', key: 'passedRate', width: 16 },
    ];
    summarySheet.getRow(1).font = { bold: true };

    for (const ps of positionSummary) {
      summarySheet.addRow(ps);
    }

    const arrayBuffer = await workbook.xlsx.writeBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return new StreamableFile(buffer);
  }

  private async buildOrganizationDashboard(
    actor: AuthenticatedUser,
    range: ParsedDashboardRange,
  ) {
    const now = new Date();
    const createdAtFilter = this.buildCreatedAtFilter(range.from, range.to);
    const hasCourseFindMany = typeof this.prisma.course?.findMany === 'function';
    const hasNotificationFindMany =
      typeof this.prisma.notification?.findMany === 'function';

    const [
      totalUsers,
      totalCourses,
      totalPaths,
      pathEnrollments,
      courseEnrollments,
      quizAttempts,
      coursesWithEnrollments,
      recentNotifications,
    ] = await Promise.all([
      this.prisma.user.count({
        where: { deletedAt: null, isActive: true },
      }),
      this.prisma.course.count({
        where: { deletedAt: null, isPublished: true },
      }),
      this.prisma.learningPath.count({
        where: { archivedAt: null },
      }),
      this.prisma.pathEnrollment.findMany({
        where: createdAtFilter,
        select: { status: true, deadline: true, progressPercentage: true },
      }),
      this.prisma.courseEnrollment.findMany({
        where: createdAtFilter,
        select: { status: true, deadline: true, progressPercentage: true },
      }),
      this.prisma.quizAttempt.findMany({
        where: createdAtFilter,
        select: { score: true, isPassed: true },
      }),
      hasCourseFindMany
        ? this.prisma.course.findMany({
            where: { deletedAt: null, isPublished: true },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              title: true,
              courseEnrollments: {
                where: createdAtFilter,
                select: { status: true, deadline: true },
              },
            },
          })
        : Promise.resolve([]),
      hasNotificationFindMany
        ? this.prisma.notification.findMany({
            where: createdAtFilter,
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              id: true,
              title: true,
              body: true,
              type: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const allEnrollments = [...pathEnrollments, ...courseEnrollments];
    let completedEnrollments = 0;
    let overdueEnrollments = 0;
    let inProgressEnrollments = 0;

    for (const e of allEnrollments) {
      const eff = computeEffectiveStatus(e.status, e.deadline, now);
      if (eff === EnrollmentStatus.COMPLETED) completedEnrollments++;
      else if (eff === EnrollmentStatus.OVERDUE) overdueEnrollments++;
      else inProgressEnrollments++;
    }

    const totalEnrollments = allEnrollments.length;
    const completionRate =
      totalEnrollments > 0
        ? Math.round((completedEnrollments / totalEnrollments) * 1000) / 10
        : 0;

    const avgQuizScore =
      quizAttempts.length > 0
        ? Math.round(
            (quizAttempts.reduce((s, a) => s + Number(a.score), 0) /
              quizAttempts.length) *
              10,
          ) / 10
        : 0;

    const courseCompletion = coursesWithEnrollments.map((c) => {
      const total = c.courseEnrollments.length;
      const completed = c.courseEnrollments.filter(
        (e) =>
          computeEffectiveStatus(e.status, e.deadline, now) ===
          EnrollmentStatus.COMPLETED,
      ).length;
      return {
        name: c.title,
        value: total > 0 ? Math.round((completed / total) * 1000) / 10 : 0,
      };
    });

    const activities = recentNotifications.map((n) => ({
      id: n.id,
      title: n.title || n.body,
      time:
        n.createdAt instanceof Date
          ? n.createdAt.toISOString()
          : String(n.createdAt),
      type: this.mapNotificationActivityType(String(n.type)),
    }));

    return {
      role: actor.role,
      totalUsers,
      totalCourses,
      totalPaths,
      totalEnrollments,
      completedEnrollments,
      inProgressEnrollments,
      overdueEnrollments,
      completionRate,
      totalQuizAttempts: quizAttempts.length,
      avgQuizScore,
      period: { from: range.fromRaw, to: range.toRaw },
      stats: {
        totalUsers,
        activeCourses: totalCourses,
        completionRate,
        averageScore: avgQuizScore,
      },
      scoreDistribution: this.buildScoreDistribution(quizAttempts),
      courseCompletion,
      activities,
    };
  }

  private async buildTrainerDashboard(
    actor: AuthenticatedUser,
    range: ParsedDashboardRange,
  ) {
    const now = new Date();
    const createdAtFilter = this.buildCreatedAtFilter(range.from, range.to);
    const hasQuizAttemptFindMany =
      typeof this.prisma.quizAttempt?.findMany === 'function';
    const hasCourseFindMany = typeof this.prisma.course?.findMany === 'function';
    const hasNotificationFindMany =
      typeof this.prisma.notification?.findMany === 'function';

    const [
      myCoursesCount,
      assignedPathEnrollments,
      assignedCourseEnrollments,
      trainerQuizAttempts,
      trainerCoursesWithEnrollments,
      recentNotifications,
    ] = await Promise.all([
      this.prisma.course.count({
        where: { createdById: actor.id, deletedAt: null },
      }),
      this.prisma.pathEnrollment.findMany({
        where: { assignedById: actor.id, ...createdAtFilter },
        select: { userId: true, status: true, deadline: true },
      }),
      this.prisma.courseEnrollment.findMany({
        where: {
          OR: [
            { assignedById: actor.id },
            { course: { createdById: actor.id } },
          ],
          ...createdAtFilter,
        },
        select: { userId: true, status: true, deadline: true },
      }),
      hasQuizAttemptFindMany
        ? this.prisma.quizAttempt.findMany({
            where: {
              quiz: { module: { course: { createdById: actor.id } } },
              ...createdAtFilter,
            },
            select: { score: true, isPassed: true },
          })
        : Promise.resolve([]),
      hasCourseFindMany
        ? this.prisma.course.findMany({
            where: { createdById: actor.id, deletedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              title: true,
              courseEnrollments: {
                where: createdAtFilter,
                select: { status: true, deadline: true },
              },
            },
          })
        : Promise.resolve([]),
      hasNotificationFindMany
        ? this.prisma.notification.findMany({
            where: { userId: actor.id, ...createdAtFilter },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: {
              id: true,
              title: true,
              body: true,
              type: true,
              createdAt: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const all = [...assignedPathEnrollments, ...assignedCourseEnrollments];
    let completed = 0;
    let overdue = 0;
    for (const e of all) {
      const eff = computeEffectiveStatus(e.status, e.deadline, now);
      if (eff === EnrollmentStatus.COMPLETED) completed++;
      else if (eff === EnrollmentStatus.OVERDUE) overdue++;
    }

    const completionRate =
      all.length > 0 ? Math.round((completed / all.length) * 1000) / 10 : 0;
    const avgQuizScore =
      trainerQuizAttempts.length > 0
        ? Math.round(
            (trainerQuizAttempts.reduce((s, a) => s + Number(a.score), 0) /
              trainerQuizAttempts.length) *
              10,
          ) / 10
        : 0;

    const courseCompletion = trainerCoursesWithEnrollments.map((c) => {
      const total = c.courseEnrollments.length;
      const done = c.courseEnrollments.filter(
        (e) =>
          computeEffectiveStatus(e.status, e.deadline, now) ===
          EnrollmentStatus.COMPLETED,
      ).length;
      return {
        name: c.title,
        value: total > 0 ? Math.round((done / total) * 1000) / 10 : 0,
      };
    });

    const activities = recentNotifications.map((n) => ({
      id: n.id,
      title: n.title || n.body,
      time:
        n.createdAt instanceof Date
          ? n.createdAt.toISOString()
          : String(n.createdAt),
      type: this.mapNotificationActivityType(String(n.type)),
    }));

    return {
      role: actor.role,
      myCoursesCount,
      totalAssignedEnrollments: all.length,
      completedEnrollments: completed,
      overdueEnrollments: overdue,
      completionRate,
      period: { from: range.fromRaw, to: range.toRaw },
      stats: {
        totalUsers: new Set(all.map((e) => e.userId).filter(Boolean)).size,
        activeCourses: myCoursesCount,
        completionRate,
        averageScore: avgQuizScore,
      },
      scoreDistribution: this.buildScoreDistribution(trainerQuizAttempts),
      courseCompletion,
      activities,
    };
  }

  private async buildEmployeeDashboard(
    actor: AuthenticatedUser,
    range: ParsedDashboardRange,
  ) {
    const createdAtFilter = this.buildCreatedAtFilter(range.from, range.to);
    const [myCompetency, completedLessonsCount, quizAttempts] =
      await Promise.all([
        this.getMyCompetencyMatrix(actor),
        this.prisma.userProgress.count({
          where: { userId: actor.id, isCompleted: true, ...createdAtFilter },
        }),
        this.prisma.quizAttempt.findMany({
          where: { userId: actor.id, ...createdAtFilter },
          select: { score: true, isPassed: true },
        }),
      ]);

    const avgQuizScore =
      quizAttempts.length > 0
        ? Math.round(
            (quizAttempts.reduce((s, a) => s + Number(a.score), 0) /
              quizAttempts.length) *
              10,
          ) / 10
        : 0;

    return {
      role: actor.role,
      userId: actor.id,
      completedLessonsCount,
      totalQuizAttempts: quizAttempts.length,
      passedQuizzesCount: quizAttempts.filter((a) => a.isPassed).length,
      avgQuizScore,
      competencySummary: {
        avgScore: myCompetency.avgScore,
        requiredScore: myCompetency.requiredScore,
        passedCount: myCompetency.passedCount,
        gapCount: myCompetency.gapCount,
      },
      period: { from: range.fromRaw, to: range.toRaw },
      scoreDistribution: this.buildScoreDistribution(quizAttempts),
    };
  }

  private parseDateBoundary(
    raw: string | undefined,
    endOfDay: boolean,
  ): Date | undefined {
    if (!raw?.trim()) return undefined;
    const trimmed = raw.trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ? new Date(`${trimmed}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}+07:00`)
      : new Date(trimmed);

    if (Number.isNaN(date.getTime())) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        `Định dạng ngày không hợp lệ: "${raw}". Vui lòng dùng YYYY-MM-DD hoặc ISO 8601.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return date;
  }

  private parseDateRange(query?: QueryDashboardDto): ParsedDashboardRange {
    const fromRaw = query?.from?.trim() || null;
    const toRaw = query?.to?.trim() || null;
    const from = this.parseDateBoundary(fromRaw ?? undefined, false);
    const to = this.parseDateBoundary(toRaw ?? undefined, true);

    if (from && to && from.getTime() > to.getTime()) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Khoảng thời gian lọc không hợp lệ: ngày bắt đầu (from) phải nhỏ hơn hoặc bằng ngày kết thúc (to).',
        HttpStatus.BAD_REQUEST,
      );
    }

    return { fromRaw, toRaw, from, to };
  }

  private buildCreatedAtFilter(
    from?: Date,
    to?: Date,
  ): { createdAt?: Prisma.DateTimeFilter } {
    if (!from && !to) return {};
    return {
      createdAt: {
        ...(from ? { gte: from } : {}),
        ...(to ? { lte: to } : {}),
      },
    };
  }

  private buildScoreDistribution(attempts: Array<{ score: unknown }>) {
    let excellent = 0;
    let good = 0;
    let pass = 0;
    let needsImprovement = 0;

    for (const a of attempts) {
      const score = Number(a.score);
      if (score >= 90) excellent++;
      else if (score >= 75) good++;
      else if (score >= 70) pass++;
      else needsImprovement++;
    }

    return [
      { label: 'Xuất sắc (90-100%)', value: excellent, color: 'bg-emerald-500' },
      { label: 'Khá giỏi (75-89%)', value: good, color: 'bg-blue-500' },
      { label: 'Đạt chuẩn (70-74%)', value: pass, color: 'bg-amber-500' },
      { label: 'Cần cải thiện (<70%)', value: needsImprovement, color: 'bg-rose-500' },
    ];
  }

  private mapNotificationActivityType(
    type: string,
  ): 'assessment' | 'system' | 'course' {
    if (
      type === 'QUIZ_PASSED' ||
      type === 'QUIZ_FAILED' ||
      type === 'FINAL_FAILED_ALERT'
    ) {
      return 'assessment';
    }
    if (type === 'WELCOME') {
      return 'system';
    }
    return 'course';
  }

  private mapEmployeesToFrontendMatrix(skills: string[], employees: any[]) {
    return employees.map((emp) => {
      const compMap = new Map<string, number>(
        (emp.competencies ?? []).map((c: any) => [
          String(c.skillName ?? ''),
          Number(c.score ?? c.proficiencyScore ?? 0),
        ]),
      );
      const rowSkills: string[] =
        skills.length > 0
          ? skills
          : (emp.competencies ?? []).map((c: any) => String(c.skillName ?? ''));
      const scores: number[] = rowSkills.map((skill) => compMap.get(skill) ?? 0);
      const average =
        typeof emp.avgScore === 'number'
          ? emp.avgScore
          : scores.length > 0
            ? Math.round(
                (scores.reduce((sum, val) => sum + val, 0) / scores.length) *
                  10,
              ) / 10
            : 0;
      const status =
        average >= 85
          ? 'Xuất sắc'
          : average >= 70
            ? 'Đạt chuẩn'
            : 'Cần hỗ trợ';

      return {
        id: String(emp.userId ?? emp.id ?? ''),
        name: String(emp.fullName ?? emp.name ?? 'Chưa có tên'),
        department: String(emp.department ?? 'Unassigned'),
        role: String(emp.position ?? emp.role ?? 'FRESHER'),
        skills: rowSkills,
        scores,
        average,
        status,
      };
    });
  }

  private async getTrainerScopedLearnerIds(
    trainerId: string,
  ): Promise<Set<string>> {
    const [peRows, ceRows] = await Promise.all([
      this.prisma.pathEnrollment.findMany({
        where: { assignedById: trainerId },
        select: { userId: true },
      }),
      this.prisma.courseEnrollment.findMany({
        where: {
          OR: [
            { assignedById: trainerId },
            { course: { createdById: trainerId } },
          ],
        },
        select: { userId: true },
      }),
    ]);

    return new Set([
      ...peRows.map((r) => r.userId),
      ...ceRows.map((r) => r.userId),
    ]);
  }
}
