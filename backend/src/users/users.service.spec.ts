import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { UsersService } from './users.service.js';
import { PasswordService } from '../auth/password.service.js';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { PositionLevel, RoleCode } from '../generated/prisma/client.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';

describe('UsersService (WP4)', () => {
  let service: UsersService;
  let prismaMock: {
    role: { findUnique: ReturnType<typeof jest.fn> };
    user: {
      findFirst: ReturnType<typeof jest.fn>;
      findMany: ReturnType<typeof jest.fn>;
      count: ReturnType<typeof jest.fn>;
      create: ReturnType<typeof jest.fn>;
      update: ReturnType<typeof jest.fn>;
    };
  };
  let redisMock: {
    del: ReturnType<typeof jest.fn>;
    get: ReturnType<typeof jest.fn>;
    set: ReturnType<typeof jest.fn>;
  };
  let passwordService: PasswordService;

  const mockAdminActor: AuthenticatedUser = {
    id: 'admin-1',
    email: 'admin@novatech.com',
    fullName: 'Admin User',
    role: RoleCode.ADMIN,
    position: PositionLevel.LEAD,
    department: 'IT Administration',
    mustChangePassword: false,
    tokenVersion: 1,
  };

  const mockTrainerActor: AuthenticatedUser = {
    id: 'trainer-1',
    email: 'trainer@novatech.com',
    fullName: 'Trainer User',
    role: RoleCode.TRAINER,
    position: PositionLevel.SENIOR,
    department: 'Training',
    mustChangePassword: false,
    tokenVersion: 1,
  };

  const mockEmployeeActor: AuthenticatedUser = {
    id: 'emp-1',
    email: 'emp1@novatech.com',
    fullName: 'Employee One',
    role: RoleCode.EMPLOYEE,
    position: PositionLevel.FRESHER,
    department: 'Software Engineering',
    mustChangePassword: false,
    tokenVersion: 1,
  };

  beforeEach(() => {
    passwordService = new PasswordService();
    prismaMock = {
      role: { findUnique: jest.fn() },
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    redisMock = {
      del: jest.fn().mockResolvedValue(undefined as never),
      get: jest.fn().mockResolvedValue(null as never),
      set: jest.fn().mockResolvedValue(undefined as never),
    };

    service = new UsersService(
      prismaMock as unknown as PrismaService,
      redisMock as unknown as RedisService,
      passwordService,
    );
  });

  describe('create()', () => {
    it('báo lỗi 400 BAD_REQUEST khi roleId không tồn tại', async () => {
      prismaMock.role.findUnique.mockResolvedValue(null as never);

      await expect(
        service.create({
          email: 'new@novatech.com',
          fullName: 'New User',
          roleId: 999,
          position: PositionLevel.FRESHER,
        }),
      ).rejects.toMatchObject({
        errorCode: 'BAD_REQUEST',
        status: 400,
      });
    });

    it('tạo người dùng kèm mật khẩu chỉ định (mustChangePassword=false)', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 1,
        code: RoleCode.EMPLOYEE,
      } as never);
      prismaMock.user.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'u-created',
          email: args.data.email,
          fullName: args.data.fullName,
          mustChangePassword: args.data.mustChangePassword,
        }),
      );

      const result = await service.create({
        email: '  test@novatech.com  ',
        fullName: 'Test Employee',
        roleId: 1,
        position: PositionLevel.FRESHER,
        password: 'CustomPassword123!',
      });

      expect(result.email).toBe('test@novatech.com');
      expect(result.mustChangePassword).toBe(false);
      expect('temporaryPassword' in result).toBe(false);
    });

    it('tự sinh mật khẩu ngẫu nhiên khi không truyền và trả về temporaryPassword', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 1,
        code: RoleCode.EMPLOYEE,
      } as never);
      prismaMock.user.create.mockImplementation((args: any) =>
        Promise.resolve({
          id: 'u-created-auto',
          email: args.data.email,
          fullName: args.data.fullName,
          mustChangePassword: args.data.mustChangePassword,
        }),
      );

      const result = await service.create({
        email: 'auto@novatech.com',
        fullName: 'Auto Password Employee',
        roleId: 1,
        position: PositionLevel.INTERN,
      });

      expect(result.mustChangePassword).toBe(true);
      expect(result).toHaveProperty('temporaryPassword');
      expect((result as any).temporaryPassword.length).toBeGreaterThanOrEqual(12);
    });
  });

  describe('findAll()', () => {
    it('TRAINER gọi: chỉ lọc EMPLOYEE active và trả trường rút gọn (không lộ ADMIN/HR)', async () => {
      const mockEmployees = [
        {
          id: 'emp-1',
          email: 'emp1@novatech.com',
          fullName: 'Emp 1',
          position: PositionLevel.FRESHER,
          department: 'Engineering',
        },
      ];
      prismaMock.user.findMany.mockResolvedValue(mockEmployees as never);
      prismaMock.user.count.mockResolvedValue(1 as never);

      const result = await service.findAll(mockTrainerActor, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual(mockEmployees);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            isActive: true,
            role: { code: RoleCode.EMPLOYEE },
          }),
        }),
      );
    });

    it('phân trang đúng (150 user, limit 20 -> totalPages = 8)', async () => {
      prismaMock.user.findMany.mockResolvedValue([] as never);
      prismaMock.user.count.mockResolvedValue(150 as never);

      const result = await service.findAll(mockAdminActor, {
        page: 1,
        limit: 20,
      });

      expect(result.total).toBe(150);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(8);
    });
  });

  describe('findOne()', () => {
    it('EMPLOYEE cố xem người dùng khác -> trả về 404 NOT_FOUND', async () => {
      await expect(
        service.findOne('another-id', mockEmployeeActor),
      ).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
        status: 404,
      });
    });

    it('TRAINER xem người dùng không phải EMPLOYEE -> 404 NOT_FOUND', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null as never);

      await expect(
        service.findOne('admin-1', mockTrainerActor),
      ).rejects.toMatchObject({
        errorCode: 'NOT_FOUND',
        status: 404,
      });
    });

    it('ADMIN xem người dùng -> trả về đầy đủ USER_SELECT', async () => {
      const mockUser = {
        id: 'emp-1',
        email: 'emp1@novatech.com',
        fullName: 'Emp 1',
        roleId: 1,
        role: { code: RoleCode.EMPLOYEE },
      };
      prismaMock.user.findFirst.mockResolvedValue(mockUser as never);

      const result = await service.findOne('emp-1', mockAdminActor);
      expect(result).toEqual(mockUser);
    });
  });

  describe('updateRole()', () => {
    it('chặn tự thay đổi vai trò của chính mình -> 422 UNPROCESSABLE_ENTITY', async () => {
      await expect(
        service.updateRole(
          'admin-1',
          { role: RoleCode.EMPLOYEE },
          mockAdminActor,
        ),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
      });
    });

    it('chặn hạ quyền ADMIN cuối cùng của hệ thống -> 422 UNPROCESSABLE_ENTITY', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'admin-2',
        role: { code: RoleCode.ADMIN },
      } as never);
      prismaMock.role.findUnique.mockResolvedValue({
        id: 1,
        code: RoleCode.EMPLOYEE,
      } as never);
      // Chỉ còn 1 admin duy nhất
      prismaMock.user.count.mockResolvedValue(1 as never);

      await expect(
        service.updateRole(
          'admin-2',
          { role: RoleCode.EMPLOYEE },
          mockAdminActor,
        ),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
      });
    });

    it('cho phép đổi vai trò khi còn nhiều ADMIN và hủy phiên cache', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'admin-2',
        role: { code: RoleCode.ADMIN },
      } as never);
      prismaMock.role.findUnique.mockResolvedValue({
        id: 1,
        code: RoleCode.EMPLOYEE,
      } as never);
      prismaMock.user.count.mockResolvedValue(2 as never); // Có 2 admin
      prismaMock.user.update.mockResolvedValue({
        id: 'admin-2',
        roleId: 1,
      } as never);

      await service.updateRole(
        'admin-2',
        { role: RoleCode.EMPLOYEE },
        mockAdminActor,
      );

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'admin-2' },
          data: expect.objectContaining({
            roleId: 1,
            tokenVersion: { increment: 1 },
          }),
        }),
      );
      expect(redisMock.del).toHaveBeenCalledWith('lms:user:admin-2');
    });
  });

  describe('updateStatus() & remove()', () => {
    it('chặn tự khóa tài khoản của chính mình -> 422 UNPROCESSABLE_ENTITY', async () => {
      await expect(
        service.updateStatus('admin-1', { isActive: false }, mockAdminActor),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
      });
    });

    it('chặn tự xóa tài khoản của chính mình -> 422 UNPROCESSABLE_ENTITY', async () => {
      await expect(
        service.remove('admin-1', mockAdminActor),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
      });
    });

    it('chặn xóa mềm ADMIN cuối cùng -> 422 UNPROCESSABLE_ENTITY', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'admin-2',
        role: { code: RoleCode.ADMIN },
      } as never);
      prismaMock.user.count.mockResolvedValue(1 as never);

      await expect(
        service.remove('admin-2', mockAdminActor),
      ).rejects.toMatchObject({
        errorCode: 'UNPROCESSABLE_ENTITY',
      });
    });

    it('xóa mềm hợp lệ: đặt deletedAt, isActive=false, tăng tokenVersion và xóa cache', async () => {
      prismaMock.user.findFirst.mockResolvedValue({
        id: 'emp-2',
        role: { code: RoleCode.EMPLOYEE },
      } as never);
      prismaMock.user.update.mockResolvedValue({ id: 'emp-2' } as never);

      await service.remove('emp-2', mockAdminActor);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'emp-2' },
          data: expect.objectContaining({
            isActive: false,
            tokenVersion: { increment: 1 },
          }),
        }),
      );
      expect(redisMock.del).toHaveBeenCalledWith('lms:user:emp-2');
    });
  });
});

