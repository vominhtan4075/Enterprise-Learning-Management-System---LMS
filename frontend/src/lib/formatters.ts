import type {
  ContentType,
  EnrollmentStatus,
  HrmSyncStatus,
  NotificationType,
  PathValidationIssueItem,
  PositionLevel,
  QuizType,
  RoleCode,
  UnlockState,
  UserSummary,
} from '@/types/api.types';

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Quản trị viên',
  HR: 'Nhân sự & Đào tạo (HR)',
  TRAINER: 'Giảng viên',
  EMPLOYEE: 'Học viên',
};

export const POSITION_LABELS: Record<PositionLevel, string> = {
  INTERN: 'Thực tập sinh (Intern)',
  FRESHER: 'Fresher',
  JUNIOR: 'Junior',
  SENIOR: 'Senior',
  LEAD: 'Tech Lead / Quản lý',
};

export const POSITION_REQUIRED_SCORE: Record<PositionLevel, number> = {
  INTERN: 60,
  FRESHER: 70,
  JUNIOR: 75,
  SENIOR: 85,
  LEAD: 90,
};

export const POSITION_LEVELS: PositionLevel[] = [
  'INTERN',
  'FRESHER',
  'JUNIOR',
  'SENIOR',
  'LEAD',
];

export const ROLE_CODES: RoleCode[] = ['EMPLOYEE', 'TRAINER', 'HR', 'ADMIN'];

export const ENROLLMENT_STATUS_LABELS: Record<EnrollmentStatus, string> = {
  IN_PROGRESS: 'Đang theo học',
  COMPLETED: 'Đã hoàn thành',
  OVERDUE: 'Quá hạn',
};

export const UNLOCK_STATE_LABELS: Record<UnlockState, string> = {
  COMPLETED: 'Đã hoàn thành',
  UNLOCKED: 'Đã mở khóa',
  LOCKED: 'Đang khóa (BR-02)',
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  VIDEO: 'Video bài giảng',
  PDF: 'Tài liệu PDF',
  MARKDOWN: 'Bài đọc Markdown',
};

export const QUIZ_TYPE_LABELS: Record<QuizType, string> = {
  MODULE: 'Kiểm tra học phần',
  FINAL: 'Thi tổng hợp cuối khóa',
};

export const HRM_SYNC_STATUS_LABELS: Record<HrmSyncStatus, string> = {
  INITIATED: 'Đã đồng bộ',
  SKIPPED: 'Bỏ qua',
  FAILED: 'Lỗi đồng bộ',
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  WELCOME: 'Chào mừng',
  ENROLLMENT_ASSIGNED: 'Giao khóa học / lộ trình',
  DEADLINE_REMINDER: 'Nhắc hạn hoàn thành',
  ENROLLMENT_OVERDUE: 'Cảnh báo quá hạn',
  FINAL_FAILED_ALERT: 'Cảnh báo trượt bài cuối khóa',
  QUIZ_PASSED: 'Vượt qua bài kiểm tra',
  QUIZ_FAILED: 'Chưa đạt bài kiểm tra',
};

const VALIDATION_ISSUE_LABELS: Record<string, string> = {
  UNIT_COUNT_MISMATCH:
    'Lộ trình cần có ít nhất 1 khóa học / học phần hợp lệ.',
  FINAL_MISSING:
    'Học phần cuối cùng của lộ trình bắt buộc phải có một bài kiểm tra (Quiz) đã xuất bản.',
  FINAL_NOT_LAST:
    'Bài kiểm tra loại FINAL chỉ được đặt ở học phần cuối cùng của lộ trình.',
  UNIT_WITHOUT_QUIZ:
    'Bài kiểm tra ở cuối lộ trình đang ở trạng thái bản nháp (chưa xuất bản).',
  UNIT_WITHOUT_LESSON:
    'Có học phần đang rỗng (chưa có bài giảng hoặc đề thi hoạt động).',
  COURSE_NOT_PUBLISHED:
    'Có khóa học trong lộ trình đang ở trạng thái Bản nháp (chưa xuất bản).',
};

export function formatValidationIssue(issue: PathValidationIssueItem): string {
  if (typeof issue === 'string') {
    return VALIDATION_ISSUE_LABELS[issue] || issue;
  }
  if (issue.message && issue.message.trim()) {
    return issue.message;
  }
  return VALIDATION_ISSUE_LABELS[issue.code] || issue.code;
}

export function extractRoleCode(user: UserSummary): RoleCode {
  if (!user.role) {
    if (user.roleId === 4) return 'ADMIN';
    if (user.roleId === 3) return 'HR';
    if (user.roleId === 2) return 'TRAINER';
    return 'EMPLOYEE';
  }
  return typeof user.role === 'string' ? user.role : user.role.code;
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function formatDaysRemaining(deadline?: string | Date | null): {
  text: string;
  tone: 'neutral' | 'warning' | 'danger';
} {
  if (!deadline) return { text: 'Không giới hạn', tone: 'neutral' };
  const target = deadline instanceof Date ? deadline : new Date(deadline);
  if (Number.isNaN(target.getTime())) return { text: '—', tone: 'neutral' };
  const diffDays = Math.ceil((target.getTime() - Date.now()) / 86_400_000);
  if (diffDays < 0) {
    return { text: `Quá hạn ${Math.abs(diffDays)} ngày`, tone: 'danger' };
  }
  if (diffDays === 0) {
    return { text: 'Hạn hôm nay', tone: 'warning' };
  }
  if (diffDays <= 3) {
    return { text: `Còn ${diffDays} ngày`, tone: 'warning' };
  }
  return { text: `Còn ${diffDays} ngày`, tone: 'neutral' };
}

export function formatPercent(value?: number | string | null): string {
  if (value === undefined || value === null) return '0%';
  const num = Number(value);
  if (Number.isNaN(num)) return '0%';
  return `${Math.round(num * 10) / 10}%`;
}

export function formatScore(value?: number | string | null): string {
  if (value === undefined || value === null) return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return `${Math.round(num * 10) / 10}`;
}

export function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getYoutubeEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    if (
      parsed.hostname.includes('youtube.com') &&
      parsed.searchParams.get('v')
    ) {
      return `https://www.youtube.com/embed/${parsed.searchParams.get('v')}`;
    }
    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.replace(/^\/+/, '');
      if (videoId) return `https://www.youtube.com/embed/${videoId}`;
    }
    if (
      parsed.hostname.includes('youtube.com') &&
      parsed.pathname.startsWith('/embed/')
    ) {
      return url.trim();
    }
  } catch {
    return null;
  }
  return null;
}

export function toFutureDateInputValue(daysFromNow = 30): string {
  const d = new Date(Date.now() + daysFromNow * 86_400_000);
  return d.toISOString().slice(0, 10);
}
