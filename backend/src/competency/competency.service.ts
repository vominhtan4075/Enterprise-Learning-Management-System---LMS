import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service.js';
import {
  DomainEvents,
  QuizAttemptCompletedEvent,
} from '../common/events/domain-events.js';
import {
  ALL_POSITIONS,
  CompetencyLevel,
  CompetencyStatus,
  evaluateCompetency,
  normalizeSkillName,
  POSITION_REQUIRED_SCORES,
  PositionEnum,
} from './competency.constants.js';
import { CompetencyMatrixQueryDto } from './dto/competency-query.dto.js';

export interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
}

export interface EmployeeSkillItem {
  skillName: string;
  score: number;
  requiredScore: number;
  status: CompetencyStatus;
  level: CompetencyLevel;
  gapDelta: number;
}

export interface PositionCompetencySummary {
  position: PositionEnum;
  requiredScore: number;
  totalEmployees: number;
  assessedEmployees: number;
  avgProficiencyScore: number;
  passedSkillCount: number;
  gapSkillCount: number;
  passedRate: number;
}

@Injectable()
export class CompetencyService {
  private readonly logger = new Logger(CompetencyService.name);
  private readonly CACHE_PREFIX = 'lms:reports:competency-matrix';
  private readonly CACHE_TTL_SECONDS = 900;

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject('REDIS_CLIENT') private readonly redis?: RedisCacheClient,
  ) {}

  /**
   * Lắng nghe sự kiện nộp bài kiểm tra Quiz (WP9 9.4) để tự động đồng bộ điểm cao nhất vào Ma trận Năng lực
   */
  @OnEvent(DomainEvents.QUIZ_ATTEMPT_COMPLETED)
  async handleQuizAttemptCompleted(
    event: QuizAttemptCompletedEvent,
  ): Promise<void> {
    try {
      await this.syncCompetencyFromQuiz(event.userId, event.quizId);
    } catch (err) {
      this.logger.warn(
        `Không thể đồng bộ CompetencyMatrix cho user=${event.userId} quiz=${event.quizId}: ${(err as Error).message}`,
      );
    }
  }

  async syncCompetencyFromQuiz(userId: string, quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        module: {
          include: { course: true },
        },
      },
    });

    if (!quiz || !quiz.module) {
      throw new NotFoundException(`Không tìm thấy Quiz hoặc Module tương ứng (quizId=${quizId})`);
    }

    const attempts: Array<{ score: unknown }> = await this.prisma.quizAttempt.findMany({
      where: { userId, quizId },
      select: { score: true },
    });

    if (!attempts || attempts.length === 0) {
      return null;
    }

    const bestScore = Math.max(...attempts.map((a: { score: unknown }) => Number(a.score)));
    const roundedScore = Math.round(bestScore * 10) / 10;
    const skillName = normalizeSkillName(quiz.module.title);

    const record = await this.prisma.competencyMatrix.upsert({
      where: {
        userId_skillName: {
          userId,
          skillName,
        },
      },
      update: {
        proficiencyScore: roundedScore,
      },
      create: {
        userId,
        skillName,
        proficiencyScore: roundedScore,
      },
    });

    await this.invalidateMatrixCache();
    return record;
  }

  async recalculateAllCompetencies(): Promise<{ processedUsers: number; updatedRecords: number }> {
    const attempts = await this.prisma.quizAttempt.findMany({
      include: {
        quiz: {
          include: { module: true },
        },
      },
    });

    const bestMap = new Map<string, { userId: string; skillName: string; maxScore: number }>();

    for (const attempt of attempts) {
      if (!attempt.quiz?.module) continue;
      const skillName = normalizeSkillName(attempt.quiz.module.title);
      const key = `${attempt.userId}::${skillName}`;
      const numericScore = Math.round(Number(attempt.score) * 10) / 10;

      const existing = bestMap.get(key);
      if (!existing || numericScore > existing.maxScore) {
        bestMap.set(key, {
          userId: attempt.userId,
          skillName,
          maxScore: numericScore,
        });
      }
    }

    const uniqueUsers = new Set<string>();
    let updatedRecords = 0;

    for (const entry of bestMap.values()) {
      uniqueUsers.add(entry.userId);
      await this.prisma.competencyMatrix.upsert({
        where: {
          userId_skillName: {
            userId: entry.userId,
            skillName: entry.skillName,
          },
        },
        update: { proficiencyScore: entry.maxScore },
        create: {
          userId: entry.userId,
          skillName: entry.skillName,
          proficiencyScore: entry.maxScore,
        },
      });
      updatedRecords++;
    }

    await this.invalidateMatrixCache();
    return {
      processedUsers: uniqueUsers.size,
      updatedRecords,
    };
  }

  async getCompetencyMatrix(query: CompetencyMatrixQueryDto = {}) {
    const cacheKey = `${this.CACHE_PREFIX}:${query.departmentId ?? 'all'}:${query.learningPathId ?? 'all'}:${query.position ?? 'all'}`;

    if (this.redis) {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    const modules: Array<{ title: string }> = await this.prisma.module.findMany({
      where: query.learningPathId
        ? {
            course: {
              pathCourses: {
                some: { pathId: query.learningPathId },
              },
            },
          }
        : undefined,
      orderBy: { moduleOrder: 'asc' },
      select: { title: true },
    });

    const skills: string[] = Array.from(
      new Set<string>(modules.map((m: { title: string }) => normalizeSkillName(m.title))),
    );

    const users: Array<{
      id: string;
      fullName: string;
      email: string;
      position: PositionEnum;
      department: string | null;
      competencyMatrices?: Array<{ skillName: string; proficiencyScore: unknown }>;
      competencies?: Array<{ skillName: string; proficiencyScore: unknown }>;
    }> = await this.prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(query.departmentId ? { department: query.departmentId } : {}),
        ...(query.position ? { position: query.position } : {}),
        ...(query.learningPathId
          ? {
              pathEnrollments: {
                some: { pathId: query.learningPathId },
              },
            }
          : {}),
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        position: true,
        department: true,
        competencyMatrices: {
          select: {
            skillName: true,
            proficiencyScore: true,
          },
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const employees = users.map((user) => {
      const rawCompetencyRows =
        user.competencyMatrices ?? user.competencies ?? [];
      const scoreBySkill = new Map<string, number>(
        rawCompetencyRows.map(
          (c: { skillName: string; proficiencyScore: unknown }) => [
            c.skillName,
            Number(c.proficiencyScore),
          ],
        ),
      );

      const targetSkills: string[] = skills.length > 0 ? skills : Array.from(scoreBySkill.keys());

      const competencies: EmployeeSkillItem[] = targetSkills.map((skillName: string) => {
        const rawScore = scoreBySkill.get(skillName) ?? 0;
        const evaluation = evaluateCompetency(rawScore, user.position);
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
              (competencies.reduce((sum: number, item: EmployeeSkillItem) => sum + item.score, 0) /
                competencies.length) *
                10,
            ) / 10
          : 0;

      return {
        userId: user.id,
        fullName: user.fullName,
        department: user.department ?? 'Unassigned',
        position: user.position,
        avgScore,
        competencies,
      };
    });

    const positionSummary = this.aggregateByFivePositions(employees);

    const responsePayload = {
      success: true,
      statusCode: 200,
      message: 'Lấy dữ liệu ma trận năng lực thành công',
      data: {
        skills,
        totalEmployees: employees.length,
        employees,
        positionSummary,
      },
    };

    if (this.redis) {
      await this.redis.set(
        cacheKey,
        JSON.stringify(responsePayload),
        'EX',
        this.CACHE_TTL_SECONDS,
      );
    }

    return responsePayload;
  }

  aggregateByFivePositions(
    employees: Array<{
      position: PositionEnum;
      avgScore: number;
      competencies: EmployeeSkillItem[];
    }>,
  ): PositionCompetencySummary[] {
    return ALL_POSITIONS.map((position: PositionEnum) => {
      const group = employees.filter((e) => e.position === position);
      const totalEmployees = group.length;

      const assessedEmployees = group.filter((e) =>
        e.competencies.some((c: EmployeeSkillItem) => c.score > 0),
      ).length;

      const avgProficiencyScore =
        totalEmployees > 0
          ? Math.round(
              (group.reduce((sum: number, e) => sum + e.avgScore, 0) / totalEmployees) * 10,
            ) / 10
          : 0;

      let passedSkillCount = 0;
      let gapSkillCount = 0;

      for (const emp of group) {
        for (const comp of emp.competencies) {
          if (comp.status === 'PASSED') {
            passedSkillCount++;
          } else {
            gapSkillCount++;
          }
        }
      }

      const totalEvaluatedSkills = passedSkillCount + gapSkillCount;
      const passedRate =
        totalEvaluatedSkills > 0
          ? Math.round((passedSkillCount / totalEvaluatedSkills) * 1000) / 10
          : 0;

      return {
        position,
        requiredScore: POSITION_REQUIRED_SCORES[position],
        totalEmployees,
        assessedEmployees,
        avgProficiencyScore,
        passedSkillCount,
        gapSkillCount,
        passedRate,
      };
    });
  }

  private async invalidateMatrixCache() {
    if (this.redis) {
      await this.redis.del(`${this.CACHE_PREFIX}:all:all:all`);
    }
  }
}