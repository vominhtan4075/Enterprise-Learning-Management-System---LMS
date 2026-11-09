import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service.js';
import { PasswordService } from './password.service.js';
import { JwtStrategy } from './strategies/jwt.strategy.js';
import { RolesGuard } from './guards/roles.guard.js';
import { MustChangePasswordGuard } from './guards/must-change-password.guard.js';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { PositionLevel, RoleCode } from '../generated/prisma/client.js';

describe('Auth & RBAC (WP3)', () => {
  let authService: AuthService;
  let passwordService: PasswordService;
  let prismaMock: {
    user: {
      findFirst: ReturnType<typeof jest.fn>;
      findUnique: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
    };
    pathEnrollment: {
      count: ReturnType<typeof jest.fn>;
      upsert: ReturnType<typeof jest.fn>;
    };
    learningPath: {
      findUnique: ReturnType<typeof jest.fn>;
    };
  };
  let redisMock: {
    get: ReturnType<typeof jest.fn>;
    set: ReturnType<typeof jest.fn>;
    del: ReturnType<typeof jest.fn>;
  };
  let jwtServiceMock: {
    signAsync: ReturnType<typeof jest.fn>;
  };

  beforeEach(() => {
    passwordService = new PasswordService();
    prismaMock = {
      user: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      pathEnrollment: {
        count: jest.fn().mockResolvedValue(1 as never),
        upsert: jest.fn(),
      },
      learningPath: {
        findUnique: jest.fn(),
      },
    };
    redisMock = {
      get: jest.fn().mockResolvedValue(null as never),
      set: jest.fn().mockResolvedValue(undefined as never),
      del: jest.fn().mockResolvedValue(undefined as never),
    };
    jwtServiceMock = {
      signAsync: jest.fn().mockResolvedValue('mock-jwt-token' as never),
    };

    authService = new AuthService(
      prismaMock as unknown as PrismaService,
      jwtServiceMock as unknown as JwtService,
      redisMock as unknown as RedisService,
      passwordService,
    );
  });

  describe('AuthService.login()', () => {
    it('nên đăng nhập thành công và trả về accessToken (không bao giờ lộ password)', async () => {
      const hashedPassword = await passwordService.hash('Password123!');
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'u-1',
        email: 'huan.nguyen@novatech.com',
        password: hashedPassword,
        fullName: 'Nguyễn Văn Huấn',
        position: PositionLevel.FRESHER,
        department: 'Software Engineering',
        isActive: true,
        mustChangePassword: false,
        tokenVersion: 0,
        lastLoginAt: new Date(),
        role: { id: 1, code: RoleCode.EMPLOYEE },
      } as never);
      prismaMock.user.update.mockResolvedValue({} as never);

      const res = await authService.login({
        email: '  HUAN.NGUYEN@novatech.com ',
        password: 'Password123!',
      });

      expect(res.statusCode).toBe(200);
      expect(res.accessToken).toBe('mock-jwt-token');
      expect(res.data.accessToken).toBe('mock-jwt-token');
      expect(res.user.role).toBe(RoleCode.EMPLOYEE);
      expect('password' in res.user).toBe(false);
    });

    it('nên từ chối với mã 401 AUTH_UNAUTHORIZED khi sai mật khẩu hoặc tài khoản bị khóa', async () => {
      const hashedPassword = await passwordService.hash('Password123!');
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'u-1',
        email: 'huan.nguyen@novatech.com',
        password: hashedPassword,
        isActive: true,
        role: { id: 1, code: RoleCode.EMPLOYEE },
      } as never);

      await expect(
        authService.login({
          email: 'huan.nguyen@novatech.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toMatchObject({
        errorCode: 'AUTH_UNAUTHORIZED',
      });
    });

    it('nên chặn với mã 429 TOO_MANY_REQUESTS khi đăng nhập sai quá 5 lần', async () => {
      redisMock.get.mockResolvedValue(5 as never);

      await expect(
        authService.login({
          email: 'huan.nguyen@novatech.com',
          password: 'Password123!',
        }),
      ).rejects.toMatchObject({
        errorCode: 'TOO_MANY_REQUESTS',
      });
    });
  });

  describe('AuthService.changePassword() & JwtStrategy tokenVersion', () => {
    it('nên tăng tokenVersion khi đổi mật khẩu và từ chối token cũ có tokenVersion lệch', async () => {
      const oldHash = await passwordService.hash('Password123!');
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'u-1',
        password: oldHash,
      } as never);
      prismaMock.user.update.mockResolvedValue({} as never);

      const res = await authService.changePassword('u-1', {
        currentPassword: 'Password123!',
        newPassword: 'NewStrongPass2026!',
      });

      expect(res.statusCode).toBe(200);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'u-1' },
          data: expect.objectContaining({
            mustChangePassword: false,
            tokenVersion: { increment: 1 },
          }),
        }),
      );

      // Kiểm tra JwtStrategy từ chối token cũ có tokenVersion = 0 khi DB đã lên 1
      const strategy = new JwtStrategy(
        prismaMock as unknown as PrismaService,
        redisMock as unknown as RedisService,
      );
      prismaMock.user.findUnique.mockResolvedValue({
        id: 'u-1',
        email: 'huan.nguyen@novatech.com',
        fullName: 'Nguyễn Văn Huấn',
        position: PositionLevel.FRESHER,
        department: 'Software Engineering',
        isActive: true,
        deletedAt: null,
        mustChangePassword: false,
        tokenVersion: 1,
        role: { id: 1, code: RoleCode.EMPLOYEE },
      } as never);

      await expect(
        strategy.validate({
          sub: 'u-1',
          email: 'huan.nguyen@novatech.com',
          role: RoleCode.EMPLOYEE,
          position: PositionLevel.FRESHER,
          tokenVersion: 0,
        }),
      ).rejects.toMatchObject({
        errorCode: 'AUTH_UNAUTHORIZED',
      });
    });
  });

  describe('RolesGuard & MustChangePasswordGuard', () => {
    it('RolesGuard nên chặn 403 AUTH_FORBIDDEN khi EMPLOYEE truy cập API của ADMIN', () => {
      const reflector = {
        getAllAndOverride: jest.fn().mockReturnValue([RoleCode.ADMIN]),
      } as unknown as Reflector;
      const guard = new RolesGuard(reflector);

      const mockCtx = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: 'u-1', role: RoleCode.EMPLOYEE },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(mockCtx)).toThrow(
        expect.objectContaining({ errorCode: 'AUTH_FORBIDDEN' }),
      );
    });

    it('MustChangePasswordGuard nên chặn truy cập API nghiệp vụ khi mustChangePassword = true', () => {
      const guard = new MustChangePasswordGuard();
      const blockedCtx = {
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/api/v1/courses',
            user: { id: 'u-1', mustChangePassword: true },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(blockedCtx)).toThrow(
        expect.objectContaining({ errorCode: 'AUTH_FORBIDDEN' }),
      );

      const allowedCtx = {
        switchToHttp: () => ({
          getRequest: () => ({
            path: '/api/v1/auth/change-password',
            user: { id: 'u-1', mustChangePassword: true },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(allowedCtx)).toBe(true);
    });
  });
});

