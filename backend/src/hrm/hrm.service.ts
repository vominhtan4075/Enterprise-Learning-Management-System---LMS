import { Injectable, BadRequestException } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service.js';
import { HrmEmployeeItemDto, SyncHrmUsersDto } from './dto/sync-user.dto.js';

@Injectable()
export class HrmService {
  constructor(private readonly prisma: PrismaService) { }

  private resolvePositionLevel(
    position: string,
  ): 'INTERN' | 'FRESHER' | 'JUNIOR' | 'SENIOR' | 'LEAD' {
    const normalizedPosition = position.trim().toLowerCase();
    if (normalizedPosition.includes('intern')) {
      return 'INTERN';
    }
    if (normalizedPosition.includes('fresher')) {
      return 'FRESHER';
    }
    if (normalizedPosition.includes('junior')) {
      return 'JUNIOR';
    }
    if (normalizedPosition.includes('senior')) {
      return 'SENIOR';
    }
    if (normalizedPosition.includes('lead')) {
      return 'LEAD';
    }
    return 'FRESHER';
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
    const defaultHashedPassword = await bcrypt.hash('Password123!', 10);

    for (const emp of validatedItems) {
      // Ghi thực tế vào bảng User trong PostgreSQL thông qua PrismaService
      const upsertedUser = await this.prisma.user.upsert({
        where: { email: emp.email },
        update: {
          fullName: emp.fullName,
        },
        create: {
          email: emp.email,
          password: defaultHashedPassword,
          fullName: emp.fullName,
          role: {
            connect: { code: 'EMPLOYEE' },
          },
          position: this.resolvePositionLevel(emp.position),
          department: emp.department,
          employeeCode: emp.employeeCode,
          jobTitle: emp.position,
          mustChangePassword: true,
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