export type ReminderKind = 'D-3' | 'D-1' | 'D-0' | 'OVERDUE' | null;

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const MS_PER_DAY = 86_400_000;

/**
 * Chuyển timestamp về chỉ số ngày dương lịch theo múi giờ Asia/Ho_Chi_Minh (UTC+7).
 */
function toVnDayIndex(date: Date): number {
  return Math.floor((date.getTime() + VN_OFFSET_MS) / MS_PER_DAY);
}

/**
 * Trả về chuỗi ngày YYYY-MM-DD theo múi giờ Asia/Ho_Chi_Minh (UTC+7).
 */
function formatVnDate(date: Date): string {
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Hàm thuần xác định mốc nhắc hạn hoặc quá hạn của một Enrollment (WP10 10.4):
 * Tính theo số ngày dương lịch còn lại ở múi giờ Asia/Ho_Chi_Minh (UTC+7)
 * để khớp với cron chạy 08:00 ICT và deadline chuẩn 23:59:59+07:00:
 * - deadline < now           -> 'OVERDUE'
 * - calendarDaysDiff === 0   -> 'D-0' (hết hạn trong hôm nay)
 * - calendarDaysDiff === 1   -> 'D-1' (còn 1 ngày)
 * - calendarDaysDiff === 3   -> 'D-3' (còn 3 ngày)
 * - calendarDaysDiff === 2 hoặc > 3 -> null (chưa tới hoặc không thuộc mốc nhắc)
 */
export function calcReminderKind(
  deadline: Date,
  now: Date = new Date(),
): ReminderKind {
  if (deadline.getTime() < now.getTime()) {
    return 'OVERDUE';
  }

  const daysRemaining = toVnDayIndex(deadline) - toVnDayIndex(now);
  if (daysRemaining < 0) {
    return 'OVERDUE';
  }
  if (daysRemaining === 0) {
    return 'D-0';
  }
  if (daysRemaining === 1) {
    return 'D-1';
  }
  if (daysRemaining === 3) {
    return 'D-3';
  }

  return null;
}

/**
 * Tạo dedupeKey chống gửi trùng thông báo nhắc hạn:
 * Gắn kèm ngày deadline (YYYY-MM-DD theo Asia/Ho_Chi_Minh) để khi HR/Trainer gia hạn deadline mới thì lịch nhắc mới vẫn hoạt động.
 */
export function buildReminderDedupeKey(
  enrollmentId: string,
  kind: Exclude<ReminderKind, null>,
  deadline: Date,
  recipientUserId?: string,
): string {
  const datePart = formatVnDate(deadline);
  const userSuffix = recipientUserId ? `:${recipientUserId}` : '';
  return `reminder:${enrollmentId}:${kind}:${datePart}${userSuffix}`;
}
