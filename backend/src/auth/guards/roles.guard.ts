import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../common/constants/error-codes.js';
import { RoleCode } from '../../generated/prisma/client.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<RoleCode[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new BusinessException(
        ErrorCode.AUTH_UNAUTHORIZED,
        'Vui lòng đăng nhập để thực hiện thao tác này.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!requiredRoles.includes(user.role)) {
      throw new BusinessException(
        ErrorCode.AUTH_FORBIDDEN,
        'Bạn không có quyền truy cập vào tài nguyên này.',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }
}

