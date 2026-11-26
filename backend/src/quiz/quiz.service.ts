import {
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma.service.js';
import { AccessService } from '../progress/access.service.js';
import {
  DomainEvents,
  QuizAttemptCompletedEvent,
} from '../common/events/domain-events.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import {
  EnrollmentStatus,
  Prisma,
  QuizType,
  RoleCode,
} from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import {
  CreateQuestionDto,
  CreateQuizDto,
  QuizOptionItemDto,
  SubmitQuizDto,
  UpdateQuestionDto,
  UpdateQuizDto,
} from './quiz.dto.js';
import { CompetencyService } from '../competency/competency.service.js';
import { CoursesService } from '../courses/courses.service.js';

export interface SuggestedLesson {
  lessonId: string;
  lessonTitle: string;
}

@Injectable()
export class QuizService {
  constructor(
    private prisma: PrismaService,
    @Optional() private readonly accessService?: AccessService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
    @Optional() private readonly competencyService?: CompetencyService,
    @Optional() private readonly coursesService?: CoursesService,
  ) {}

  // ===========================================================================
  // QUẢN TRỊ ĐỀ THI & CÂU HỎI (TRAINER / ADMIN)
  // ===========================================================================

  async createQuizForModule(
    moduleId: string,
    dto: CreateQuizDto,
    actor: AuthenticatedUser,
  ) {
    const mod = await this.prisma.module.findFirst({
      where: { id: moduleId, deletedAt: null },
      include: {
        course: {
          select: { id: true, createdById: true, deletedAt: true },
        },
        quiz: {
          select: { id: true },
        },
      },
    });

    if (!mod || mod.course.deletedAt) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy học phần ${moduleId}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    this.assertCourseWritePermission(mod.course, actor);

    if (mod.quiz) {
      throw new BusinessException(
        ErrorCode.CONFLICT,
        'Học phần này đã có đề kiểm tra Quiz (quan hệ 1-1).',
        HttpStatus.CONFLICT,
      );
    }

    if (dto.isPublished === true && actor.role !== RoleCode.ADMIN) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Không thể xuất bản ngay đề thi chưa có câu hỏi nào. Vui lòng tạo ở trạng thái nháp và thêm câu hỏi trước.',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const created = await this.prisma.quiz.create({
      data: {
        moduleId,
        title: dto.title.trim(),
        quizType: dto.quizType ?? QuizType.MODULE,
        passingScore: dto.passingScore ?? 70,
        timeLimitMin: dto.timeLimitMin ?? null,
        maxAttempts: dto.maxAttempts ?? 3,
        isPublished:
          actor.role === RoleCode.ADMIN ? (dto.isPublished ?? false) : false,
      },
      include: {
        _count: {
          select: { quizAttempts: true },
        },
      },
    });

    await this.coursesService?.invalidateCourseCaches(mod.course.id);
    return created;
  }

  async updateQuiz(
    quizId: string,
    dto: UpdateQuizDto,
    actor: AuthenticatedUser,
  ) {
    const quiz = await this.findQuizWithCourseOrThrow(quizId);
    this.assertCourseWritePermission(quiz.module.course, actor);

    if (actor.role !== RoleCode.ADMIN) {
      if (dto.isPublished === true) {
        const activeQuestionCount = await this.prisma.question.count({
          where: { quizId, deletedAt: null, isActive: true },
        });
        if (activeQuestionCount < 1) {
          throw new BusinessException(
            ErrorCode.UNPROCESSABLE_ENTITY,
            'Đề thi phải có ít nhất 1 câu hỏi đang hoạt động trước khi xuất bản.',
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      } else if (
        dto.isPublished === false &&
        quiz.isPublished &&
        quiz.quizType === QuizType.FINAL
      ) {
        const activePathLearnerCount = await this.prisma.pathEnrollment.count({
          where: {
            status: EnrollmentStatus.IN_PROGRESS,
            learningPath: {
              archivedAt: null,
              pathCourses: {
                some: { courseId: quiz.module.course.id },
              },
            },
          },
        });
        if (activePathLearnerCount > 0) {
          throw new BusinessException(
            ErrorCode.UNPROCESSABLE_ENTITY,
            'Không thể hủy xuất bản bài kiểm tra tổng hợp cuối khóa (FINAL) khi lộ trình đang có học viên theo học (IN_PROGRESS).',
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }
    }

    const data: Prisma.QuizUpdateInput = {};
    if (dto.title !== undefined) {
      data.title = dto.title.trim();
    }
    if (dto.quizType !== undefined) {
      data.quizType = dto.quizType;
    }
    if (dto.passingScore !== undefined) {
      data.passingScore = dto.passingScore;
    }
    if (dto.timeLimitMin !== undefined) {
      data.timeLimitMin = dto.timeLimitMin;
    }
    if (dto.maxAttempts !== undefined) {
      data.maxAttempts = dto.maxAttempts;
    }
    if (dto.isPublished !== undefined) {
      data.isPublished = dto.isPublished;
    }

    const updated = await this.prisma.quiz.update({
      where: { id: quizId },
      data,
      include: {
        _count: {
          select: { quizAttempts: true },
        },
      },
    });

    await this.coursesService?.invalidateCourseCaches(quiz.module.course.id);
    return updated;
  }

  async deleteQuiz(quizId: string, actor: AuthenticatedUser) {
    const quiz = await this.findQuizWithCourseOrThrow(quizId);
    this.assertCourseWritePermission(quiz.module.course, actor);

    if (actor.role !== RoleCode.ADMIN) {
      const attemptCount = await this.prisma.quizAttempt.count({
        where: { quizId },
      });

      if (attemptCount > 0) {
        throw new BusinessException(
          ErrorCode.UNPROCESSABLE_ENTITY,
          'Không thể xóa đề thi đã có học viên làm bài.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }

      // Đề nháp (isPublished = false) chưa ai làm bài -> cho phép giảng viên xóa ngay.
      // Chỉ chặn khi đề đang xuất bản (isPublished = true) và khóa học đang có người học IN_PROGRESS / thuộc lộ trình active.
      if (quiz.isPublished) {
        const [activeDirectCount, activePathEnrollmentCount] =
          await Promise.all([
            this.prisma.courseEnrollment?.count
              ? this.prisma.courseEnrollment.count({
                  where: {
                    courseId: quiz.module.course.id,
                    status: EnrollmentStatus.IN_PROGRESS,
                  },
                })
              : Promise.resolve(0),
            this.prisma.pathEnrollment.count({
              where: {
                status: EnrollmentStatus.IN_PROGRESS,
                learningPath: {
                  archivedAt: null,
                  pathCourses: {
                    some: { courseId: quiz.module.course.id },
                  },
                },
              },
            }),
          ]);

        if (activeDirectCount > 0 || activePathEnrollmentCount > 0) {
          throw new BusinessException(
            ErrorCode.UNPROCESSABLE_ENTITY,
            'Không thể xóa đề thi đang xuất bản khi khóa học đang có học viên theo học (IN_PROGRESS).',
            HttpStatus.UNPROCESSABLE_ENTITY,
          );
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      if (typeof tx.quizAttempt?.deleteMany === 'function') {
        await tx.quizAttempt.deleteMany({ where: { quizId } });
      }
      await tx.question.deleteMany({ where: { quizId } });
      await tx.quiz.delete({ where: { id: quizId } });
    });

    await this.coursesService?.invalidateCourseCaches(quiz.module.course.id);
    return {
      id: quizId,
      message: 'Đã xóa đề kiểm tra thành công.',
    };
  }

  async createQuestion(
    quizId: string,
    dto: CreateQuestionDto,
    actor: AuthenticatedUser,
  ) {
    const quiz = await this.findQuizWithCourseOrThrow(quizId);
    this.assertCourseWritePermission(quiz.module.course, actor);

    const { normalizedOptions, normalizedCorrectAnswer } =
      this.normalizeAndValidateOptions(dto.options, dto.correctAnswer);

    const relatedLessonId = dto.relatedLessonId?.trim() || null;
    if (relatedLessonId) {
      await this.assertLessonBelongsToCourse(
        relatedLessonId,
        quiz.module.course.id,
      );
    }

    const created = await this.prisma.question.create({
      data: {
        quizId,
        questionText: dto.questionText.trim(),
        options: normalizedOptions as unknown as Prisma.InputJsonValue,
        correctAnswer: normalizedCorrectAnswer,
        relatedLessonId,
        skillName: dto.skillName?.trim() || null,
        explanation: dto.explanation?.trim() || null,
        conceptTag: dto.conceptTag?.trim() || null,
        isActive: dto.isActive ?? true,
      },
      include: {
        relatedLesson: {
          select: { id: true, title: true, lessonOrder: true },
        },
      },
    });

    await this.coursesService?.invalidateCourseCaches(quiz.module.course.id);
    return created;
  }

  async updateQuestion(
    questionId: string,
    dto: UpdateQuestionDto,
    actor: AuthenticatedUser,
  ) {
    const existing = await this.findQuestionWithCourseOrThrow(questionId);
    this.assertCourseWritePermission(existing.quiz.module.course, actor);

    const existingOptions = Array.isArray(existing.options)
      ? (existing.options as unknown as QuizOptionItemDto[])
      : [];
    const targetOptions = dto.options ?? existingOptions;
    const targetCorrect = dto.correctAnswer ?? existing.correctAnswer;

    const { normalizedOptions, normalizedCorrectAnswer } =
      this.normalizeAndValidateOptions(targetOptions, targetCorrect);

    let nextRelatedLessonId: string | null | undefined;
    if (dto.relatedLessonId !== undefined) {
      const trimmed = dto.relatedLessonId?.trim() || null;
      if (trimmed) {
        await this.assertLessonBelongsToCourse(
          trimmed,
          existing.quiz.module.course.id,
        );
      }
      nextRelatedLessonId = trimmed;
    }

    if (
      actor.role !== RoleCode.ADMIN &&
      dto.isActive === false &&
      existing.isActive &&
      existing.quiz.isPublished
    ) {
      const otherActiveCount = await this.prisma.question.count({
        where: {
          quizId: existing.quizId,
          deletedAt: null,
          isActive: true,
          id: { not: questionId },
        },
      });
      if (otherActiveCount < 1) {
        throw new BusinessException(
          ErrorCode.UNPROCESSABLE_ENTITY,
          'Không thể tắt câu hỏi hoạt động cuối cùng của đề thi đang xuất bản.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    const data: Prisma.QuestionUpdateInput = {
      options: normalizedOptions as unknown as Prisma.InputJsonValue,
      correctAnswer: normalizedCorrectAnswer,
    };

    if (dto.questionText !== undefined) {
      data.questionText = dto.questionText.trim();
    }
    if (nextRelatedLessonId !== undefined) {
      data.relatedLesson = nextRelatedLessonId
        ? { connect: { id: nextRelatedLessonId } }
        : { disconnect: true };
    }
    if (dto.skillName !== undefined) {
      data.skillName = dto.skillName?.trim() || null;
    }
    if (dto.explanation !== undefined) {
      data.explanation = dto.explanation?.trim() || null;
    }
    if (dto.conceptTag !== undefined) {
      data.conceptTag = dto.conceptTag?.trim() || null;
    }
    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    const updated = await this.prisma.question.update({
      where: { id: questionId },
      data,
      include: {
        relatedLesson: {
          select: { id: true, title: true, lessonOrder: true },
        },
      },
    });

    await this.coursesService?.invalidateCourseCaches(
      existing.quiz.module.course.id,
    );
    return updated;
  }

  async deleteQuestion(questionId: string, actor: AuthenticatedUser) {
    const existing = await this.findQuestionWithCourseOrThrow(questionId);
    this.assertCourseWritePermission(existing.quiz.module.course, actor);

    if (
      actor.role !== RoleCode.ADMIN &&
      existing.isActive &&
      existing.quiz.isPublished
    ) {
      const otherActiveCount = await this.prisma.question.count({
        where: {
          quizId: existing.quizId,
          deletedAt: null,
          isActive: true,
          id: { not: questionId },
        },
      });
      if (otherActiveCount < 1) {
        throw new BusinessException(
          ErrorCode.UNPROCESSABLE_ENTITY,
          'Không thể xóa câu hỏi hoạt động cuối cùng của đề thi đang xuất bản. Vui lòng hủy xuất bản đề thi hoặc thêm câu hỏi khác trước.',
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    }

    await this.prisma.question.update({
      where: { id: questionId },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    await this.coursesService?.invalidateCourseCaches(
      existing.quiz.module.course.id,
    );
    return {
      id: questionId,
      message: 'Đã xóa câu hỏi thành công.',
    };
  }

  // ===========================================================================
  // ĐỌC ĐỀ THI (PHÂN NHÁNH THEO ROLE) & CHẤM ĐIỂM QUIZ (BR-01, BR-02, BR-03)
  // ===========================================================================

  async getQuizForTaking(quizId: string, actor?: AuthenticatedUser) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        module: {
          select: {
            id: true,
            title: true,
            moduleOrder: true,
            courseId: true,
            deletedAt: true,
            course: {
              select: {
                id: true,
                code: true,
                title: true,
                createdById: true,
                deletedAt: true,
              },
            },
          },
        },
        questions: {
          where: { deletedAt: null },
          orderBy: { updatedAt: 'asc' },
          include: {
            relatedLesson: {
              select: { id: true, title: true, lessonOrder: true },
            },
          },
        },
        _count: {
          select: { quizAttempts: true },
        },
      },
    });

    if (!quiz || quiz.module?.deletedAt || quiz.module?.course?.deletedAt) {
      throw new NotFoundException('Không tìm thấy bài thi.');
    }

    const canViewManageDetails =
      actor?.role === RoleCode.ADMIN ||
      actor?.role === RoleCode.HR ||
      (actor?.role === RoleCode.TRAINER &&
        quiz.module?.course?.createdById === actor.id);

    if (canViewManageDetails) {
      return quiz;
    }

    if (actor?.role === RoleCode.EMPLOYEE && this.accessService) {
      await this.accessService.assertCanAccessQuiz(actor.id, quizId);
    }

    const maxAttempts = Number(quiz.maxAttempts ?? 3);
    let attemptsUsed = 0;
    let bestScore: number | null = null;
    let hasPassed = false;
    let attemptHistory: Array<{
      id: string;
      attemptNumber: number;
      score: number;
      isPassed: boolean;
      submittedAt: Date | null;
    }> = [];

    if (
      actor?.id &&
      typeof this.prisma.quizAttempt?.findMany === 'function'
    ) {
      const pastAttempts = await this.prisma.quizAttempt.findMany({
        where: { quizId, userId: actor.id },
        orderBy: { attemptNumber: 'asc' },
        select: {
          id: true,
          attemptNumber: true,
          score: true,
          isPassed: true,
          submittedAt: true,
          createdAt: true,
        },
      });
      attemptsUsed = pastAttempts.length;
      if (attemptsUsed > 0) {
        bestScore = Math.max(
          ...pastAttempts.map((a) => Math.round(Number(a.score) * 10) / 10),
        );
        hasPassed = pastAttempts.some((a) => Boolean(a.isPassed));
        attemptHistory = pastAttempts.map((a, idx) => ({
          id: a.id ?? `attempt-${idx + 1}`,
          attemptNumber: a.attemptNumber ?? idx + 1,
          score: Math.round(Number(a.score) * 10) / 10,
          isPassed: Boolean(a.isPassed),
          submittedAt: a.submittedAt ?? a.createdAt ?? null,
        }));
      }
    }

    const remainingAttempts = Math.max(0, maxAttempts - attemptsUsed);

    const { _count: _ignoredCount, module: rawModule, questions, ...rest } = quiz;
    return {
      ...rest,
      attemptsUsed,
      remainingAttempts,
      bestScore,
      hasPassed,
      attemptHistory,
      module: rawModule
        ? {
            id: rawModule.id,
            title: rawModule.title,
            moduleOrder: rawModule.moduleOrder,
            courseId: rawModule.courseId,
          }
        : undefined,
      questions: questions
        .filter((q) => q.isActive !== false)
        .map((q) => ({
          id: q.id,
          questionText: q.questionText,
          options: q.options,
          skillName: q.skillName,
          conceptTag: q.conceptTag,
          relatedLessonId: q.relatedLessonId,
        })),
    };
  }

  async submitQuiz(
    quizId: string,
    userId: string,
    submitDto: SubmitQuizDto,
    actor?: AuthenticatedUser,
  ) {
    if (actor?.role === RoleCode.EMPLOYEE && this.accessService) {
      await this.accessService.assertCanAccessQuiz(userId, quizId);
    }

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          where: { deletedAt: null, isActive: true },
          include: { relatedLesson: true },
        },
        module: {
          include: {
            lessons: {
              where: { deletedAt: null },
              orderBy: { lessonOrder: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!quiz) throw new NotFoundException('Không tìm thấy bài thi.');

    const previousAttempts = await this.prisma.quizAttempt.count({
      where: { quizId, userId },
    });
    const maxAttempts = Number(quiz.maxAttempts ?? 3);

    if (maxAttempts > 0 && previousAttempts >= maxAttempts) {
      throw new BusinessException(
        ErrorCode.QUIZ_MAX_ATTEMPTS_REACHED,
        `Bạn đã sử dụng hết số lượt làm bài tối đa (${maxAttempts}/${maxAttempts} lượt) cho bài kiểm tra này.`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const { correctAnswersCount, suggestedLessons } = this.evaluateAnswers(
      quiz,
      submitDto.answers,
    );

    const totalQuestions = quiz.questions.length;
    const scorePercentage =
      totalQuestions > 0 ? (correctAnswersCount / totalQuestions) * 100 : 0;
    const isPassed = scorePercentage >= Number(quiz.passingScore);

    const attemptNumber = previousAttempts + 1;

    const attempt = await this.prisma.quizAttempt.create({
      data: {
        quizId,
        userId,
        score: scorePercentage,
        isPassed,
        attemptNumber,
        answers: submitDto.answers as unknown as Prisma.InputJsonValue,
        submittedAt: new Date(),
      },
    });

    if (this.eventEmitter) {
      this.eventEmitter.emit(
        DomainEvents.QUIZ_ATTEMPT_COMPLETED,
        new QuizAttemptCompletedEvent(
          attempt.id,
          userId,
          quizId,
          quiz.moduleId ?? quiz.module?.id ?? '',
          quiz.module?.courseId ?? '',
          quiz.quizType ?? QuizType.MODULE,
          scorePercentage,
          isPassed,
        ),
      );
    } else if (this.competencyService) {
      // Cô lập lỗi đồng bộ competency theo WP9 9.4 khi chạy độc lập không qua EventEmitter
      await this.competencyService
        .syncCompetencyFromQuiz(userId, quizId)
        .catch(() => undefined);
    }

    return {
      attemptId: attempt.id,
      score: scorePercentage,
      isPassed,
      attemptNumber,
      maxAttempts,
      remainingAttempts: Math.max(0, maxAttempts - attemptNumber),
      suggestedLessons: !isPassed ? suggestedLessons : [],
    };
  }

  async getRetakeSuggestions(quizId: string, userId: string) {
    const lastAttempt = await this.prisma.quizAttempt.findFirst({
      where: { quizId, userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastAttempt)
      throw new NotFoundException('Không tìm thấy lịch sử làm bài.');
    if (lastAttempt.isPassed) {
      return {
        message: 'Bạn đã hoàn thành bài kiểm tra này.',
        suggestedLessons: [],
      };
    }

    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        questions: {
          where: { deletedAt: null, isActive: true },
          include: { relatedLesson: true },
        },
        module: {
          include: {
            lessons: {
              where: { deletedAt: null },
              orderBy: { lessonOrder: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    const savedAnswers = Array.isArray(lastAttempt.answers)
      ? (lastAttempt.answers as Array<{
          questionId: string;
          selectedOption?: string;
        }>)
      : [];

    const suggestedLessons = quiz
      ? this.evaluateAnswers(quiz, savedAnswers).suggestedLessons
      : [];

    return {
      quizId,
      lastAttemptScore: lastAttempt.score,
      message:
        'Bạn chưa đạt điểm chuẩn 70%. Hệ thống đã ghi nhận lượt thi hỏng và kích hoạt chế độ thi lại.',
      suggestedLessons,
    };
  }

  // ===========================================================================
  // PRIVATE HELPERS
  // ===========================================================================

  private assertCourseWritePermission(
    course: { id: string; createdById: string },
    actor: AuthenticatedUser,
  ): void {
    if (this.coursesService) {
      this.coursesService.assertOwnership(course, actor);
      return;
    }

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

  private async findQuizWithCourseOrThrow(quizId: string) {
    const quiz = await this.prisma.quiz.findUnique({
      where: { id: quizId },
      include: {
        module: {
          select: {
            id: true,
            deletedAt: true,
            courseId: true,
            course: {
              select: {
                id: true,
                createdById: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });

    if (!quiz || quiz.module.deletedAt || quiz.module.course.deletedAt) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy đề kiểm tra ${quizId}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    return quiz;
  }

  private async findQuestionWithCourseOrThrow(questionId: string) {
    const question = await this.prisma.question.findFirst({
      where: { id: questionId, deletedAt: null },
      include: {
        quiz: {
          include: {
            module: {
              select: {
                id: true,
                deletedAt: true,
                course: {
                  select: {
                    id: true,
                    createdById: true,
                    deletedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (
      !question ||
      question.quiz.module.deletedAt ||
      question.quiz.module.course.deletedAt
    ) {
      throw new BusinessException(
        ErrorCode.NOT_FOUND,
        `Không tìm thấy câu hỏi ${questionId}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    return question;
  }

  private async assertLessonBelongsToCourse(
    lessonId: string,
    courseId: string,
  ): Promise<void> {
    const lesson = await this.prisma.lesson.findFirst({
      where: {
        id: lessonId,
        deletedAt: null,
        module: {
          courseId,
          deletedAt: null,
        },
      },
      select: { id: true },
    });

    if (!lesson) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Bài học liên kết (BR-03) không tồn tại hoặc không thuộc cùng khóa học.',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private normalizeAndValidateOptions(
    options: QuizOptionItemDto[],
    correctAnswer: string,
  ): {
    normalizedOptions: QuizOptionItemDto[];
    normalizedCorrectAnswer: string;
  } {
    if (!Array.isArray(options) || options.length < 2 || options.length > 6) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Câu hỏi trắc nghiệm phải có từ 2 đến 6 phương án lựa chọn.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const seenKeys = new Set<string>();
    const normalizedOptions: QuizOptionItemDto[] = [];

    for (const opt of options) {
      const key = (opt.key ?? '').trim().toUpperCase();
      const text = (opt.text ?? '').trim();

      if (!key || !text) {
        throw new BusinessException(
          ErrorCode.BAD_REQUEST,
          'Mỗi lựa chọn phải có đầy đủ mã (VD: A, B) và nội dung không được để trống.',
          HttpStatus.BAD_REQUEST,
        );
      }

      if (seenKeys.has(key)) {
        throw new BusinessException(
          ErrorCode.BAD_REQUEST,
          `Mã lựa chọn "${key}" bị trùng lặp trong cùng một câu hỏi.`,
          HttpStatus.BAD_REQUEST,
        );
      }

      seenKeys.add(key);
      normalizedOptions.push({ key, text });
    }

    const normalizedCorrectAnswer = (correctAnswer ?? '').trim().toUpperCase();
    if (!seenKeys.has(normalizedCorrectAnswer)) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Đáp án đúng phải trùng khớp với một trong các mã lựa chọn (VD: A, B, C, D).',
        HttpStatus.BAD_REQUEST,
      );
    }

    return {
      normalizedOptions,
      normalizedCorrectAnswer,
    };
  }

  private evaluateAnswers(
    quiz: {
      questions: Array<{
        id: string;
        correctAnswer: string;
        relatedLesson?: { id: string; title: string } | null;
      }>;
      module?: { lessons?: Array<{ id: string; title: string }> } | null;
    },
    answers: Array<{
      questionId: string;
      selectedOption?: string;
    }>,
  ): { correctAnswersCount: number; suggestedLessons: SuggestedLesson[] } {
    let correctAnswersCount = 0;
    const suggestedLessonsMap = new Map<string, SuggestedLesson>();
    const fallbackLesson = quiz.module?.lessons?.[0];
    const answerByQuestionId = new Map<string, string | undefined>();

    for (const ans of answers) {
      if (!answerByQuestionId.has(ans.questionId)) {
        answerByQuestionId.set(ans.questionId, ans.selectedOption);
      }
    }

    for (const question of quiz.questions) {
      const chosenOption = answerByQuestionId.get(question.id);
      if (
        chosenOption !== undefined &&
        question.correctAnswer === chosenOption
      ) {
        correctAnswersCount++;
      } else if (question.relatedLesson) {
        suggestedLessonsMap.set(question.relatedLesson.id, {
          lessonId: question.relatedLesson.id,
          lessonTitle: question.relatedLesson.title,
        });
      } else if (fallbackLesson) {
        suggestedLessonsMap.set(fallbackLesson.id, {
          lessonId: fallbackLesson.id,
          lessonTitle: fallbackLesson.title,
        });
      }
    }

    return {
      correctAnswersCount,
      suggestedLessons: Array.from(suggestedLessonsMap.values()),
    };
  }
}
