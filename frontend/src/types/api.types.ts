export type RoleCode = 'EMPLOYEE' | 'TRAINER' | 'HR' | 'ADMIN';

export type PositionLevel = 'INTERN' | 'FRESHER' | 'JUNIOR' | 'SENIOR' | 'LEAD';

export type ContentType = 'VIDEO' | 'PDF' | 'MARKDOWN';

export type QuizType = 'MODULE' | 'FINAL';

export type EnrollmentStatus = 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE';

export type EnrollmentSource = 'MANUAL' | 'HRM' | 'AUTO_ONBOARDING';

export type UnlockState = 'LOCKED' | 'UNLOCKED' | 'COMPLETED';

export type NotificationType =
  | 'WELCOME'
  | 'ENROLLMENT_ASSIGNED'
  | 'DEADLINE_REMINDER'
  | 'ENROLLMENT_OVERDUE'
  | 'FINAL_FAILED_ALERT'
  | 'QUIZ_PASSED'
  | 'QUIZ_FAILED';

export type HrmSyncStatus = 'INITIATED' | 'SKIPPED' | 'FAILED';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface BackendErrorPayload {
  statusCode: number;
  message: string | string[];
  errorCode: string;
  timestamp?: string;
  path?: string;
  method?: string;
  requestId?: string;
  details?: unknown;
}

export interface HealthStatusResponse {
  status: 'ok' | 'error' | string;
  uptime?: number;
  timestamp?: string;
  database?: { status: string };
  redis?: { status: string };
}

// =============================================================================
// AUTH & USERS
// =============================================================================

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  position: PositionLevel;
  department: string | null;
  employeeCode?: string | null;
  jobTitle?: string | null;
  isActive?: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType?: string;
  expiresIn?: number | string;
  user: AuthUser;
}

export interface UserSummary {
  id: string;
  email: string;
  fullName: string;
  roleId?: number;
  role?: RoleCode | { id?: number; code: RoleCode };
  position: PositionLevel;
  department: string | null;
  employeeCode?: string | null;
  jobTitle?: string | null;
  isActive?: boolean;
  mustChangePassword?: boolean;
  startDate?: string | null;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  temporaryPassword?: string;
}

export interface CreateUserPayload {
  email: string;
  fullName: string;
  password?: string;
  role?: RoleCode;
  roleId?: number;
  position: PositionLevel;
  jobTitle?: string;
  department?: string;
  employeeCode?: string;
}

export interface UpdateUserPayload {
  email?: string;
  fullName?: string;
  position?: PositionLevel;
  jobTitle?: string;
  department?: string;
  employeeCode?: string;
  password?: string;
}

export interface QueryUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: RoleCode | '';
  position?: PositionLevel | '';
  department?: string;
  isActive?: boolean | '';
}

// =============================================================================
// COURSES, MODULES, LESSONS & FILES
// =============================================================================

export interface UploadedFileMeta {
  id: string;
  storageKey: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  uploadedById: string;
  createdAt: string;
  url: string;
}

export interface LessonItem {
  id: string;
  moduleId: string;
  title: string;
  contentType: ContentType;
  contentUrl?: string;
  contentText?: string | null;
  fileId?: string | null;
  lessonOrder: number;
  durationMinutes: number;
  isRequired: boolean;
  state?: UnlockState;
  lockedReason?: string | null;
  isCompleted?: boolean;
  file?: UploadedFileMeta | null;
  module?: {
    id: string;
    title: string;
    moduleOrder: number;
    courseId: string;
    course?: {
      id: string;
      code?: string;
      title: string;
      createdById?: string;
      isPublished?: boolean;
    };
  };
}

export interface LessonContentResponse {
  id: string;
  title: string;
  contentType: ContentType;
  contentUrl?: string;
  contentText?: string | null;
}

export interface CourseQuizBrief {
  id: string;
  title: string;
  passingScore: string | number;
  timeLimitMin: number | null;
  quizType: QuizType;
  maxAttempts: number;
  isPublished: boolean;
  state?: UnlockState;
  lockedReason?: string | null;
}

export interface ModuleItem {
  id: string;
  courseId: string;
  title: string;
  moduleOrder: number;
  description?: string | null;
  dayStart?: number | null;
  dayEnd?: number | null;
  state?: UnlockState;
  lessons: LessonItem[];
  quiz?: CourseQuizBrief | null;
}

export interface CourseSummary {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  estimatedHours: number;
  isPublished: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: {
    id: string;
    fullName: string;
    email: string;
  };
  _count?: {
    modules: number;
    courseEnrollments: number;
  };
}

export interface CourseDetail extends CourseSummary {
  state?: UnlockState;
  modules: ModuleItem[];
}

export interface CreateCoursePayload {
  code: string;
  title: string;
  description?: string;
  estimatedHours?: number;
}

export interface UpdateCoursePayload {
  code?: string;
  title?: string;
  description?: string;
  estimatedHours?: number;
}

export interface CreateModulePayload {
  title: string;
  description?: string;
  moduleOrder?: number;
  dayStart?: number;
  dayEnd?: number;
}

export interface UpdateModulePayload {
  title?: string;
  description?: string;
  moduleOrder?: number;
  dayStart?: number | null;
  dayEnd?: number | null;
}

export interface CreateLessonPayload {
  title: string;
  contentType: ContentType;
  contentUrl?: string;
  contentText?: string;
  fileId?: string;
  durationMinutes?: number;
  lessonOrder?: number;
  isRequired?: boolean;
}

export interface UpdateLessonPayload {
  title?: string;
  contentType?: ContentType;
  contentUrl?: string;
  contentText?: string;
  fileId?: string;
  durationMinutes?: number;
  lessonOrder?: number;
  isRequired?: boolean;
}

// =============================================================================
// QUIZZES & QUESTIONS
// =============================================================================

export interface QuizOptionItem {
  key: string;
  text: string;
}

export interface QuestionForTaking {
  id: string;
  questionText: string;
  options: QuizOptionItem[];
  skillName?: string | null;
  conceptTag?: string | null;
}

export interface QuizAttemptHistoryItem {
  id: string;
  attemptNumber: number;
  score: number;
  isPassed: boolean;
  submittedAt: string | null;
}

export interface QuizForTaking {
  id: string;
  moduleId: string;
  title: string;
  passingScore: string | number;
  timeLimitMin: number | null;
  quizType: QuizType;
  maxAttempts: number;
  isPublished: boolean;
  attemptsUsed?: number;
  remainingAttempts?: number;
  bestScore?: number | null;
  hasPassed?: boolean;
  attemptHistory?: QuizAttemptHistoryItem[];
  _count?: {
    quizAttempts: number;
  };
  module?: {
    id: string;
    title: string;
    moduleOrder: number;
    courseId: string;
    course?: {
      id: string;
      code: string;
      title: string;
      createdById: string;
    };
  };
  questions: QuestionForTaking[];
}

export interface QuestionManageItem extends QuestionForTaking {
  quizId: string;
  correctAnswer: string;
  explanation?: string | null;
  isActive: boolean;
  updatedAt?: string;
}

export interface QuizManageDetail {
  id: string;
  moduleId: string;
  title: string;
  passingScore: string | number;
  timeLimitMin: number | null;
  quizType: QuizType;
  maxAttempts: number;
  isPublished: boolean;
  createdAt?: string;
  module: {
    id: string;
    title: string;
    moduleOrder: number;
    courseId: string;
    course: {
      id: string;
      code: string;
      title: string;
      createdById: string;
    };
  };
  questions: QuestionManageItem[];
  _count?: {
    quizAttempts: number;
  };
}

export interface SubmitQuizResponse {
  attemptId: string;
  score: number;
  isPassed: boolean;
  attemptNumber: number;
  maxAttempts?: number;
  remainingAttempts?: number;
}

export interface CreateQuizPayload {
  title: string;
  quizType?: QuizType;
  passingScore?: number;
  timeLimitMin?: number | null;
  maxAttempts?: number;
  isPublished?: boolean;
}

export interface UpdateQuizPayload {
  title?: string;
  quizType?: QuizType;
  passingScore?: number;
  timeLimitMin?: number | null;
  maxAttempts?: number;
  isPublished?: boolean;
}

export interface CreateQuestionPayload {
  questionText: string;
  options: QuizOptionItem[];
  correctAnswer: string;
  skillName?: string | null;
  explanation?: string | null;
  conceptTag?: string | null;
  isActive?: boolean;
}

export interface UpdateQuestionPayload {
  questionText?: string;
  options?: QuizOptionItem[];
  correctAnswer?: string;
  skillName?: string | null;
  explanation?: string | null;
  conceptTag?: string | null;
  isActive?: boolean;
}

// =============================================================================
// LEARNING PATHS, ENROLLMENTS & PROGRESS
// =============================================================================

export interface LearningPathSummary {
  id: string;
  code: string;
  title: string;
  targetPosition: PositionLevel;
  description?: string | null;
  isMandatory: boolean;
  estimatedDays: number;
  totalCourses?: number;
  totalUnits?: number;
  hasFinal?: boolean;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PathCourseNode {
  id: string;
  pathId: string;
  courseId: string;
  stepOrder: number;
  course: CourseDetail;
}

export interface LearningPathDetail extends LearningPathSummary {
  pathCourses: PathCourseNode[];
}

export type PathValidationIssueItem =
  | string
  | {
      code: string;
      message?: string;
      courseId?: string;
      moduleId?: string;
    };

export interface PathValidationResult {
  valid: boolean;
  unitCount: number;
  expectedUnits: number;
  hasFinal: boolean;
  finalIsLast: boolean;
  issues: PathValidationIssueItem[];
}

export interface CreateLearningPathPayload {
  title: string;
  targetPosition: PositionLevel;
  description?: string;
  isMandatory?: boolean;
  estimatedDays?: number;
  code?: string;
}

export interface UpdateLearningPathPayload {
  title?: string;
  targetPosition?: PositionLevel;
  description?: string;
  isMandatory?: boolean;
  estimatedDays?: number;
  code?: string;
}

export interface EnrollmentItem {
  id: string;
  userId: string;
  type: 'COURSE' | 'PATH';
  courseId?: string | null;
  pathId?: string | null;
  status: EnrollmentStatus;
  deadline: string;
  assignedAt: string;
  completedAt?: string | null;
  progressPercentage: number;
  source?: EnrollmentSource;
  assignedById?: string | null;
  user?: {
    id: string;
    fullName: string;
    email: string;
    department?: string | null;
    position?: PositionLevel;
    employeeCode?: string | null;
  };
  target?: {
    id: string;
    code?: string;
    title: string;
    type?: 'COURSE' | 'PATH';
  };
  course?: {
    id: string;
    code: string;
    title: string;
  };
  learningPath?: {
    id: string;
    code: string;
    title: string;
  };
  assignedBy?: {
    id: string;
    fullName: string;
    email: string;
  } | null;
}

export interface AssignCourseEnrollmentPayload {
  courseId: string;
  deadline: string;
  userId?: string;
  userIds?: string[];
  department?: string;
  position?: PositionLevel;
}

export interface AssignPathPayload {
  pathId: string;
  deadline: string;
  userId?: string;
  userIds?: string[];
  department?: string;
  targetPosition?: PositionLevel;
  allowIncomplete?: boolean;
}

export interface BatchAssignResponse {
  createdCount: number;
  skippedCount: number;
  matched: number;
  enrollmentIds: string[];
  skipped: Array<{ userId: string; reason: string }>;
  enrollmentId?: string;
  assignedAt?: string;
  deadline?: string;
  status?: EnrollmentStatus;
}

export interface MyPathProgress {
  enrollmentId: string;
  pathId: string;
  code: string;
  title: string;
  progressPercentage: number;
  deadline: string;
  status: EnrollmentStatus;
  completedCourses: number;
  totalCourses: number;
  currentUnit?: {
    moduleId: string;
    title: string;
    courseId: string;
  } | null;
}

export interface MyCourseProgress {
  enrollmentId: string;
  courseId: string;
  code: string;
  title: string;
  progressPercentage: number;
  deadline: string;
  status: EnrollmentStatus;
  completedModules?: number;
  totalModules?: number;
}

export interface MyProgressResponse {
  userId: string;
  paths: MyPathProgress[];
  courses: MyCourseProgress[];
  nextUp?: {
    type: 'LESSON' | 'QUIZ';
    id: string;
    title: string;
    courseId: string;
    moduleId: string;
  } | null;
  upcomingDeadlines: Array<{
    enrollmentId: string;
    type: 'PATH' | 'COURSE';
    targetId: string;
    title: string;
    deadline: string;
    status: EnrollmentStatus;
    progressPercentage: number;
  }>;
}

export interface CompleteLessonResponse {
  lessonId: string;
  isCompleted: boolean;
  completedAt: string;
  moduleState: UnlockState;
  quizUnlocked: boolean;
  nextUnlocked?: {
    type: 'LESSON' | 'QUIZ' | 'COURSE';
    id: string;
    title?: string;
  } | null;
}

// =============================================================================
// NOTIFICATIONS
// =============================================================================

export interface NotificationItem {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  refType?: string | null;
  refId?: string | null;
  readAt?: string | null;
  createdAt: string;
}

export interface NotificationListResponse extends PaginatedResponse<NotificationItem> {
  unreadCount: number;
}

export interface RunRemindersResponse {
  scannedCount: number;
  remindersSent: number;
  overdueMarked: number;
}

// =============================================================================
// REPORTS & COMPETENCY MATRIX
// =============================================================================

export interface DashboardActivityItem {
  id?: string;
  type?: string;
  title?: string;
  description?: string;
  actorName?: string;
  userName?: string;
  timestamp?: string;
  createdAt?: string;
}

export interface DashboardResponse {
  role: RoleCode;
  period?: { from: string | null; to: string | null };
  totalUsers?: number;
  totalCourses?: number;
  totalPaths?: number;
  totalEnrollments?: number;
  completedEnrollments?: number;
  inProgressEnrollments?: number;
  overdueEnrollments?: number;
  completionRate?: number;
  totalQuizAttempts?: number;
  avgQuizScore?: number;
  myCoursesCount?: number;
  totalAssignedEnrollments?: number;
  userId?: string;
  completedLessonsCount?: number;
  passedQuizzesCount?: number;
  competencySummary?: {
    avgScore: number;
    requiredScore: number;
    passedCount: number;
    gapCount: number;
  };
  stats?: {
    totalUsers?: number;
    activeCourses?: number;
    completionRate?: number;
    averageScore?: number;
  };
  scoreDistribution?: Array<{ label: string; range?: string; count: number }>;
  courseCompletion?: Array<{
    courseId?: string;
    code?: string;
    title: string;
    completionRate: number;
    totalEnrollments?: number;
    completedCount?: number;
  }>;
  activities?: DashboardActivityItem[];
}

export interface CompetencyEmployeeSkill {
  skillName: string;
  score: number;
  requiredScore: number;
  status: 'PASSED' | 'GAP' | 'NOT_ASSESSED';
  level?: string;
  gapDelta?: number;
}

export interface CompetencyEmployeeRow {
  userId: string;
  fullName: string;
  department: string;
  position: PositionLevel;
  avgScore: number;
  competencies: CompetencyEmployeeSkill[];
}

export interface PositionSummaryRow {
  position: PositionLevel;
  requiredScore: number;
  totalEmployees: number;
  assessedEmployees: number;
  avgProficiencyScore: number;
  passedSkillCount: number;
  gapSkillCount: number;
  passedRate: number;
}

export interface CompetencyMatrixFrontendRow {
  id: string;
  name: string;
  department: string;
  role: PositionLevel | string;
  skills: Record<string, number>;
  scores: number[];
  average: number;
  status: string;
}

export interface CompetencyMatrixResponse {
  success: boolean;
  data: {
    skills: string[];
    totalEmployees: number;
    employees: CompetencyEmployeeRow[];
    positionSummary: PositionSummaryRow[];
    matrix?: CompetencyMatrixFrontendRow[];
  };
}

export interface PersonalCompetencyResponse {
  userId: string;
  fullName: string;
  email: string;
  department: string | null;
  position: PositionLevel;
  requiredScore: number;
  avgScore: number;
  passedCount: number;
  gapCount: number;
  competencies: CompetencyEmployeeSkill[];
}

export interface CompletionReportResponse {
  summary: {
    totalEnrollments: number;
    totalCompleted: number;
    totalOverdue: number;
    overallCompletionRate: number;
  };
  byDepartment: Array<{
    department: string;
    totalEnrollments: number;
    completed: number;
    inProgress: number;
    overdue: number;
    completionRate: number;
    avgProgressPercentage: number;
  }>;
  byEmployee: Array<{
    userId: string;
    fullName: string;
    email: string;
    department: string;
    position: PositionLevel;
    totalEnrollments: number;
    completed: number;
    inProgress: number;
    overdue: number;
    completionRate: number;
    avgProgressPercentage: number;
  }>;
}

export interface QuizScoresReportResponse {
  totalQuizzes: number;
  totalAttempts: number;
  overallAvgScore: number;
  quizzes: Array<{
    quizId: string;
    quizTitle: string;
    quizType: QuizType;
    passingScore: number;
    moduleId: string;
    moduleTitle: string;
    courseId: string;
    courseCode: string;
    courseTitle: string;
    totalAttempts: number;
    uniqueLearners: number;
    passedAttempts: number;
    avgScore: number;
    passRate: number;
  }>;
}

export interface RecalculateCompetencyResponse {
  processedUsers: number;
  updatedRecords: number;
}

// =============================================================================
// HRM INTEGRATION
// =============================================================================

export interface HrmMockEmployee {
  employeeCode: string;
  fullName: string;
  email: string;
  position: string;
  department: string;
  employmentStatus: 'ACTIVE' | 'RESIGNED';
  startDate: string;
}

export interface HrmMockEmployeesResponse {
  statusCode: number;
  message: string;
  mockEmployees: HrmMockEmployee[];
  data?: {
    total: number;
    mockEmployees: HrmMockEmployee[];
  };
}

export interface HrmSyncUserPayload {
  employees?: HrmMockEmployee[];
  employeeCode?: string;
  fullName?: string;
  email?: string;
  position?: string;
  department?: string;
  employmentStatus?: 'ACTIVE' | 'RESIGNED';
  startDate?: string;
}

export interface HrmSyncResultItem {
  userId: string | null;
  employeeCode: string;
  fullName: string;
  email: string;
  position: string;
  positionLevel: PositionLevel | null;
  department: string;
  action:
    | 'CREATED'
    | 'UPDATED'
    | 'POSITION_CHANGED'
    | 'DEACTIVATED'
    | 'SKIPPED'
    | 'FAILED';
  assignedPathCode?: string | null;
  temporaryPassword?: string | null;
  message?: string | null;
}

export interface HrmSyncSummary {
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  positionChangedCount: number;
  deactivatedCount: number;
  skippedCount: number;
  failedCount: number;
}

export interface HrmSyncResponse {
  statusCode: number;
  message: string;
  syncedCount: number;
  failedCount: number;
  data: {
    summary: HrmSyncSummary;
    syncedUsers: HrmSyncResultItem[];
  };
}

export interface HrmSyncLogItem {
  id: string;
  employeeCode: string;
  email: string;
  status: HrmSyncStatus;
  message?: string | null;
  userId?: string | null;
  assignedPathId?: string | null;
  payload?: Record<string, unknown>;
  createdAt: string;
}

export interface HrmTrainingStatusItem {
  userId: string;
  employeeCode: string | null;
  fullName: string;
  email: string;
  department: string | null;
  position: PositionLevel;
  overallStatus: EnrollmentStatus | 'NOT_ENROLLED' | string;
  overallProgressPercentage: number;
  avgCompetencyScore: number;
  learningPaths?: Array<{
    pathId: string;
    code: string;
    title: string;
    status: EnrollmentStatus;
    progressPercentage: number;
    deadline: string;
  }>;
  courses?: Array<{
    courseId: string;
    code: string;
    title: string;
    status: EnrollmentStatus;
    progressPercentage: number;
    deadline: string;
  }>;
  competencies?: Array<{
    skillName: string;
    proficiencyScore: number;
  }>;
}
