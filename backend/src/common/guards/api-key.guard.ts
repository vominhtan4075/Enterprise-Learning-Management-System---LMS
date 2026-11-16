import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { BusinessException } from '../exceptions/business.exception.js';
import { ErrorCode } from '../constants/error-codes.js';
import { AuthenticatedUser } from '../decorators/current-user.decorator.js';

/**
 * Xác thực principal SYSTEM_HRM bằng header `x-api-key` (so sánh constant-time),
 * hoặc cho qua nếu request đã được JwtAuthGuard xác thực là ADMIN.
 * Fail-closed: nếu server chưa cấu hình HRM_API_KEY thì từ chối mọi request dùng api-key.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    const providedKey = request.headers['x-api-key'];

    if (providedKey === undefined) {
      if (request.user?.role === 'ADMIN') {
        return true;
      }
      if (request.user) {
        throw new BusinessException(
          ErrorCode.AUTH_FORBIDDEN,
          'Bạn không có quyền truy cập vào tài nguyên này.',
          HttpStatus.FORBIDDEN,
        );
      }
      throw this.unauthorized();
    }

    const expectedKey = process.env.HRM_API_KEY;
    if (!expectedKey) {
      this.logger.error('HRM_API_KEY chưa được cấu hình – từ chối request dùng x-api-key.');
      throw this.unauthorized();
    }

    if (typeof providedKey !== 'string' || providedKey.length === 0) {
      throw this.unauthorized();
    }

    const expectedBuf = Buffer.from(expectedKey, 'utf8');
    const providedBuf = Buffer.from(providedKey, 'utf8');

    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw this.unauthorized();
    }

    return true;
  }

  private unauthorized(): BusinessException {
    return new BusinessException(
      ErrorCode.AUTH_UNAUTHORIZED,
      'Thiếu hoặc sai khóa xác thực x-api-key.',
      HttpStatus.UNAUTHORIZED,
    );
  }
}
