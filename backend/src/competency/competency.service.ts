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
  roundScore,
} from './competency.constants.js';
import { CompetencyMatrixQueryDto } from './dto/competency-query.dto.js';

export interface RedisCacheClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: string, duration?: number): Promise<unknown>;
  del(...keys: string[]): Promise<unknown>;
  keys?(pattern: string): Promise<string[]>;
}

export interface EmployeeSkillItem {
  skillName: string;
  score: number | null;
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
  private readonly trackedCacheKeys = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject('REDIS_CLIENT') private readonly redis?: RedisCacheClient,
  ) {}

  /**
   * Lắng nghe sự kiện nộp bài kiểm tra Quiz (WP9 9.4) để tự động đồng bộ điểm vào Ma trận Năng lực
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
      throw new NotFoundException(
        `Không tìm thấy Quiz hoặc Module tương ứng (quizId=${quizId})`,
      );
    }

    const skillName = normalizeSkillName(quiz.module.title);

    // Lấy toàn bộ lượt thi của user để tính MAX(score) trên từng Quiz thuộc cùng nhóm kỹ năng
    const attempts: Array<{
      quizId?: string;
      score: unknown;
      quiz?: { module?: { title?: string } | null } | null;
    }> = await this.prisma.quizAttempt.findMany({
      where: { userId },
      include: {
        quiz: {
          include: { module: true },
        },
      },
    });

    if (!attempts || attempts.length === 0) {
      return null;
    }

    const maxScoreByQuiz = new Map<string, number>();

    for (const attempt of attempts) {
      const attemptModuleTitle = attempt.quiz?.module?.title;
      // Hỗ trợ cả dữ liệu đầy đủ lẫn mock đơn giản chỉ trả về { score } cho quiz hiện tại
      if (attemptModuleTitle && normalizeSkillName(attemptModuleTitle) !== skillName) {
        continue;
      }

      const targetQuizId = attempt.quizId ?? quizId;
      const numericScore = Number(attempt.score);
      const currentMax = maxScoreByQuiz.get(targetQuizId);
      if (currentMax === undefined || numericScore > currentMax) {
        maxScoreByQuiz.set(targetQuizId, numericScore);
      }
    }

    if (maxScoreByQuiz.size === 0) {
      return null;
    }

    const quizBestScores = Array.from(maxScoreByQuiz.values());
    const avgBestScore = roundScore(
      quizBestScores.reduce((sum, s) => sum + s, 0) / quizBestScores.length,
    );

    const record = await this.prisma.competencyMatrix.upsert({
      where: {
        userId_skillName: {
          userId,
          skillName,
        },
      },
      update: {
        proficiencyScore: avgBestScore,
      },
      create: {
        userId,
        skillName,
        proficiencyScore: avgBestScore,
      },
    });

    await this.invalidateMatrixCache();
    return record;
  }

  async recalculateAllCompetencies(): Promise<{
    processedUsers: number;
    updatedRecords: number;
  }> {
    const attempts = await this.prisma.quizAttempt.findMany({
      include: {
        quiz: {
          include: { module: true },
        },
      },
    });

    // userId -> skillName -> quizId -> maxScore
    const userSkillQuizBest = new Map<string, Map<string, Map<string, number>>>();

    for (const attempt of attempts) {
      if (!attempt.quiz?.module) continue;
      const skillName = normalizeSkillName(attempt.quiz.module.title);
      const numericScore = Number(attempt.score);

      if (!userSkillQuizBest.has(attempt.userId)) {
        userSkillQuizBest.set(attempt.userId, new Map());
      }
      const skillMap = userSkillQuizBest.get(attempt.userId)!;

      if (!skillMap.has(skillName)) {
        skillMap.set(skillName, new Map());
      }
      const quizMap = skillMap.get(skillName)!;

      const existingMax = quizMap.get(attempt.quizId);
      if (existingMax === undefined || numericScore > existingMax) {
        quizMap.set(attempt.quizId, numericScore);
      }
    }

    const uniqueUsers = new Set<string>();
    let updatedRecords = 0;

    for (const [userId, skillMap] of userSkillQuizBest.entries()) {
      uniqueUsers.add(userId);
      for (const [skillName, quizMap] of skillMap.entries()) {
        const scores = Array.from(quizMap.values());
        const finalScore = roundScore(
          scores.reduce((sum, s) => sum + s, 0) / scores.length,
        );

        await this.prisma.competencyMatrix.upsert({
          where: {
            userId_skillName: {
              userId,
              skillName,
            },
          },
          update: { proficiencyScore: finalScore },
          create: {
            userId,
            skillName,
            proficiencyScore: finalScore,
          },
        });
        updatedRecords++;
      }
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

      const targetSkills: string[] =
        skills.length > 0 ? skills : Array.from(scoreBySkill.keys());

      const competencies: EmployeeSkillItem[] = targetSkills.map((skillName: string) => {
        const hasScore = scoreBySkill.has(skillName);
        const rawScore = hasScore ? scoreBySkill.get(skillName)! : null;
        const evaluation = evaluateCompetency(rawScore, user.position);

        return {
          skillName,
          score: rawScore !== null ? roundScore(rawScore) : null,
          requiredScore: evaluation.requiredScore,
          status: evaluation.status,
          level: evaluation.level,
          gapDelta: evaluation.gapDelta,
        };
      });

      const assessedItems = competencies.filter((item) => item.score !== null);
      const avgScore =
        assessedItems.length > 0
          ? roundScore(
              assessedItems.reduce(
                (sum: number, item: EmployeeSkillItem) => sum + (item.score ?? 0),
                0,
              ) / assessedItems.length,
            )
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
      this.trackedCacheKeys.add(cacheKey);
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

      const assessedGroup = group.filter((e) =>
        e.competencies.some((c: EmployeeSkillItem) => c.status !== 'NOT_ASSESSED'),
      );
      const assessedEmployees = assessedGroup.length;

      const avgProficiencyScore =
        assessedEmployees > 0
          ? roundScore(
              assessedGroup.reduce((sum, e) => sum + e.avgScore, 0) / assessedEmployees,
            )
          : 0;

      let passedSkillCount = 0;
      let gapSkillCount = 0;

      for (const emp of group) {
        for (const comp of emp.competencies) {
          if (comp.status === 'PASSED') {
            passedSkillCount++;
          } else if (comp.status === 'GAP') {
            gapSkillCount++;
          }
          // NOT_ASSESSED không tính vào gapSkillCount
        }
      }

      const totalEvaluatedSkills = passedSkillCount + gapSkillCount;
      const passedRate =
        totalEvaluatedSkills > 0
          ? roundScore((passedSkillCount / totalEvaluatedSkills) * 100)
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
    if (!this.redis) return;
    try {
      const keysToDelete = new Set<string>([
        `${this.CACHE_PREFIX}:all:all:all`,
        ...this.trackedCacheKeys,
      ]);

      if (typeof this.redis.keys === 'function') {
        const matchedKeys = await this.redis.keys(`${this.CACHE_PREFIX}:*`);
        for (const k of matchedKeys) {
          keysToDelete.add(k);
        }
      }

      if (keysToDelete.size > 0) {
        await this.redis.del(...Array.from(keysToDelete));
      }
      this.trackedCacheKeys.clear();
    } catch (err) {
      this.logger.warn(
        `Không thể xóa Redis cache ma trận năng lực: ${(err as Error).message}`,
      );
    }
  }
}