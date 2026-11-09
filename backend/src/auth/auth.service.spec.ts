import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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

      expect(res.accessToken).toBe('mock-jwt-token');
      expect(res.tokenType).toBe('Bearer');
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

      expect(res.message).toContain('Đổi mật khẩu thành công');
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
        {
          getOrThrow: () => 'test-jwt-secret-at-least-32-characters-long',
        } as unknown as ConfigService,
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

  describe('UsersService (P0 Security: no password leak & immediate token revocation)', () => {
    it('nên tăng tokenVersion, xóa cache Redis và tuyệt đối không trả về password khi cập nhật hoặc xóa mềm user', async () => {
      const { UsersService } = await import('../users/users.service.js');
      const usersPrismaMock = {
        user: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'u-target',
            email: 'target@novatech.com',
            roleId: 1,
          } as never),
          update: jest.fn().mockImplementation((async (args: {
            select?: Record<string, boolean>;
          }) => {
            expect(args.select?.password).toBeUndefined();
            return {
              id: 'u-target',
              email: 'target@novatech.com',
              fullName: 'Target User',
              roleId: 1,
              isActive: false,
            };
          }) as never),
        },
      };

      const usersService = new UsersService(
        usersPrismaMock as unknown as PrismaService,
        redisMock as unknown as RedisService,
        passwordService,
      );

      const adminActor = {
        id: 'u-admin',
        email: 'admin@novatech.com',
        fullName: 'Admin',
        role: RoleCode.ADMIN,
        position: PositionLevel.LEAD,
        department: 'IT',
        mustChangePassword: false,
        tokenVersion: 0,
      };

      const updated = await usersService.update(
        'u-target',
        { fullName: 'Updated Name' },
        adminActor,
      );
      expect('password' in updated).toBe(false);
      expect(usersPrismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tokenVersion: { increment: 1 },
          }),
        }),
      );
      expect(redisMock.del).toHaveBeenCalledWith('lms:user:u-target');

      const removed = await usersService.remove('u-target', adminActor);
      expect('password' in removed).toBe(false);
      expect(redisMock.del).toHaveBeenCalledWith('lms:user:u-target');
    });

    it('nên chặn hạ quyền hoặc khóa ADMIN hoạt động cuối cùng và phân trang đúng cho findAll()', async () => {
      const { UsersService } = await import('../users/users.service.js');
      const usersPrismaMock = {
        user: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'u-admin-1',
            email: 'admin1@novatech.com',
            roleId: 4,
            role: { code: RoleCode.ADMIN },
          } as never),
          findMany: jest.fn().mockResolvedValue([{ id: 'u-1' }, { id: 'u-2' }] as never),
          count: jest.fn().mockResolvedValue(1 as never),
          update: jest.fn(),
        },
        role: {
          findUnique: jest.fn().mockResolvedValue({ id: 1, code: RoleCode.EMPLOYEE } as never),
        },
      };

      const usersService = new UsersService(
        usersPrismaMock as unknown as PrismaService,
        redisMock as unknown as RedisService,
        passwordService,
      );

      const otherAdminActor = {
        id: 'u-admin-2',
        email: 'admin2@novatech.com',
        fullName: 'Admin 2',
        role: RoleCode.ADMIN,
        position: PositionLevel.LEAD,
        department: 'IT',
        mustChangePassword: false,
        tokenVersion: 0,
      };

      // Chỉ còn 1 ADMIN hoạt động -> chặn hạ quyền
      await expect(
        usersService.updateRole(
          'u-admin-1',
          { role: RoleCode.EMPLOYEE },
          otherAdminActor,
        ),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
      });

      // Phân trang 150 users, limit 20 -> 8 trang (WP4 test)
      usersPrismaMock.user.count.mockResolvedValueOnce(150 as never);
      const pageRes = (await usersService.findAll(otherAdminActor, {
        page: 2,
        limit: 20,
      })) as { total: number; page: number; limit: number; totalPages: number };
      expect(pageRes.total).toBe(150);
      expect(pageRes.page).toBe(2);
      expect(pageRes.limit).toBe(20);
      expect(pageRes.totalPages).toBe(8);
    });
  });

  describe('ApiKeyGuard (P0 Security: fail-closed)', () => {
    it('nên từ chối 401 AUTH_UNAUTHORIZED khi HRM_API_KEY chưa được cấu hình hoặc sai key', async () => {
      const { ApiKeyGuard } = await import('../common/guards/api-key.guard.js');
      const guard = new ApiKeyGuard();
      const prevKey = process.env.HRM_API_KEY;
      delete process.env.HRM_API_KEY;

      const ctxWithHeader = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-api-key': 'any-key' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctxWithHeader)).toThrow(
        expect.objectContaining({ errorCode: 'AUTH_UNAUTHORIZED' }),
      );

      process.env.HRM_API_KEY = 'secret-hrm-key-123456';
      const ctxWrongKey = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-api-key': 'wrong-key' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(() => guard.canActivate(ctxWrongKey)).toThrow(
        expect.objectContaining({ errorCode: 'AUTH_UNAUTHORIZED' }),
      );

      const ctxValidKey = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: { 'x-api-key': 'secret-hrm-key-123456' },
          }),
        }),
      } as unknown as ExecutionContext;

      expect(guard.canActivate(ctxValidKey)).toBe(true);
      process.env.HRM_API_KEY = prevKey;
    });
  });
});

