import { HttpStatus, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma.service.js';
import { RedisService } from '../../common/redis/redis.service.js';
import { BusinessException } from '../../common/exceptions/business.exception.js';
import { ErrorCode } from '../../common/constants/error-codes.js';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PositionLevel, RoleCode } from '../../generated/prisma/client.js';

export interface JwtPayload {
  sub: string;
  email: string;
  role: RoleCode;
  position: PositionLevel;
  tokenVersion: number;
  jti?: string;
}

interface CachedAuthUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  position: PositionLevel;
  department: string | null;
  isActive: boolean;
  deletedAt: string | null;
  mustChangePassword: boolean;
  tokenVersion: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey:
        process.env.JWT_SECRET ?? 'novatech-lms-super-secret-jwt-key-2026-dev',
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    if (!payload?.sub) {
      throw new BusinessException(
        ErrorCode.AUTH_UNAUTHORIZED,
        'Token xác thực không hợp lệ.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (payload.jti) {
      const denied = await this.redis.get<boolean>(
        `lms:jwt:denylist:${payload.jti}`,
      );
      if (denied) {
        throw new BusinessException(
          ErrorCode.AUTH_UNAUTHORIZED,
          'Phiên đăng nhập đã kết thúc. Vui lòng đăng nhập lại.',
          HttpStatus.UNAUTHORIZED,
        );
      }
    }

    const cacheKey = `lms:user:${payload.sub}`;
    let user = await this.redis.get<CachedAuthUser>(cacheKey);

    if (!user) {
      const dbUser = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: { role: true },
      });

      if (!dbUser) {
        throw new BusinessException(
          ErrorCode.AUTH_UNAUTHORIZED,
          'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.',
          HttpStatus.UNAUTHORIZED,
        );
      }

      user = {
        id: dbUser.id,
        email: dbUser.email,
        fullName: dbUser.fullName,
        role: dbUser.role.code,
        position: dbUser.position,
        department: dbUser.department,
        isActive: dbUser.isActive,
        deletedAt: dbUser.deletedAt ? dbUser.deletedAt.toISOString() : null,
        mustChangePassword: dbUser.mustChangePassword,
        tokenVersion: dbUser.tokenVersion,
      };

      await this.redis.set(cacheKey, user, 300);
    }

    if (!user.isActive || user.deletedAt !== null) {
      throw new BusinessException(
        ErrorCode.AUTH_UNAUTHORIZED,
        'Tài khoản đã bị khóa hoặc ngừng hoạt động.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (user.tokenVersion !== payload.tokenVersion) {
      throw new BusinessException(
        ErrorCode.AUTH_UNAUTHORIZED,
        'Phiên đăng nhập đã hết hiệu lực do thay đổi thông tin bảo mật. Vui lòng đăng nhập lại.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      position: user.position,
      department: user.department,
      mustChangePassword: user.mustChangePassword,
      tokenVersion: user.tokenVersion,
    };
  }
}

