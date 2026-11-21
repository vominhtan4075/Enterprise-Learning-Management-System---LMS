import { QuizType } from '../generated/prisma/enums.js';

export type PathValidationIssueCode =
  | 'UNIT_COUNT_MISMATCH'
  | 'FINAL_MISSING'
  | 'FINAL_NOT_LAST'
  | 'UNIT_WITHOUT_QUIZ'
  | 'UNIT_WITHOUT_LESSON'
  | 'COURSE_NOT_PUBLISHED';

export interface PathValidationIssue {
  code: PathValidationIssueCode;
  message: string;
  ref?: string;
}

export interface PathValidationResult {
  valid: boolean;
  unitCount: number;
  expectedUnits: number;
  hasFinal: boolean;
  finalIsLast: boolean;
  issues: PathValidationIssue[];
}

export interface ValidatableLesson {
  id: string;
  title?: string;
  isRequired: boolean;
}

export interface ValidatableQuiz {
  id: string;
  title?: string;
  quizType: QuizType;
  isPublished: boolean;
}

export interface ValidatableModule {
  id: string;
  title: string;
  moduleOrder: number;
  lessons: ValidatableLesson[];
  quiz?: ValidatableQuiz | null;
}

export interface ValidatableCourse {
  id: string;
  code: string;
  title: string;
  isPublished: boolean;
  deletedAt?: Date | null;
  modules: ValidatableModule[];
}

export interface ValidatablePathCourse {
  stepOrder: number;
  course: ValidatableCourse;
}

export interface ValidatableLearningPath {
  id: string;
  code: string;
  title: string;
  pathCourses: ValidatablePathCourse[];
}

/**
 * Hàm thuần kiểm tra cấu trúc chuẩn của Lộ trình học tập (WP6 – LP-1, LP-2, LP-3):
 * 1. Mọi Course trong lộ trình đều đã xuất bản (isPublished = true) và chưa xóa mềm.
 * 2. Tổng số Học phần học tập (Module có Quiz MODULE hoặc không phải FINAL) == expectedUnits (mặc định 4).
 * 3. Có đúng 1 Module chứa Quiz FINAL và Module đó phải nằm ở vị trí cuối cùng của lộ trình (course cuối, module cuối).
 * 4. Mỗi Học phần học tập có >= 1 bài học bắt buộc (isRequired = true) và 1 Quiz đã xuất bản (isPublished = true).
 */
export function validatePathStructure(
  path: ValidatableLearningPath,
  expectedUnits = 4,
): PathValidationResult {
  const issues: PathValidationIssue[] = [];

  const sortedSteps = [...path.pathCourses].sort(
    (a, b) => a.stepOrder - b.stepOrder,
  );

  // Kiểm tra các khóa học chưa publish hoặc đã xóa
  for (const step of sortedSteps) {
    if (!step.course.isPublished || step.course.deletedAt) {
      issues.push({
        code: 'COURSE_NOT_PUBLISHED',
        message: `Khóa học "${step.course.title}" (${step.course.code}) chưa được xuất bản hoặc đã bị xóa.`,
        ref: step.course.id,
      });
    }
  }

  // Trải phẳng toàn bộ danh sách module theo thứ tự (stepOrder ASC, moduleOrder ASC)
  const orderedModules: Array<{
    courseId: string;
    courseCode: string;
    module: ValidatableModule;
  }> = [];

  for (const step of sortedSteps) {
    const sortedMods = [...step.course.modules].sort(
      (a, b) => a.moduleOrder - b.moduleOrder,
    );
    for (const mod of sortedMods) {
      orderedModules.push({
        courseId: step.course.id,
        courseCode: step.course.code,
        module: mod,
      });
    }
  }

  const finalIndices: number[] = [];
  let unitCount = 0;

  orderedModules.forEach((item, idx) => {
    const { module: mod } = item;
    const isFinalModule = mod.quiz?.quizType === QuizType.FINAL;

    if (isFinalModule) {
      finalIndices.push(idx);
      if (!mod.quiz?.isPublished) {
        issues.push({
          code: 'UNIT_WITHOUT_QUIZ',
          message: `Bài kiểm tra tổng hợp (FINAL) tại "${mod.title}" chưa được xuất bản.`,
          ref: mod.id,
        });
      }
    } else {
      unitCount++;
      const requiredLessonCount = mod.lessons.filter((l) => l.isRequired).length;
      if (requiredLessonCount < 1) {
        issues.push({
          code: 'UNIT_WITHOUT_LESSON',
          message: `Học phần "${mod.title}" chưa có ít nhất 1 bài học bắt buộc (isRequired = true).`,
          ref: mod.id,
        });
      }

      if (!mod.quiz || !mod.quiz.isPublished) {
        issues.push({
          code: 'UNIT_WITHOUT_QUIZ',
          message: `Học phần "${mod.title}" chưa có bài kiểm tra (Quiz MODULE) được xuất bản.`,
          ref: mod.id,
        });
      }
    }
  });

  if (unitCount !== expectedUnits) {
    issues.push({
      code: 'UNIT_COUNT_MISMATCH',
      message: `Lộ trình hiện có ${unitCount} học phần học tập, yêu cầu đúng ${expectedUnits} học phần (LP-1).`,
      ref: path.id,
    });
  }

  const hasFinal = finalIndices.length > 0;
  const lastIndex = orderedModules.length - 1;
  const finalIsLast =
    finalIndices.length === 1 && finalIndices[0] === lastIndex;

  if (finalIndices.length === 0) {
    issues.push({
      code: 'FINAL_MISSING',
      message:
        'Lộ trình thiếu bài kiểm tra tổng hợp cuối khóa (Quiz FINAL) (LP-2).',
      ref: path.id,
    });
  } else if (!finalIsLast) {
    issues.push({
      code: 'FINAL_NOT_LAST',
      message:
        finalIndices.length > 1
          ? `Lộ trình có ${finalIndices.length} bài kiểm tra FINAL (chỉ cho phép đúng 1 bài FINAL ở cuối lộ trình).`
          : 'Bài kiểm tra tổng hợp (Quiz FINAL) phải nằm ở vị trí cuối cùng của lộ trình (LP-2).',
      ref: orderedModules[finalIndices[0]]?.module.id ?? path.id,
    });
  }

  return {
    valid: issues.length === 0,
    unitCount,
    expectedUnits,
    hasFinal,
    finalIsLast,
    issues,
  };
}
