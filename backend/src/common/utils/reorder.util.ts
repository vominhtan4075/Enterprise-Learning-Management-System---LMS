import { HttpStatus } from '@nestjs/common';
import { BusinessException } from '../exceptions/business.exception.js';
import { ErrorCode } from '../constants/error-codes.js';

/**
 * Kiểm tra danh sách ID sắp xếp lại (reorder) hợp lệ:
 * - Không rỗng, không chứa ID trùng lặp
 * - Khớp chính xác 1-1 với tập ID hiện có của tài nguyên cha
 */
export function validateReorderIds(
  existingIds: string[],
  orderedIds: string[],
  entityLabel = 'mục',
): void {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    throw new BusinessException(
      ErrorCode.BAD_REQUEST,
      `Danh sách thứ tự ${entityLabel} không được để trống.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  const uniqueOrdered = new Set(orderedIds);
  if (uniqueOrdered.size !== orderedIds.length) {
    throw new BusinessException(
      ErrorCode.BAD_REQUEST,
      `Danh sách thứ tự ${entityLabel} chứa ID bị trùng lặp.`,
      HttpStatus.BAD_REQUEST,
    );
  }

  if (existingIds.length !== orderedIds.length) {
    throw new BusinessException(
      ErrorCode.BAD_REQUEST,
      `Số lượng ${entityLabel} truyền lên (${orderedIds.length}) không khớp với số lượng hiện có (${existingIds.length}).`,
      HttpStatus.BAD_REQUEST,
    );
  }

  const existingSet = new Set(existingIds);
  for (const id of orderedIds) {
    if (!existingSet.has(id)) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        `${entityLabel} với ID "${id}" không thuộc tài nguyên hiện tại.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}

