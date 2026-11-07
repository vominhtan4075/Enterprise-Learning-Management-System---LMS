export type UserRole = 'admin' | 'manager' | 'employee';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar?: string;
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
  status: 'active' | 'upcoming' | 'completed';
  description?: string;
  lessonsCount?: number;
}

export interface ActivityItem {
  id: string;
  title: string;
  time: string;
  type: 'course' | 'assessment' | 'system';
}
