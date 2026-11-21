import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service.js';
import { HrmSyncStatus, PositionLevel, RoleCode } from '../generated/prisma/enums.js';
import { HrmEmployeeItemDto, SyncHrmUsersDto } from './dto/sync-user.dto.js';
import { PositionMapper } from '../common/utils/position-mapper.util.js';

@Injectable()
export class HrmService {
  constructor(private readonly prisma: PrismaService) {}

  private resolvePositionLevel(position: string): PositionLevel {
    return PositionMapper.mapWithFallback(position, PositionLevel.FRESHER);
  }

  // Dữ liệu nhân sự giả lập từ hệ thống HRM của NovaTech Solutions
  private readonly mockHrmEmployees: HrmEmployeeItemDto[] = [
    {
      employeeCode: 'NV-2026-089',
      fullName: 'Lê Minh Trí',
      email: 'tri.le@novatech.com',
      position: 'Fresher Backend Java',
      department: 'Software Engineering',
      startDate: '2026-11-01',
    },
    {
      employeeCode: 'NV-2026-090',
      fullName: 'Phạm Thu Hà',
      email: 'ha.pham@novatech.com',
      position: 'Junior Frontend React',
      department: 'Software Engineering',
      startDate: '2026-11-01',
    },
    {
      employeeCode: 'NV-2026-091',
      fullName: 'Trần Quốc Bảo',
      email: 'bao.tran@novatech.com',
      position: 'Intern QA Engineer',
      department: 'Quality Assurance',
      startDate: '2026-11-05',
    },
  ];

  // Lấy danh sách nhân sự giả lập từ HRM
  getMockEmployees(department?: string) {
    const normalizedDept = department?.trim().toLowerCase();
    const filtered = normalizedDept
      ? this.mockHrmEmployees.filter(
          (emp) => emp.department.toLowerCase() === normalizedDept,
        )
      : this.mockHrmEmployees;

    return {
      statusCode: 200,
      message: 'Lấy danh sách nhân sự giả lập từ HRM thành công',
      mockEmployees: filtered,
      data: {
        total: filtered.length,
        mockEmployees: filtered,
      },
    };
  }

  // Kiểm tra tính hợp lệ của từng bản ghi nhân sự đầu vào
  private validateEmployeeItem(
    item: Partial<HrmEmployeeItemDto>,
    index: number,
  ): HrmEmployeeItemDto {
    const prefix = `Nhân sự tại vị trí #${index + 1}`;

    if (
      !item.employeeCode ||
      typeof item.employeeCode !== 'string' ||
      !item.employeeCode.trim()
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: `${prefix} thiếu mã nhân viên (employeeCode).`,
        errorCode: 'BAD_REQUEST',
      });
    }

    if (
      !item.fullName ||
      typeof item.fullName !== 'string' ||
      !item.fullName.trim()
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: `${prefix} thiếu họ và tên (fullName).`,
        errorCode: 'BAD_REQUEST',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (
      !item.email ||
      typeof item.email !== 'string' ||
      !emailRegex.test(item.email.trim())
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: `${prefix} có địa chỉ email không hợp lệ.`,
        errorCode: 'BAD_REQUEST',
      });
    }

    if (
      !item.position ||
      typeof item.position !== 'string' ||
      !item.position.trim()
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: `${prefix} thiếu vị trí công việc (position).`,
        errorCode: 'BAD_REQUEST',
      });
    }

    if (
      !item.department ||
      typeof item.department !== 'string' ||
      !item.department.trim()
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: `${prefix} thiếu thông tin phòng ban (department).`,
        errorCode: 'BAD_REQUEST',
      });
    }

    return {
      employeeCode: item.employeeCode.trim(),
      fullName: item.fullName.trim(),
      email: item.email.trim().toLowerCase(),
      position: item.position.trim(),
      department: item.department.trim(),
      startDate: item.startDate?.trim(),
    };
  }

  // Đồng bộ nhân sự mới từ HRM vào bảng User của LMS và gán lộ trình Onboarding 30 ngày
  async syncUsers(payload: SyncHrmUsersDto) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Dữ liệu đầu vào không hợp lệ: Body không được để trống.',
        errorCode: 'BAD_REQUEST',
      });
    }

    let rawItems: Partial<HrmEmployeeItemDto>[] = [];

    if (Array.isArray(payload.employees)) {
      if (payload.employees.length === 0) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Danh sách employees không được rỗng.',
          errorCode: 'BAD_REQUEST',
        });
      }
      rawItems = payload.employees;
    } else if (
      payload.email !== undefined ||
      payload.fullName !== undefined ||
      payload.employeeCode !== undefined
    ) {
      rawItems = [
        {
          employeeCode: payload.employeeCode,
          fullName: payload.fullName,
          email: payload.email,
          position: payload.position,
          department: payload.department,
          startDate: payload.startDate,
        },
      ];
    } else {
      throw new BadRequestException({
        statusCode: 400,
        message:
          'Dữ liệu đầu vào không hợp lệ: Cần cung cấp thông tin nhân sự hoặc mảng employees.',
        errorCode: 'BAD_REQUEST',
      });
    }

    const validatedItems = rawItems.map((item, idx) =>
      this.validateEmployeeItem(item, idx),
    );

    const syncedResults = [];
    const defaultHashedPassword = await bcrypt.hash(
      process.env.SEED_DEMO_PASSWORD || 'Password123!',
      10,
    );

    for (const emp of validatedItems) {
      try {
        const mappedPosition = this.resolvePositionLevel(emp.position);
        const startDate = emp.startDate ? new Date(emp.startDate) : null;

        const upsertedUser = await this.prisma.user.upsert({
          where: { email: emp.email },
          update: {
            fullName: emp.fullName,
            department: emp.department,
            employeeCode: emp.employeeCode,
            jobTitle: emp.position,
            position: mappedPosition,
            startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined,
          },
          create: {
            email: emp.email,
            password: defaultHashedPassword,
            fullName: emp.fullName,
            department: emp.department,
            employeeCode: emp.employeeCode,
            jobTitle: emp.position,
            position: mappedPosition,
            startDate: startDate && !Number.isNaN(startDate.getTime()) ? startDate : undefined,
            mustChangePassword: true,
            role: {
              connectOrCreate: {
                where: { code: RoleCode.EMPLOYEE },
                create: { code: RoleCode.EMPLOYEE },
              },
            },
          },
        });

        const pathCodeByPosition: Record<PositionLevel, string> = {
          INTERN: 'path-intern',
          FRESHER: 'path-fresher-java',
          JUNIOR: 'path-junior',
          SENIOR: 'path-senior',
          LEAD: 'path-lead',
        };
        const pathCode = pathCodeByPosition[mappedPosition];
        const learningPath = await this.prisma.learningPath.findUnique({ where: { code: pathCode } });
        let assignedPathId: string | null = null;

        if (learningPath) {
          const effectiveStart = startDate && !Number.isNaN(startDate.getTime()) ? startDate : new Date();
          const deadline = new Date(effectiveStart);
          deadline.setDate(deadline.getDate() + learningPath.estimatedDays);

          await this.prisma.pathEnrollment.upsert({
            where: { userId_pathId: { userId: upsertedUser.id, pathId: learningPath.id } },
            update: { deadline, source: 'AUTO_ONBOARDING' },
            create: {
              userId: upsertedUser.id,
              pathId: learningPath.id,
              deadline,
              source: 'AUTO_ONBOARDING',
            },
          });
          assignedPathId = learningPath.id;
        }

        await this.prisma.hrmSyncLog.create({
          data: {
            employeeCode: emp.employeeCode,
            email: emp.email,
            payload: emp as never,
            status: HrmSyncStatus.INITIATED,
            message: assignedPathId ? 'Đồng bộ thành công và đã gán lộ trình.' : 'Đồng bộ tài khoản thành công; chưa tìm thấy lộ trình phù hợp.',
            userId: upsertedUser.id,
            assignedPathId,
          },
        });

        syncedResults.push({
          userId: String(upsertedUser.id),
          employeeCode: emp.employeeCode,
          fullName: upsertedUser.fullName,
          email: upsertedUser.email,
          position: emp.position,
          department: emp.department,
          assignedPathId,
          status: 'INITIATED',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Đồng bộ thất bại.';
        await this.prisma.hrmSyncLog.create({
          data: {
            employeeCode: emp.employeeCode,
            email: emp.email,
            payload: emp as never,
            status: HrmSyncStatus.FAILED,
            message,
          },
        });
        syncedResults.push({
          employeeCode: emp.employeeCode,
          fullName: emp.fullName,
          email: emp.email,
          position: emp.position,
          department: emp.department,
          assignedPathId: null,
          status: 'FAILED',
          message,
        });
      }
    }

    const successCount = syncedResults.filter((item) => item.status === 'INITIATED').length;
    return {
      statusCode: 201,
      message: `Đã xử lý ${syncedResults.length} nhân sự; thành công ${successCount}.`,
      syncedCount: successCount,
      failedCount: syncedResults.length - successCount,
      data: { syncedUsers: syncedResults },
    };
  }

  async getSyncHistory(query: { page?: string; limit?: string; status?: string; search?: string }) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20) || 20));
    const skip = (page - 1) * limit;

    const statusValue = Object.values(HrmSyncStatus).includes(query.status as HrmSyncStatus)
      ? (query.status as HrmSyncStatus)
      : undefined;

    const where = {
      ...(statusValue ? { status: statusValue } : {}),
      ...(query.search?.trim()
        ? {
            OR: [
              { employeeCode: { contains: query.search.trim(), mode: 'insensitive' as const } },
              { email: { contains: query.search.trim(), mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.hrmSyncLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.hrmSyncLog.count({ where }),
    ]);

    return {
      data: items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSyncHistoryDetail(id: string) {
    const item = await this.prisma.hrmSyncLog.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy bản ghi lịch sử đồng bộ HRM.');
    return item;
  }
}
