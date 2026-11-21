export type UserRole = 'admin' | 'manager' | 'employee';
export type CourseStatus = 'active' | 'upcoming' | 'completed';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar?: string;
  mustChangePassword?: boolean;
  isActive?: boolean;
}

export interface DashboardStat {
  label: string;
  value: string;
  change: string;
  positive: boolean;
}

export interface QuizOption {
  key: string;
  text: string;
}

export interface QuizQuestion {
  id: string;
  content: string;
  options: QuizOption[];
  correctAnswer: string;
  explanation?: string;
  skillName?: string;
}

export interface QuizItem {
  id: string;
  title: string;
  passingScore: number;
  timeLimitMin: number;
  maxAttempts: number;
  questions: QuizQuestion[];
}

export interface CourseItem {
  id: string;
  title: string;
  category: string;
  progress: number;
  duration: string;
  instructor: string;
  status: CourseStatus;
  description?: string;
  lessonsCount?: number;
}

export interface CourseDetailLesson {
  id: string;
  title: string;
  duration: string;
  type: string;
  completed?: boolean;
}

export interface CourseDetailModule {
  id: string;
  title: string;
  dayRange: string;
  quizId?: string;
  lessons: CourseDetailLesson[];
}

export interface CourseDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  progress: number;
  duration: string;
  instructor: string;
  status: CourseStatus;
  modules: CourseDetailModule[];
}

export interface ActivityItem {
  id: string;
  title: string;
  time: string;
  type: 'course' | 'assessment' | 'system';
}

export interface CompetencyEmployeeRow {
  id: string;
  name: string;
  department: string;
  role: string;
  scores: number[];
  status: 'Xuất sắc' | 'Đạt chuẩn' | 'Cần hỗ trợ';
}

export interface CompetencyDistribution {
  label: string;
  value: number;
  color: string;
}

export interface AdminDashboardData {
  stats: DashboardStat[];
  scoreDistribution: CompetencyDistribution[];
  courseCompletion: Array<{ name: string; value: number }>;
  activities: ActivityItem[];
}

export interface HrmSyncHistoryItem {
  id: string;
  employeeCode: string;
  email: string;
  payload: unknown;
  status: 'INITIATED' | 'SKIPPED' | 'FAILED';
  message?: string;
  userId?: string;
  assignedPathId?: string;
  createdAt: string;
}

export interface PaginatedHrmSyncHistory {
  data: HrmSyncHistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
