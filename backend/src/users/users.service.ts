import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma.service.js';
import { RedisService } from '../common/redis/redis.service.js';
import { PasswordService } from '../auth/password.service.js';
import { BusinessException } from '../common/exceptions/business.exception.js';
import { ErrorCode } from '../common/constants/error-codes.js';
import { paginate } from '../common/utils/pagination.util.js';
import type { AuthenticatedUser } from '../common/decorators/current-user.decorator.js';
import { Prisma } from '../generated/prisma/client.js';
import { RoleCode } from '../generated/prisma/enums.js';
import {
  CreateUserDto,
  QueryUsersDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
} from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

/** Trường được phép trả ra cho ADMIN/HR – tuyệt đối không có `password`, `tokenVersion`. */
const USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  roleId: true,
  role: { select: { code: true } },
  position: true,
  department: true,
  employeeCode: true,
  jobTitle: true,
  isActive: true,
  mustChangePassword: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Bản rút gọn cho TRAINER (chọn học viên khi giao bài – WP4 4.1). */
const USER_BRIEF_SELECT = {
  id: true,
  email: true,
  fullName: true,
  position: true,
  department: true,
} as const;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly passwordService: PasswordService,
  ) {}

  private generateRandomPassword(): string {
    // Sinh mật khẩu ngẫu nhiên ≥ 12 ký tự (WP4 4.3)
    return `Nv@${randomBytes(10).toString('base64url')}9!`;
  }

  async create(createUserDto: CreateUserDto) {
    const roleRecord = await this.prisma.role.findUnique({
      where: { id: createUserDto.roleId },
    });
    if (!roleRecord) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        `Vai trò với ID ${createUserDto.roleId} không tồn tại.`,
        HttpStatus.BAD_REQUEST,
      );
    }

    const hasProvidedPassword = Boolean(createUserDto.password?.trim());
    const plainPassword = hasProvidedPassword
      ? createUserDto.password!.trim()
      : this.generateRandomPassword();

    const hashedPassword = await this.passwordService.hash(plainPassword);
    const created = await this.prisma.user.create({
      data: {
        ...createUserDto,
        email: createUserDto.email.trim().toLowerCase(),
        password: hashedPassword,
        mustChangePassword: !hasProvidedPassword,
      },
      select: USER_SELECT,
    });

    this.logger.log(
      `Created user id=${created.id} email=${created.email} mustChangePassword=${created.mustChangePassword}`,
    );
    return {
      ...created,
      ...(!hasProvidedPassword ? { temporaryPassword: plainPassword } : {}),
    };
  }

  async findAll(
    actor: AuthenticatedUser,
    query: QueryUsersDto = {},
  ) {
    const hasExplicitPagination =
      query.page !== undefined ||
      query.limit !== undefined ||
      query.role !== undefined ||
      query.department !== undefined ||
      query.position !== undefined ||
      query.search !== undefined ||
      query.isActive !== undefined;

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.max(1, Math.min(100, Math.floor(limit)));
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
    };

    if (actor?.role === RoleCode.TRAINER) {
      where.isActive = true;
      where.role = { code: RoleCode.EMPLOYEE };
    } else {
      if (query.role) {
        where.role = { code: query.role };
      }
      if (query.isActive !== undefined) {
        where.isActive = query.isActive;
      }
    }

    if (query.department?.trim()) {
      where.department = {
        contains: query.department.trim(),
        mode: 'insensitive',
      };
    }

    if (query.position) {
      where.position = query.position;
    }

    if (query.search?.trim()) {
      const q = query.search.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { employeeCode: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Nếu gọi GET /api/v1/users không truyền query phân trang (như Playwright E2E TC03 & Frontend hiện tại)
    // thì trả về mảng trực tiếp để tương thích, còn khi truyền page/limit/filter thì trả về PaginatedResult
    if (!hasExplicitPagination && actor?.role !== RoleCode.TRAINER) {
      return this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: USER_SELECT,
      });
    }

    if (actor?.role === RoleCode.TRAINER) {
      const [items, total] = await Promise.all([
        this.prisma.user.findMany({
          where,
          orderBy: { fullName: 'asc' },
          skip,
          take: safeLimit,
          select: USER_BRIEF_SELECT,
        }),
        this.prisma.user.count({ where }),
      ]);
      return paginate(items, total, safePage, safeLimit);
    }

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
        select: USER_SELECT,
      }),
      this.prisma.user.count({ where }),
    ]);

    return paginate(items, total, safePage, safeLimit);
  }

  async findOne(id: string, actor: AuthenticatedUser) {
    const isSelf = actor.id === id;

    if (actor.role === RoleCode.EMPLOYEE && !isSelf) {
      throw this.notFound(id);
    }

    if (actor.role === RoleCode.TRAINER && !isSelf) {
      const brief = await this.prisma.user.findFirst({
        where: { id, deletedAt: null, role: { code: RoleCode.EMPLOYEE } },
        select: USER_BRIEF_SELECT,
      });
      if (!brief) {
        throw this.notFound(id);
      }
      return brief;
    }

    return this.findActiveOrThrow(id);
  }

  async update(
    id: string,
    updateUserDto: UpdateUserDto,
    _actor: AuthenticatedUser,
  ) {
    await this.findActiveOrThrow(id);

    const { password, ...rest } = updateUserDto;
    const data: Record<string, unknown> = { ...rest };
    if (rest.email) {
      data.email = rest.email.trim().toLowerCase();
    }
    if (password) {
      data.password = await this.passwordService.hash(password);
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...data,
        // Mọi thay đổi hồ sơ/quyền → vô hiệu token cũ ngay (WP4 4.4)
        tokenVersion: { increment: 1 },
      },
      select: USER_SELECT,
    });

    await this.redis.del(`lms:user:${id}`);
    return updated;
  }

  async updateRole(
    id: string,
    dto: UpdateUserRoleDto,
    actor: AuthenticatedUser,
  ) {
    if (actor.id === id) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Không thể tự thay đổi vai trò của chính mình.',
      );
    }

    const existing = await this.findActiveOrThrow(id);

    let targetRoleId = dto.roleId;
    let targetRoleCode = dto.role;

    if (targetRoleCode && !targetRoleId) {
      const roleRecord = await this.prisma.role.findUnique({
        where: { code: targetRoleCode },
      });
      if (!roleRecord) {
        throw new BusinessException(
          ErrorCode.BAD_REQUEST,
          `Vai trò ${targetRoleCode} không tồn tại.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      targetRoleId = roleRecord.id;
    } else if (targetRoleId && !targetRoleCode) {
      const roleRecord = await this.prisma.role.findUnique({
        where: { id: targetRoleId },
      });
      if (!roleRecord) {
        throw new BusinessException(
          ErrorCode.BAD_REQUEST,
          `Vai trò với ID ${targetRoleId} không tồn tại.`,
          HttpStatus.BAD_REQUEST,
        );
      }
      targetRoleCode = roleRecord.code;
    }

    if (!targetRoleId) {
      throw new BusinessException(
        ErrorCode.BAD_REQUEST,
        'Cần cung cấp roleId hoặc role.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (
      existing.role?.code === RoleCode.ADMIN &&
      targetRoleCode !== RoleCode.ADMIN
    ) {
      await this.ensureNotLastAdmin();
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        roleId: targetRoleId,
        tokenVersion: { increment: 1 },
      },
      select: USER_SELECT,
    });

    await this.redis.del(`lms:user:${id}`);
    this.logger.log(
      `Audit: actor=${actor.id} changed role of user=${id} to roleId=${targetRoleId}`,
    );
    return updated;
  }

  async updateStatus(
    id: string,
    dto: UpdateUserStatusDto,
    actor: AuthenticatedUser,
  ) {
    if (actor.id === id && !dto.isActive) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Không thể tự khóa tài khoản của chính mình.',
      );
    }

    const existing = await this.findActiveOrThrow(id);
    if (existing.role?.code === RoleCode.ADMIN && !dto.isActive) {
      await this.ensureNotLastAdmin();
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        isActive: dto.isActive,
        tokenVersion: { increment: 1 },
      },
      select: USER_SELECT,
    });

    await this.redis.del(`lms:user:${id}`);
    this.logger.log(
      `Audit: actor=${actor.id} changed status of user=${id} to isActive=${dto.isActive}`,
    );
    return updated;
  }

  async remove(id: string, actor: AuthenticatedUser) {
    if (actor.id === id) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Không thể tự xóa tài khoản của chính mình.',
      );
    }

    const existing = await this.findActiveOrThrow(id);
    if (existing.role?.code === RoleCode.ADMIN) {
      await this.ensureNotLastAdmin();
    }

    const removed = await this.prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
        tokenVersion: { increment: 1 },
      },
      select: USER_SELECT,
    });

    await this.redis.del(`lms:user:${id}`);
    this.logger.log(`Audit: actor=${actor.id} soft-deleted user=${id}`);
    return removed;
  }

  private async ensureNotLastAdmin(): Promise<void> {
    const activeAdminCount = await this.prisma.user.count({
      where: {
        deletedAt: null,
        isActive: true,
        role: { code: RoleCode.ADMIN },
      },
    });
    if (activeAdminCount <= 1) {
      throw new BusinessException(
        ErrorCode.UNPROCESSABLE_ENTITY,
        'Không thể hạ quyền hoặc khóa tài khoản ADMIN hoạt động cuối cùng của hệ thống.',
      );
    }
  }

  private async findActiveOrThrow(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: USER_SELECT,
    });
    if (!user) {
      throw this.notFound(id);
    }
    return user;
  }

  private notFound(id: string): BusinessException {
    return new BusinessException(
      ErrorCode.NOT_FOUND,
      `Không tìm thấy người dùng ${id}.`,
      HttpStatus.NOT_FOUND,
    );
  }
}
