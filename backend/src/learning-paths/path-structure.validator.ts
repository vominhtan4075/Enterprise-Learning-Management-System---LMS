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
  quizType?: QuizType;
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
 * Hàm thuần kiểm tra cấu trúc Lộ trình học tập (linh hoạt số lượng khóa học):
 * 1. Lộ trình có thể chứa số lượng khóa học / học phần tùy ý (>= 1 khóa học, >= 1 học phần).
 * 2. Mọi Course trong lộ trình đều đã xuất bản (isPublished = true) và chưa xóa mềm.
 * 3. Mọi bài Quiz được đối xử đồng nhất (không phân biệt MODULE hay FINAL) — chỉ yêu cầu học phần cuối cùng của lộ trình có bài Quiz đã xuất bản.
 */
export function validatePathStructure(
  path: ValidatableLearningPath,
  _expectedUnits?: number,
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

  const unitCount = orderedModules.length;
  const expectedUnits = Math.max(1, unitCount);

  if (orderedModules.length === 0) {
    issues.push({
      code: 'FINAL_MISSING',
      message:
        'Lộ trình cần có ít nhất 1 khóa học và bài kiểm tra (Quiz) đã xuất bản ở cuối lộ trình.',
      ref: path.id,
    });
    return {
      valid: false,
      unitCount: 0,
      expectedUnits: 1,
      hasFinal: false,
      finalIsLast: false,
      issues,
    };
  }

  const lastIndex = orderedModules.length - 1;

  orderedModules.forEach((item) => {
    const { module: mod } = item;
    if (mod.lessons.length === 0 && !mod.quiz?.isPublished) {
      issues.push({
        code: 'UNIT_WITHOUT_LESSON',
        message: `Học phần "${mod.title}" chưa có bài giảng nào hoạt động.`,
        ref: mod.id,
      });
    }
  });

  const lastMod = orderedModules[lastIndex].module;
  let hasFinal = false;

  if (!lastMod.quiz) {
    issues.push({
      code: 'FINAL_MISSING',
      message: `Học phần cuối cùng ("${lastMod.title}") bắt buộc phải có bài kiểm tra (Quiz) để kết thúc lộ trình.`,
      ref: lastMod.id,
    });
  } else if (!lastMod.quiz.isPublished) {
    issues.push({
      code: 'UNIT_WITHOUT_QUIZ',
      message: `Bài kiểm tra ở cuối lộ trình ("${lastMod.title}") chưa được xuất bản.`,
      ref: lastMod.id,
    });
  } else {
    hasFinal = true;
  }

  const finalIsLast = hasFinal;

  return {
    valid: issues.length === 0,
    unitCount,
    expectedUnits,
    hasFinal,
    finalIsLast,
    issues,
  };
}
