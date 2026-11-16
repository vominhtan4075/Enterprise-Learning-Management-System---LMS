import { HttpStatus, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { AccessService } from '../progress/access.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import { validateReorderIds } from '../common/utils/reorder.util.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Prisma, QuizType, RoleCode } from '../generated/prisma/client.js';
import {
  AddCourseToPathDto,
  CreateLearningPathDto,
  QueryLearningPathsDto,
  ReorderPathCoursesDto,
  UpdateLearningPathDto,
} from './dto/learning-path.dto.js';
import {
  validatePathStructure,
  type PathValidationResult,
} from './path-structure.validator.js';

const PATHS_LIST_CACHE_TTL = 60;

@Injectable()
export class LearningPathsService {
  private readonly logger = new Logger(LearningPathsService.name);
  private readonly expectedUnits: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    @Optional() private readonly accessService?: AccessService,
  ) {
    this.expectedUnits =
      this.configService.get<number>('PATH_REQUIRED_UNITS') ?? 4;
  }

  async findAll(actor: AuthenticatedUser, query: QueryLearningPathsDto) {
    const scopeKey =
      actor.role === RoleCode.EMPLOYEE ? `emp:${actor.id}` : 'staff';
    const queryHash = createHash('md5')
      .update(JSON.stringify(query))
      .digest('hex');
    const cacheKey = `lms:paths:list:${scopeKey}:${queryHash}`;

    return this.redis.remember(cacheKey, PATHS_LIST_CACHE_TTL, async () => {
      const where: Prisma.LearningPathWhereInput = {
        archivedAt: null,
      };

      if (query.targetPosition) {
        where.targetPosition = query.targetPosition;
      }

      if (query.isMandatory !== undefined) {
        where.isMandatory = query.isMandatory;
      }

      if (query.search?.trim()) {
        const s = query.search.trim();
        where.OR = [
          { title: { contains: s, mode: 'insensitive' } },
          { code: { contains: s, mode: 'insensitive' } },
        ];
      }

      if (actor.role === RoleCode.EMPLOYEE) {
        where.pathEnrollments = {
          some: { userId: actor.id },
        };
      }

      const paths = await this.prisma.learningPath.findMany({
        where,
        orderBy: [{ targetPosition: 'asc' }, { createdAt: 'asc' }],
        include: {
          pathCourses: {
            orderBy: { stepOrder: 'asc' },
            include: {
              course: {
                select: {
                  id: true,
                  deletedAt: true,
                  modules: {
                    where: { deletedAt: null },
                    select: {
                      id: true,
                      quiz: {
                        select: { id: true, quizType: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      return paths.map((p) => {
        const activeCourses = p.pathCourses.filter(
          (pc) => pc.course.deletedAt === null,
        );
        let totalUnits = 0;
        let hasFinal = false;

        for (const pc of activeCourses) {
          for (const mod of pc.course.modules) {
            if (mod.quiz?.quizType === QuizType.FINAL) {
              hasFinal = true;
            } else {
              totalUnits++;
            }
          }
        }

        return {
          id: p.id,
          code: p.code,
          title: p.title,
          targetPosition: p.targetPosition,
          description: p.description,
          isMandatory: p.isMandatory,
          estimatedDays: p.estimatedDays,
          totalCourses: activeCourses.length,
          totalUnits,
          hasFinal,
          createdAt: p.createdAt,
          updatedAt: p.updatedAt,
        };
      });
    });
  }

  /**
   * 1 query include sâu lấy toàn bộ cấu trúc lộ trình theo thứ tự (dùng lại ở WP7 & WP8)
   */
  async getOrderedStructure(idOrCode: string) {
    const path = await this.prisma.learningPath.findFirst({
      where: {
        archivedAt: null,
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
      include: {
        pathCourses: {
          orderBy: { stepOrder: 'asc' },
          include: {
            course: {
              select: {
                id: true,
                code: true,
                title: true,
                description: true,
                estimatedHours: true,
                isPublished: true,
                deletedAt: true,
                modules: {
                  where: { deletedAt: null },
                  orderBy: { moduleOrder: 'asc' },
                  select: {
                    id: true,
                    title: true,
                    moduleOrder: true,
                    description: true,
                    dayStart: true,
                    dayEnd: true,
                    lessons: {
                      where: { deletedAt: null },
                      orderBy: { lessonOrder: 'asc' },
                      select: {
                        id: true,
                        title: true,
                        contentType: true,
                        lessonOrder: true,
                        durationMinutes: true,
                        isRequired: true,
                      },
                    },
                    quiz: {
                      select: {
                        id: true,
                        title: true,
                        passingScore: true,
                        timeLimitMin: true,
                        quizType: true,
                        maxAttempts: true,
                        isPublished: true,
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

    if (!path) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy lộ trình học tập "${idOrCode}".`,
        HttpStatus.NOT_FOUND,
      );
    }

    return path;
  }

  async findOne(idOrCode: string, actor: AuthenticatedUser) {
    const path = await this.getOrderedStructure(idOrCode);

    if (actor.role === RoleCode.EMPLOYEE) {
      const enrolledCount = await this.prisma.pathEnrollment.count({
        where: {
          userId: actor.id,
          pathId: path.id,
        },
      });

      if (enrolledCount === 0) {
        throw new BusinessException(
          ErrorCode.NOT_FOUND,
          `Không tìm thấy lộ trình học tập "${idOrCode}".`,
          HttpStatus.NOT_FOUND,
        );
      }

      if (this.accessService) {
        const { merged } = await this.accessService.getUserUnlockSnapshot(
          actor.id,
        );
        return {
          ...path,
          pathCourses: path.pathCourses.map((pc) => ({
            ...pc,
            course: {
              ...pc.course,
              state: merged.courses.get(pc.course.id) ?? 'UNLOCKED',
              modules: pc.course.modules.map((mod) => ({
                ...mod,
                state: merged.modules.get(mod.id) ?? 'UNLOCKED',
                lessons: mod.lessons.map((les) => {
                  const lInfo = merged.lessons.get(les.id);
                  return {
                    ...les,
                    state: lInfo?.state ?? 'UNLOCKED',
                    lockedReason: lInfo?.lockedReason ?? null,
                  };
                }),
                quiz: mod.quiz
                  ? {
                      ...mod.quiz,
                      state:
                        merged.quizzes.get(mod.quiz.id)?.state ?? 'UNLOCKED',
                      lockedReason:
                        merged.quizzes.get(mod.quiz.id)?.lockedReason ?? null,
                    }
                  : null,
              })),
            },
          })),
        };
      }
    }

    return path;
  }

  async create(dto: CreateLearningPathDto, actor: AuthenticatedUser) {
    const code = dto.code
      ? dto.code.trim().toLowerCase()
      : await this.generateUniqueCode(dto.targetPosition, dto.title);

    const existing = await this.prisma.learningPath.findUnique({
      where: { code },
    });
    if (existing) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        `Mã lộ trình "${code}" đã tồn tại trong hệ thống.`,
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.learningPath.create({
      data: {
        code,
        title: dto.title.trim(),
        targetPosition: dto.targetPosition,
        description: dto.description?.trim() ?? null,
        isMandatory: dto.isMandatory ?? true,
        estimatedDays: dto.estimatedDays ?? 30,
      },
    });

    await this.invalidatePathCaches();
    this.logger.log(
      `Audit: actor=${actor.id} created learningPath=${created.id} code=${created.code}`,
    );
    return created;
  }

  async update(
    id: string,
    dto: UpdateLearningPathDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.findActiveByIdOrThrow(id);

    if (dto.code !== undefined && dto.code !== existing.code) {
      const conflict = await this.prisma.learningPath.findUnique({
        where: { code: dto.code },
      });
      if (conflict && conflict.id !== id) {
        throw new BusinessException(
          ErrorCode.CONFLICT,
          `Mã lộ trình "${dto.code}" đã tồn tại.`,
          HttpStatus.CONFLICT,
        );
      }
    }

    const data: Prisma.LearningPathUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.targetPosition !== undefined)
      data.targetPosition = dto.targetPosition;
    if (dto.description !== undefined)
      data.description = dto.description.trim();
    if (dto.isMandatory !== undefined) data.isMandatory = dto.isMandatory;
    if (dto.estimatedDays !== undefined) data.estimatedDays = dto.estimatedDays;
    if (dto.code !== undefined) data.code = dto.code;

    const updated = await this.prisma.learningPath.update({
      where: { id },
      data,
    });

    await this.invalidatePathCaches();
    this.logger.log(`Audit: actor=${actor.id} updated learningPath=${id}`);
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    await this.findActiveByIdOrThrow(id);

    const archived = await this.prisma.learningPath.update({
      where: { id },
      data: { archivedAt: new Date() },
    });

    await this.invalidatePathCaches();
    this.logger.log(`Audit: actor=${actor.id} archived learningPath=${id}`);
    return archived;
  }

  async addCourse(
    pathId: string,
    dto: AddCourseToPathDto,
    actor: AuthenticatedUser,
  ) {
    await this.findActiveByIdOrThrow(pathId);
    await this.assertPathNotInUse(pathId);

    const course = await this.prisma.course.findFirst({
      where: { id: dto.courseId, deletedAt: null },
      select: { id: true, code: true, title: true, isPublished: true },
    });

    if (!course) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy khóa học ${dto.courseId}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    if (!course.isPublished) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        `Khóa học "${course.title}" (${course.code}) chưa được xuất bản nên không thể đưa vào lộ trình.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const duplicate = await this.prisma.pathCourse.findUnique({
      where: {
        pathId_courseId: {
          pathId,
          courseId: dto.courseId,
        },
      },
    });

    if (duplicate) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Khóa học này đã tồn tại trong lộ trình.',
        HttpStatus.CONFLICT,
      );
    }

    const existingSteps = await this.prisma.pathCourse.findMany({
      where: { pathId },
      orderBy: { stepOrder: 'asc' },
      select: { id: true, stepOrder: true },
    });

    const maxOrder =
      existingSteps.length > 0
        ? Math.max(...existingSteps.map((s) => s.stepOrder))
        : 0;

    const targetOrder =
      dto.stepOrder !== undefined
        ? Math.min(dto.stepOrder, maxOrder + 1)
        : maxOrder + 1;

    const created = await this.prisma.$transaction(async (tx) => {
      if (targetOrder <= maxOrder) {
        await tx.pathCourse.updateMany({
          where: {
            pathId,
            stepOrder: { gte: targetOrder },
          },
          data: {
            stepOrder: { increment: 1 },
          },
        });
      }

      return tx.pathCourse.create({
        data: {
          pathId,
          courseId: dto.courseId,
          stepOrder: targetOrder,
        },
        include: {
          course: {
            select: {
              id: true,
              code: true,
              title: true,
              estimatedHours: true,
              isPublished: true,
            },
          },
        },
      });
    });

    await this.invalidatePathCaches();
    this.logger.log(
      `Audit: actor=${actor.id} added course=${dto.courseId} to path=${pathId} stepOrder=${created.stepOrder}`,
    );
    return created;
  }

  async removeCourse(
    pathId: string,
    courseId: string,
    actor: AuthenticatedUser,
  ) {
    await this.findActiveByIdOrThrow(pathId);
    await this.assertPathNotInUse(pathId);

    const existing = await this.prisma.pathCourse.findUnique({
      where: {
        pathId_courseId: {
          pathId,
          courseId,
        },
      },
    });

    if (!existing) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        'Khóa học không nằm trong lộ trình này.',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.pathCourse.delete({
        where: { id: existing.id },
      });

      const remaining = await tx.pathCourse.findMany({
        where: { pathId },
        orderBy: { stepOrder: 'asc' },
        select: { id: true },
      });

      for (let i = 0; i < remaining.length; i++) {
        await tx.pathCourse.update({
          where: { id: remaining[i].id },
          data: { stepOrder: i + 1 },
        });
      }
    });

    await this.invalidatePathCaches();
    this.logger.log(
      `Audit: actor=${actor.id} removed course=${courseId} from path=${pathId}`,
    );
    return { pathId, courseId, removed: true };
  }

  async reorderCourses(
    pathId: string,
    dto: ReorderPathCoursesDto,
    actor: AuthenticatedUser,
  ) {
    await this.findActiveByIdOrThrow(pathId);
    await this.assertPathNotInUse(pathId);

    const existingSteps = await this.prisma.pathCourse.findMany({
      where: { pathId },
      orderBy: { stepOrder: 'asc' },
      select: { id: true, courseId: true },
    });

    validateReorderIds(
      existingSteps.map((s) => s.courseId),
      dto.orderedCourseIds,
      'khóa học trong lộ trình (courseId)',
    );

    const courseIdToPathCourseId = new Map(
      existingSteps.map((s) => [s.courseId, s.id]),
    );

    // Transaction 2 bước (thỏa CHECK step_order > 0):
    // Bước 1: đẩy sang 100_000 + i + 1
    // Bước 2: gán lại dãy liên tục 1..n
    const reordered = await this.prisma.$transaction(async (tx) => {
      for (let i = 0; i < dto.orderedCourseIds.length; i++) {
        const pcId = courseIdToPathCourseId.get(dto.orderedCourseIds[i])!;
        await tx.pathCourse.update({
          where: { id: pcId },
          data: { stepOrder: 100_000 + i + 1 },
        });
      }

      const results = [];
      for (let i = 0; i < dto.orderedCourseIds.length; i++) {
        const pcId = courseIdToPathCourseId.get(dto.orderedCourseIds[i])!;
        const updated = await tx.pathCourse.update({
          where: { id: pcId },
          data: { stepOrder: i + 1 },
        });
        results.push(updated);
      }
      return results;
    });

    await this.invalidatePathCaches();
    this.logger.log(
      `Audit: actor=${actor.id} reordered ${dto.orderedCourseIds.length} courses in path=${pathId}`,
    );
    return reordered;
  }

  async validateStructure(idOrCode: string): Promise<PathValidationResult> {
    const path = await this.getOrderedStructure(idOrCode);
    return validatePathStructure(path, this.expectedUnits);
  }

  async invalidatePathCaches(): Promise<void> {
    await this.redis.delByPattern('lms:paths:list*');
  }

  /**
   * LP-6: Chặn thêm/xóa/đổi thứ tự khóa học nếu lộ trình đã có học viên được giao
   */
  private async assertPathNotInUse(pathId: string): Promise<void> {
    const enrollmentCount = await this.prisma.pathEnrollment.count({
      where: { pathId },
    });

    if (enrollmentCount > 0) {
      throw new BusinessException(
        ErrorCode.PATH_IN_USE,
        'Lộ trình học tập đã được giao cho nhân viên nên không thể thay đổi cấu trúc khóa học (LP-6).',
        HttpStatus.UNPROCESSABLE_ENTITY,
        [{ enrollmentCount }],
      );
    }
  }

  private async findActiveByIdOrThrow(id: string) {
    const path = await this.prisma.learningPath.findFirst({
      where: { id, archivedAt: null },
    });
    if (!path) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy lộ trình học tập ${id}.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return path;
  }

  private async generateUniqueCode(
    targetPosition: string,
    title: string,
  ): Promise<string> {
    const slugTitle = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);

    const base = `path-${targetPosition.toLowerCase()}-${slugTitle || 'custom'}`.slice(
      0,
      50,
    );

    const exists = await this.prisma.learningPath.findUnique({
      where: { code: base },
    });
    if (!exists) {
      return base;
    }

    return `${base}-${Date.now().toString(36).slice(-4)}`;
  }
}
