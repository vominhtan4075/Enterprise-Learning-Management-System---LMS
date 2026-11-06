import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service.js';
import { PositionLevel, RoleCode } from '../generated/prisma/enums.js';
import { HrmEmployeeItemDto, SyncHrmUsersDto } from './dto/sync-user.dto.js';

@Injectable()
export class HrmService {
  constructor(private readonly prisma: PrismaService) {}

  private mapPositionLevel(rawPosition: string): PositionLevel {
    const normalized = rawPosition.toLowerCase();
    if (normalized.includes('intern')) return PositionLevel.INTERN;
    if (normalized.includes('fresher')) return PositionLevel.FRESHER;
    if (normalized.includes('junior')) return PositionLevel.JUNIOR;
    if (normalized.includes('senior')) return PositionLevel.SENIOR;
    if (normalized.includes('lead')) return PositionLevel.LEAD;
    return PositionLevel.FRESHER;
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

    for (const emp of validatedItems) {
      const mappedPosition = this.mapPositionLevel(emp.position);

      // Ghi thực tế vào bảng User trong PostgreSQL thông qua PrismaService
      const upsertedUser = await this.prisma.user.upsert({
        where: { email: emp.email },
        update: {
          fullName: emp.fullName,
          employeeCode: emp.employeeCode,
          department: emp.department,
          jobTitle: emp.position,
          position: mappedPosition,
        },
        create: {
          email: emp.email,
          fullName: emp.fullName,
          password: 'HRM_TEMP_PASSWORD_HASH',
          employeeCode: emp.employeeCode,
          department: emp.department,
          jobTitle: emp.position,
          position: mappedPosition,
          mustChangePassword: true,
          role: {
            connectOrCreate: {
              where: { code: RoleCode.EMPLOYEE },
              create: { code: RoleCode.EMPLOYEE },
            },
          },
        },
      });

      syncedResults.push({
        userId: String(upsertedUser.id),
        employeeCode: emp.employeeCode,
        fullName: upsertedUser.fullName,
        email: upsertedUser.email,
        position: emp.position,
        department: emp.department,
        assignedPathId: 'path-onboarding-java-30days',
        status: 'INITIATED',
      });
    }

    const primarySynced = syncedResults[0];

    return {
      statusCode: 201,
      message:
        'Đã đồng bộ nhân sự mới và tự động gán Lộ trình Onboarding 30 ngày.',
      syncedCount: syncedResults.length,
      data: {
        userId: primarySynced.userId,
        assignedPathId: 'path-onboarding-java-30days',
        status: 'INITIATED',
        syncedUsers: syncedResults,
      },
    };
  }
}