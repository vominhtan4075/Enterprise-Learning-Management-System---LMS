export type ReminderKind = 'D-3' | 'D-1' | 'D-0' | 'OVERDUE' | null;

/**
 * Hàm thuần xác định mốc nhắc hạn hoặc quá hạn của một Enrollment (WP10 10.4):
 * - deadline < now -> 'OVERDUE'
 * - Còn <= 24 giờ -> 'D-0' (trong ngày hạn chót)
 * - Còn <= 48 giờ -> 'D-1' (trước 1 ngày)
 * - Còn <= 72 giờ -> 'D-3' (trước 3 ngày)
 * - Còn > 72 giờ -> null (chưa tới mốc nhắc)
 */
export function calcReminderKind(
  deadline: Date,
  now: Date = new Date(),
): ReminderKind {
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs < 0) {
    return 'OVERDUE';
  }

  const diffHours = diffMs / 3_600_000;
  if (diffHours <= 24) {
    return 'D-0';
  }
  if (diffHours <= 48) {
    return 'D-1';
  }
  if (diffHours <= 72) {
    return 'D-3';
  }

  return null;
}

/**
 * Tạo dedupeKey chống gửi trùng thông báo nhắc hạn:
 * Gắn kèm ngày deadline (YYYY-MM-DD) để khi HR/Trainer gia hạn deadline mới thì lịch nhắc mới vẫn hoạt động.
 */
export function buildReminderDedupeKey(
  enrollmentId: string,
  kind: Exclude<ReminderKind, null>,
  deadline: Date,
  recipientUserId?: string,
): string {
  const datePart = deadline.toISOString().slice(0, 10);
  const userSuffix = recipientUserId ? `:${recipientUserId}` : '';
  return `reminder:${enrollmentId}:${kind}:${datePart}${userSuffix}`;
}
