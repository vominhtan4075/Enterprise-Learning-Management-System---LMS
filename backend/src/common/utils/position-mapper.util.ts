import { Logger } from '@nestjs/common';
import { PositionLevel } from '../../generated/prisma/client.js';

export interface PositionMappingConfig {
  token: string;
  level: PositionLevel;
}

/**
 * Bảng cấu hình ánh xạ chức danh / vị trí HRM sang PositionLevel enum (WP4 4.5).
 * Có thể mở rộng hoặc override qua biến môi trường / JSON cấu hình.
 */
const DEFAULT_MAPPING_RULES: PositionMappingConfig[] = [
  { token: 'lead', level: PositionLevel.LEAD },
  { token: 'senior', level: PositionLevel.SENIOR },
  { token: 'junior', level: PositionLevel.JUNIOR },
  { token: 'fresher', level: PositionLevel.FRESHER },
  { token: 'intern', level: PositionLevel.INTERN },
];

export class PositionMapper {
  private static readonly logger = new Logger(PositionMapper.name);

  /**
   * Ánh xạ chuỗi chức danh bất kỳ sang PositionLevel enum.
   * - Không phân biệt hoa/thường (e.g. "Tech Lead", "LEAD", "lead" -> LEAD).
   * - Nếu không khớp token nào hoặc chuỗi rỗng: ghi log cảnh báo và trả về `null`.
   */
  static map(rawPosition?: string | null): PositionLevel | null {
    if (!rawPosition || typeof rawPosition !== 'string') {
      this.logger.warn(`Position is empty or not a string. Returning null.`);
      return null;
    }

    const normalized = rawPosition.trim().toLowerCase();
    if (!normalized) {
      this.logger.warn(`Position string is blank. Returning null.`);
      return null;
    }

    for (const rule of DEFAULT_MAPPING_RULES) {
      if (normalized.includes(rule.token)) {
        return rule.level;
      }
    }

    this.logger.warn(
      `Unrecognized position "${rawPosition}". Could not map to PositionLevel. Returning null.`,
    );
    return null;
  }

  /**
   * Ánh xạ chuỗi vị trí kèm giá trị fallback an toàn (mặc định FRESHER).
   */
  static mapWithFallback(
    rawPosition?: string | null,
    fallback: PositionLevel = PositionLevel.FRESHER,
  ): PositionLevel {
    const mapped = this.map(rawPosition);
    return mapped ?? fallback;
  }
}

