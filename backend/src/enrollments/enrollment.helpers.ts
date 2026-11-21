import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import { EnrollmentStatus } from '../generated/prisma/enums.js';

/**
 * Tính trạng thái hiệu lực thực tế của Enrollment tại thời điểm đọc (WP7 mục 3.6 & 715):
 * - Nếu đã COMPLETED -> giữ nguyên COMPLETED.
 * - Nếu chưa hoàn thành mà deadline < now -> OVERDUE.
 * - Ngược lại -> IN_PROGRESS.
 */
export function computeEffectiveStatus(
  status: EnrollmentStatus,
  deadline: Date,
  now: Date = new Date(),
): EnrollmentStatus {
  if (status === EnrollmentStatus.COMPLETED) {
    return EnrollmentStatus.COMPLETED;
  }
  if (deadline.getTime() < now.getTime()) {
    return EnrollmentStatus.OVERDUE;
  }
  return EnrollmentStatus.IN_PROGRESS;
}

/**
 * Chuẩn hóa chuỗi ngày deadline và kiểm tra điều kiện deadline > now:
 * - Nếu chỉ truyền YYYY-MM-DD (10 ký tự), tự động quy về cuối ngày 23:59:59.999 (+07:00 Asia/Ho_Chi_Minh).
 * - Nếu deadline <= now -> ném lỗi 400 BAD_REQUEST.
 */
export function normalizeAndValidateDeadline(
  deadlineInput: string | Date,
  now: Date = new Date(),
): Date {
  let parsed: Date;

  if (deadlineInput instanceof Date) {
    parsed = new Date(deadlineInput.getTime());
  } else if (typeof deadlineInput === 'string') {
    const trimmed = deadlineInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      parsed = new Date(`${trimmed}T23:59:59.999+07:00`);
    } else {
      parsed = new Date(trimmed);
    }
  } else {
    throw new BusinessException(
      ErrorCode.BAD_REQUEST,
      'Định dạng hạn chót (deadline) không hợp lệ.',
      HttpStatus.BAD_REQUEST,
    );
  }

  if (Number.isNaN(parsed.getTime())) {
    throw new BusinessException(
      ErrorCode.BAD_REQUEST,
      'Định dạng hạn chót (deadline) không hợp lệ.',
      HttpStatus.BAD_REQUEST,
    );
  }

  if (parsed.getTime() <= now.getTime()) {
    throw new BusinessException(
      ErrorCode.BAD_REQUEST,
      'Hạn chót hoàn thành (deadline) phải lớn hơn thời điểm hiện tại.',
      HttpStatus.BAD_REQUEST,
    );
  }

  return parsed;
}

/**
 * Công thức tính % tiến độ chuẩn (Mục 3.5):
 * items = (số lesson isRequired) + (số quiz đã publish)
 * done  = (số lesson isRequired đã hoàn thành) + (số quiz đã PASSED)
 * progressPercentage = round(done / items * 100, 1)
 */
export function calculateProgressPercentage(
  totalItems: number,
  completedItems: number,
): number {
  if (totalItems <= 0) {
    return 0;
  }
  const raw = (completedItems / totalItems) * 100;
  const rounded = Math.round(raw * 10) / 10;
  return Math.min(100, Math.max(0, rounded));
}
