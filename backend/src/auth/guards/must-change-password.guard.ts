import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../common/constants/error-codes.js';

@Injectable()
export class MustChangePasswordGuard implements CanActivate {
  private readonly allowedPrefixes = [
    '/api/v1/auth/me',
    '/api/v1/auth/change-password',
    '/api/v1/auth/logout',
    '/api/v1/health',
  ];

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user || !user.mustChangePassword) {
      return true;
    }

    const path = request.path || request.url || '';
    const isAllowed = this.allowedPrefixes.some((prefix) =>
      path.startsWith(prefix),
    );

    if (!isAllowed) {
      throw new BusinessException(
        ErrorCode.AUTH_FORBIDDEN,
        'Tài khoản của bạn yêu cầu đổi mật khẩu lần đầu trước khi sử dụng hệ thống.',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}

