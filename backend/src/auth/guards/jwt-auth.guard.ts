import {
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../common/constants/error-codes.js';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  override handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
  ): TUser {
    if (err instanceof BusinessException) {
      throw err;
    }
    if (err || !user) {
      throw new BusinessException(
        ErrorCode.AUTH_UNAUTHORIZED,
        'Vui lòng đăng nhập để truy cập tài nguyên này.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return user;
  }
}

