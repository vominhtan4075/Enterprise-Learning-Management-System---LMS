import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { BusinessException } from '../exceptions/business.exception.js';
import { ErrorCode } from '../constants/error-codes.js';
import { AuthenticatedUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();

    if (request.user?.role === 'ADMIN') {
      return true;
    }

    const expectedKey = process.env.HRM_API_KEY;
    const providedKey = request.headers['x-api-key'];

    if (!expectedKey) {
      return true;
    }

    if (typeof providedKey !== 'string' || providedKey.length === 0) {
      throw new BusinessException(
        ErrorCode.AUTH_UNAUTHORIZED,
        'Thiếu hoặc sai khóa xác thực x-api-key.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const expectedBuf = Buffer.from(expectedKey, 'utf8');
    const providedBuf = Buffer.from(providedKey, 'utf8');

    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new BusinessException(
        ErrorCode.AUTH_UNAUTHORIZED,
        'Thiếu hoặc sai khóa xác thực x-api-key.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return true;
  }
}

