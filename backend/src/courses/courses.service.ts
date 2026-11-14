import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import { paginate } from '../common/utils/pagination.util.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { EnrollmentStatus, Prisma, RoleCode } from '../generated/prisma/client.js';
import {
  CreateCourseDto,
  PublishCourseDto,
  QueryCoursesDto,
  UpdateCourseDto,
} from './dto/course.dto.js';

@Injectable()
export class CoursesService {
  private readonly logger = new Logger(CoursesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async create(dto: CreateCourseDto, actor: AuthenticatedUser) {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.prisma.course.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        `Mã khóa học "${code}" đã tồn tại trong hệ thống.`,
        HttpStatus.CONFLICT,
      );
    }

    const created = await this.prisma.course.create({
      data: {
        code,
        title: dto.title.trim(),
        description: dto.description?.trim() ?? null,
        estimatedHours: dto.estimatedHours ?? 0,
        createdById: actor.id,
        isPublished: false,
      },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    await this.invalidateCourseCaches(created.id);
    this.logger.log(
      `Audit: actor=${actor.id} created course id=${created.id} code=${created.code}`,
    );
    return created;
  }

  async findAll(actor: AuthenticatedUser, query: QueryCoursesDto = {}) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const skip = (safePage - 1) * safeLimit;

    const hashPayload = JSON.stringify({
      role: actor.role,
      userId:
        actor.role === RoleCode.EMPLOYEE || query.mine ? actor.id : 'shared',
      page: safePage,
      limit: safeLimit,
      search: query.search?.trim().toLowerCase() ?? '',
      isPublished: query.isPublished ?? null,
      mine: query.mine ?? false,
    });
    const hash = createHash('sha1').update(hashPayload).digest('hex');
    const cacheKey = `lms:courses:list:${hash}`;

    return this.redis.remember(cacheKey, 60, async () => {
      const where: Prisma.CourseWhereInput = {
        deletedAt: null,
      };

      if (actor.role === RoleCode.EMPLOYEE) {
        // R10: Học viên chỉ nhìn thấy các khóa học đã xuất bản và được giao cho mình
        where.isPublished = true;
        where.AND = [
          {
            OR: [
              {
                courseEnrollments: {
                  some: { userId: actor.id },
                },
              },
              {
                pathCourses: {
                  some: {
                    learningPath: {
                      pathEnrollments: {
                        some: { userId: actor.id },
                      },
                    },
                  },
                },
              },
            ],
          },
        ];
      } else {
        if (query.isPublished !== undefined) {
          where.isPublished = query.isPublished;
        }
        if (query.mine) {
          where.createdById = actor.id;
        }
      }

      if (query.search?.trim()) {
        const q = query.search.trim();
        where.OR = [
          { title: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ];
      }

      const [items, total] = await Promise.all([
        this.prisma.course.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: safeLimit,
          include: {
            createdBy: {
              select: { id: true, fullName: true, email: true },
            },
            _count: {
              select: {
                modules: { where: { deletedAt: null } },
                courseEnrollments: true,
              },
            },
          },
        }),
        this.prisma.course.count({ where }),
      ]);

      return paginate(items, total, safePage, safeLimit);
    });
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const course = await this.prisma.course.findFirst({
      where: { id, deletedAt: null },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
        modules: {
          where: { deletedAt: null },
          orderBy: { moduleOrder: 'asc' },
          include: {
            lessons: {
              where: { deletedAt: null },
              orderBy: { lessonOrder: 'asc' },
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
    });

    if (!course) {
      throw this.notFound(id);
    }

    if (actor.role === RoleCode.EMPLOYEE) {
      if (!course.isPublished) {
        throw this.notFound(id);
      }

      const isEnrolled = await this.isEmployeeEnrolledInCourse(
        actor.id,
        course.id,
      );
      if (!isEnrolled) {
        throw this.notFound(id);
      }

      // Ẩn contentUrl và contentText trong cây khóa học đối với học viên (WP5 5.1)
      return {
        ...course,
        modules: course.modules.map((mod) => ({
          ...mod,
          lessons: mod.lessons.map(
            ({ contentUrl: _u, contentText: _t, ...lessonRest }) => lessonRest,
          ),
        })),
      };
    }

    return course;
  }

  async update(id: string, dto: UpdateCourseDto, actor: AuthenticatedUser) {
    const course = await this.findActiveOrThrow(id);
    this.assertOwnership(course, actor);

    const data: Prisma.CourseUpdateInput = {};

    if (dto.code !== undefined) {
      const normalizedCode = dto.code.trim().toUpperCase();
      if (normalizedCode !== course.code) {
        const hasEnrollment = await this.hasAnyEnrollment(id);
        if (hasEnrollment) {
          throw new BusinessException(
            ErrorCode.UNPROCESSABLE_ENTITY,
            'Không thể thay đổi mã khóa học (code) khi khóa học đã được giao cho học viên.',
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }

        const duplicate = await this.prisma.course.findUnique({
          where: { code: normalizedCode },
          select: { id: true },
        });
        if (duplicate && duplicate.id !== id) {
          throw new BusinessException(
            ErrorCode.CONFLICT,
            `Mã khóa học "${normalizedCode}" đã tồn tại.`,
            HttpStatus.CONFLICT,
          );
        }
        data.code = normalizedCode;
      }
    }

    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.description !== undefined) {
      data.description = dto.description.trim();
    }
    if (dto.estimatedHours !== undefined) {
      data.estimatedHours = dto.estimatedHours;
    }

    const updated = await this.prisma.course.update({
      where: { id },
      data,
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    await this.invalidateCourseCaches(id);
    return updated;
  }

  async publish(id: string, dto: PublishCourseDto, actor: AuthenticatedUser) {
    const course = await this.findActiveOrThrow(id);
    this.assertOwnership(course, actor);

    if (dto.isPublished) {
      const [moduleCount, lessonCount] = await Promise.all([
        this.prisma.module.count({
          where: { courseId: id, deletedAt: null },
        }),
        this.prisma.lesson.count({
          where: {
            deletedAt: null,
            module: { courseId: id, deletedAt: null },
          },
        }),
      ]);

      if (moduleCount < 1 || lessonCount < 1) {
        throw new BusinessException(
          ErrorCode.UNPROCESSABLE_ENTITY,
          'Khóa học phải có ít nhất 1 học phần (module) và 1 bài học (lesson) trước khi xuất bản.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    } else {
      const hasEnrollment = await this.hasAnyEnrollment(id);
      if (hasEnrollment) {
        throw new BusinessException(
          ErrorCode.UNPROCESSABLE_ENTITY,
          'Không thể hủy xuất bản khóa học đang được giao cho học viên.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    const updated = await this.prisma.course.update({
      where: { id },
      data: { isPublished: dto.isPublished },
      include: {
        createdBy: {
          select: { id: true, fullName: true, email: true },
        },
      },
    });

    await this.invalidateCourseCaches(id);
    this.logger.log(
      `Audit: actor=${actor.id} set isPublished=${dto.isPublished} on course=${id}`,
    );
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    const course = await this.findActiveOrThrow(id);
    this.assertOwnership(course, actor);

    const [pathRefs, activeEnrollments] = await Promise.all([
      this.prisma.pathCourse.findMany({
        where: {
          courseId: id,
          learningPath: { archivedAt: null },
        },
        include: {
          learningPath: { select: { id: true, code: true, title: true } },
        },
      }),
      this.prisma.courseEnrollment.count({
        where: {
          courseId: id,
          status: EnrollmentStatus.IN_PROGRESS,
        },
      }),
    ]);

    if (pathRefs.length > 0 || activeEnrollments > 0) {
      const details = [
        ...pathRefs.map((ref) => ({
          type: 'LEARNING_PATH',
          pathId: ref.learningPath.id,
          code: ref.learningPath.code,
          title: ref.learningPath.title,
        })),
        ...(activeEnrollments > 0
          ? [
              {
                type: 'COURSE_ENROLLMENT_IN_PROGRESS',
                count: activeEnrollments,
              },
            ]
          : []),
      ];

      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Không thể xóa khóa học đang nằm trong Lộ trình học tập hoặc có học viên đang theo học (IN_PROGRESS).',
        HttpStatus.UNPROCESSABLE_ENTITY,
        details,
      );
    }

    const removed = await this.prisma.course.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isPublished: false,
      },
    });

    await this.invalidateCourseCaches(id);
    this.logger.log(`Audit: actor=${actor.id} soft-deleted course=${id}`);
    return removed;
  }

  /**
   * Kiểm tra quyền sở hữu khóa học (dùng chung cho Course, Module, Lesson – WP5 Task chung):
   * - ADMIN được phép thao tác mọi khóa học.
   * - TRAINER chỉ được ghi khóa học có `createdById === actor.id`.
   */
  assertOwnership(
    course: { id: string; createdById: string },
    actor: AuthenticatedUser,
  ): void {
    if (actor.role === RoleCode.ADMIN) {
      return;
    }
    if (actor.role === RoleCode.TRAINER && course.createdById === actor.id) {
      return;
    }
    throw new BusinessException(
      ErrorCode.AUTH_FORBIDDEN,
      'Bạn chỉ có quyền chỉnh sửa khóa học do chính mình tạo.',
      HttpStatus.FORBIDDEN,
    );
  }

  async assertOwnershipByCourseId(
    courseId: string,
    actor: AuthenticatedUser,
  ) {
    const course = await this.findActiveOrThrow(courseId);
    this.assertOwnership(course, actor);
    return course;
  }

  async invalidateCourseCaches(courseId: string): Promise<void> {
    await Promise.all([
      this.redis.delByPattern('lms:courses:list:*'),
      this.redis.del(`lms:structure:${courseId}`),
    ]);
  }

  private async findActiveOrThrow(id: string) {
    const course = await this.prisma.course.findFirst({
      where: { id, deletedAt: null },
    });
    if (!course) {
      throw this.notFound(id);
    }
    return course;
  }

  async isUserEnrolledInCourse(
    userId: string,
    courseId: string,
  ): Promise<boolean> {
    return this.isEmployeeEnrolledInCourse(userId, courseId);
  }

  private async isEmployeeEnrolledInCourse(
    userId: string,
    courseId: string,
  ): Promise<boolean> {
    const [directCount, pathCount] = await Promise.all([
      this.prisma.courseEnrollment.count({
        where: { userId, courseId },
      }),
      this.prisma.pathEnrollment.count({
        where: {
          userId,
          learningPath: {
            pathCourses: {
              some: { courseId },
            },
          },
        },
      }),
    ]);
    return directCount > 0 || pathCount > 0;
  }

  private async hasAnyEnrollment(courseId: string): Promise<boolean> {
    const [directCount, pathCount] = await Promise.all([
      this.prisma.courseEnrollment.count({
        where: { courseId },
      }),
      this.prisma.pathEnrollment.count({
        where: {
          learningPath: {
            pathCourses: {
              some: { courseId },
            },
          },
        },
      }),
    ]);
    return directCount > 0 || pathCount > 0;
  }

  private notFound(id: string): BusinessException {
    return new BusinessException(
      ErrorCode.NOT_FOUND,
      `Không tìm thấy khóa học ${id}.`,
      HttpStatus.NOT_FOUND,
    );
  }
}

