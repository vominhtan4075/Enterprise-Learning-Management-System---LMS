export type UnlockState = 'LOCKED' | 'UNLOCKED' | 'COMPLETED';

export interface LessonNode {
  id: string;
  title?: string;
  order: number;
  isRequired: boolean;
}

export interface QuizNode {
  id: string;
  title?: string;
  type: 'MODULE' | 'FINAL';
  isPublished?: boolean;
}

export interface ModuleNode {
  id: string;
  title?: string;
  order: number;
  lessons: LessonNode[];
  quiz?: QuizNode | null;
}

export interface CourseNode {
  id: string;
  title?: string;
  stepOrder: number;
  modules: ModuleNode[];
}

export interface EngineInput {
  courses: CourseNode[];
  completedLessonIds: Set<string>;
  passedQuizIds: Set<string>;
  strictLessonOrder: boolean;
}

export interface NodeLockInfo {
  state: UnlockState;
  lockedReason?: string;
}

export interface EngineOutput {
  lessons: Map<string, NodeLockInfo>;
  quizzes: Map<string, NodeLockInfo>;
  modules: Map<string, UnlockState>;
  courses: Map<string, UnlockState>;
}

/**
 * Hàm thuần tính toán trạng thái mở khóa tuần tự BR-02 & LP-4 (WP8 8.1):
 * - KHÔNG truy cập DB, hoàn toàn tất định (deterministic).
 * - Học phần k+1 chỉ mở khi Học phần k đã hoàn thành toàn bộ bài học bắt buộc (isRequired=true) VÀ vượt qua Quiz (nếu có).
 * - Quiz trong học phần chỉ mở khi học phần đã mở VÀ mọi bài học bắt buộc trong học phần đó đã COMPLETED.
 * - LP-4: Quiz FINAL chỉ mở khi toàn bộ các Quiz MODULE trong lộ trình đã PASSED (kiểm tra tường minh) VÀ mọi bài học bắt buộc của học phần FINAL đã COMPLETED.
 */
export function computeUnlock(input: EngineInput): EngineOutput {
  const lessons = new Map<string, NodeLockInfo>();
  const quizzes = new Map<string, NodeLockInfo>();
  const modules = new Map<string, UnlockState>();
  const courses = new Map<string, UnlockState>();

  const sortedCourses = [...input.courses].sort(
    (a, b) => a.stepOrder - b.stepOrder,
  );

  // Theo dõi các Quiz MODULE xuất hiện TRƯỚC học phần hiện tại (để kiểm tra LP-4 cho FINAL mà không bị khóa ngược nếu có khóa học thêm sau)
  const priorModuleQuizzes: Array<{
    quizId: string;
    moduleTitle: string;
  }> = [];

  let prevCourseDone = true;
  let prevCourseBlockingReason = '';

  for (const course of sortedCourses) {
    const courseUnlocked = prevCourseDone;
    const sortedMods = [...course.modules].sort((a, b) => a.order - b.order);

    let prevModuleDone = true;
    let prevModuleBlockingReason = prevCourseBlockingReason;
    let allModulesInCourseDone = true;

    for (const mod of sortedMods) {
      const moduleUnlocked = courseUnlocked && prevModuleDone;
      const sortedLessons = [...mod.lessons].sort((a, b) => a.order - b.order);
      const hasActiveQuiz = Boolean(
        mod.quiz && mod.quiz.isPublished !== false,
      );

      // Nếu module có bài bắt buộc thì kiểm tra các bài bắt buộc; nếu module không có Quiz và mọi bài đều để tự chọn thì bắt buộc học hết các bài trong module để không tự động hoàn thành ở 0%
      const explicitRequiredLessons = sortedLessons.filter((l) => l.isRequired);
      const effectiveRequiredLessons =
        explicitRequiredLessons.length > 0
          ? explicitRequiredLessons
          : !hasActiveQuiz
            ? sortedLessons
            : [];
      const effectiveRequiredIds = new Set(
        effectiveRequiredLessons.map((l) => l.id),
      );

      let prevRequiredLessonDone = true;
      let prevRequiredLessonTitle = '';

      for (const lesson of sortedLessons) {
        const isLessonDone = input.completedLessonIds.has(lesson.id);
        const isEffectiveRequired = effectiveRequiredIds.has(lesson.id);

        if (isLessonDone) {
          lessons.set(lesson.id, { state: 'COMPLETED' });
        } else if (!moduleUnlocked) {
          lessons.set(lesson.id, {
            state: 'LOCKED',
            lockedReason:
              prevModuleBlockingReason ||
              'Vui lòng hoàn thành khóa học / học phần trước đó để mở khóa bài học này (BR-02).',
          });
        } else if (input.strictLessonOrder && !prevRequiredLessonDone) {
          lessons.set(lesson.id, {
            state: 'LOCKED',
            lockedReason: `Vui lòng hoàn thành bài học bắt buộc "${prevRequiredLessonTitle}" trước khi học bài này (BR-02).`,
          });
        } else {
          lessons.set(lesson.id, { state: 'UNLOCKED' });
        }

        if (isEffectiveRequired && !isLessonDone && prevRequiredLessonDone) {
          prevRequiredLessonDone = false;
          prevRequiredLessonTitle = lesson.title ?? lesson.id;
        }
      }

      const incompleteRequiredLessons = effectiveRequiredLessons.filter(
        (l) => !input.completedLessonIds.has(l.id),
      );
      const allRequiredLessonsDone = incompleteRequiredLessons.length === 0;
      const hasCompletableTarget =
        effectiveRequiredLessons.length > 0 || hasActiveQuiz;

      let isQuizPassed = false;

      if (hasActiveQuiz && mod.quiz) {
        isQuizPassed = input.passedQuizIds.has(mod.quiz.id);

        if (isQuizPassed) {
          quizzes.set(mod.quiz.id, { state: 'COMPLETED' });
        } else if (!moduleUnlocked) {
          quizzes.set(mod.quiz.id, {
            state: 'LOCKED',
            lockedReason:
              prevModuleBlockingReason ||
              'Vui lòng hoàn thành khóa học / học phần trước đó để mở khóa bài kiểm tra này (BR-02).',
          });
        } else if (!allRequiredLessonsDone) {
          const firstMissingLesson =
            incompleteRequiredLessons[0].title ??
            incompleteRequiredLessons[0].id;
          quizzes.set(mod.quiz.id, {
            state: 'LOCKED',
            lockedReason: `Vui lòng hoàn thành bài học "${firstMissingLesson}" trước khi làm bài kiểm tra (BR-02).`,
          });
        } else if (mod.quiz.type === 'FINAL') {
          const unpassedModuleQuizzes = priorModuleQuizzes.filter(
            (mq) => !input.passedQuizIds.has(mq.quizId),
          );
          if (unpassedModuleQuizzes.length > 0) {
            quizzes.set(mod.quiz.id, {
              state: 'LOCKED',
              lockedReason: `Vui lòng vượt qua bài kiểm tra của "${unpassedModuleQuizzes[0].moduleTitle}" (và đủ toàn bộ các học phần trước đó) trước khi làm bài kiểm tra tổng hợp (LP-4).`,
            });
          } else {
            quizzes.set(mod.quiz.id, { state: 'UNLOCKED' });
          }
        } else {
          quizzes.set(mod.quiz.id, { state: 'UNLOCKED' });
        }

        if (mod.quiz.type === 'MODULE') {
          priorModuleQuizzes.push({
            quizId: mod.quiz.id,
            moduleTitle: mod.title ?? mod.id,
          });
        }
      }

      const moduleDone =
        moduleUnlocked &&
        hasCompletableTarget &&
        allRequiredLessonsDone &&
        (!hasActiveQuiz || isQuizPassed);

      if (moduleDone) {
        modules.set(mod.id, 'COMPLETED');
      } else if (moduleUnlocked) {
        modules.set(mod.id, 'UNLOCKED');
      } else {
        modules.set(mod.id, 'LOCKED');
      }

      if (!moduleDone) {
        allModulesInCourseDone = false;
        if (prevModuleDone) {
          const modLabel = mod.title ?? mod.id;
          if (!allRequiredLessonsDone) {
            prevModuleBlockingReason = `Vui lòng hoàn thành các bài học bắt buộc trong "${modLabel}" trước khi sang học phần tiếp theo (BR-02).`;
          } else {
            prevModuleBlockingReason = `Vui lòng vượt qua bài kiểm tra của "${modLabel}" (điểm >= 70%) để mở khóa học phần tiếp theo (BR-02).`;
          }
        }
        prevModuleDone = false;
      }
    }

    const courseDone =
      courseUnlocked && sortedMods.length > 0 && allModulesInCourseDone;
    if (courseDone) {
      courses.set(course.id, 'COMPLETED');
    } else if (courseUnlocked) {
      courses.set(course.id, 'UNLOCKED');
    } else {
      courses.set(course.id, 'LOCKED');
    }

    if (!courseDone) {
      if (prevCourseDone) {
        prevCourseBlockingReason =
          prevModuleBlockingReason ||
          `Vui lòng hoàn thành khóa học "${course.title ?? course.id}" trước khi mở khóa học tiếp theo (BR-02).`;
      }
      prevCourseDone = false;
    }
  }

  return { lessons, quizzes, modules, courses };
}

const STATE_PRIORITY: Record<UnlockState, number> = {
  LOCKED: 0,
  UNLOCKED: 1,
  COMPLETED: 2,
};

/**
 * Gộp nhiều ngữ cảnh mở khóa (VD: học viên vừa được giao Lộ trình vừa được giao Khóa học lẻ):
 * Một mục được mở nếu mở trong ít nhất một ngữ cảnh enrollment (Mục 3.4).
 */
export function mergeEngineOutputs(outputs: EngineOutput[]): EngineOutput {
  const merged: EngineOutput = {
    lessons: new Map(),
    quizzes: new Map(),
    modules: new Map(),
    courses: new Map(),
  };

  for (const out of outputs) {
    for (const [id, info] of out.lessons.entries()) {
      const existing = merged.lessons.get(id);
      if (
        !existing ||
        STATE_PRIORITY[info.state] > STATE_PRIORITY[existing.state]
      ) {
        merged.lessons.set(id, info);
      }
    }

    for (const [id, info] of out.quizzes.entries()) {
      const existing = merged.quizzes.get(id);
      if (
        !existing ||
        STATE_PRIORITY[info.state] > STATE_PRIORITY[existing.state]
      ) {
        merged.quizzes.set(id, info);
      }
    }

    for (const [id, state] of out.modules.entries()) {
      const existing = merged.modules.get(id);
      if (!existing || STATE_PRIORITY[state] > STATE_PRIORITY[existing]) {
        merged.modules.set(id, state);
      }
    }

    for (const [id, state] of out.courses.entries()) {
      const existing = merged.courses.get(id);
      if (!existing || STATE_PRIORITY[state] > STATE_PRIORITY[existing]) {
        merged.courses.set(id, state);
      }
    }
  }

  return merged;
}
