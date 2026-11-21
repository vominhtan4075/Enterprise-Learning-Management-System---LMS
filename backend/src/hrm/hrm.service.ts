import { BadRequestException, Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';
import { PositionMapper } from '../common/utils/position-mapper.util.js';
import {
  EnrollmentSource,
  HrmSyncStatus,
  PositionLevel,
  RoleCode,
} from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma.service.js';
import { HrmEmployeeItemDto, HrmEmploymentStatus, SyncHrmUsersDto } from './dto/sync-user.dto.js';

export type HrmSyncAction =
  | 'CREATED'
  | 'UPDATED'
  | 'POSITION_CHANGED'
  | 'DEACTIVATED'
  | 'SKIPPED';

export interface HrmSyncedUserResult {
  userId: string | null;
  employeeCode: string;
  fullName: string;
  email: string;
  position: string;
  positionLevel: PositionLevel;
  previousPosition: PositionLevel | null;
  department: string;
  employmentStatus: HrmEmploymentStatus;
  isActive: boolean;
  action: HrmSyncAction;
  assignedPathId: string | null;
  status: HrmSyncStatus;
  message: string;
}

interface ValidatedHrmEmployee {
  employeeCode: string;
  fullName: string;
  email: string;
  position: string;
  department: string;
  startDate?: string;
  parsedStartDate?: Date;
  employmentStatus: HrmEmploymentStatus;
}

interface ExistingUserSnapshot {
  id: string;
  position: PositionLevel;
  jobTitle: string | null;
}

export interface SyncSummary {
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  positionChangedCount: number;
  deactivatedCount: number;
  skippedCount: number;
}

const DEFAULT_ONBOARDING_PATH_ID = 'path-onboarding-java-30days';
const DEFAULT_ONBOARDING_DAYS = 30;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Injectable()
export class HrmService {
  constructor(private readonly prisma: PrismaService) {}

  // Dữ liệu nhân sự giả lập từ hệ thống HRM của NovaTech Solutions
  // Bao gồm nhân sự mới, nhân sự thay đổi chức danh và nhân sự nghỉ việc
  private readonly mockHrmEmployees: HrmEmployeeItemDto[] = [
    {
      employeeCode: 'NV-2026-089',
      fullName: 'Lê Minh Trí',
      email: 'tri.le@novatech.com',
      position: 'Fresher Backend Java',
      department: 'Software Engineering',
      startDate: '2026-11-01',
      employmentStatus: HrmEmploymentStatus.ACTIVE,
    },
    {
      employeeCode: 'NV-2026-090',
      fullName: 'Phạm Thu Hà',
      email: 'ha.pham@novatech.com',
      position: 'Junior Frontend React',
      department: 'Software Engineering',
      startDate: '2026-11-01',
      employmentStatus: HrmEmploymentStatus.ACTIVE,
    },
    {
      employeeCode: 'NV-2026-091',
      fullName: 'Trần Quốc Bảo',
      email: 'bao.tran@novatech.com',
      position: 'Intern QA Engineer',
      department: 'Quality Assurance',
      startDate: '2026-11-05',
      employmentStatus: HrmEmploymentStatus.ACTIVE,
    },
    {
      employeeCode: 'NV-2026-092',
      fullName: 'Đỗ Quang Minh',
      email: 'minh.do@novatech.com',
      position: 'Senior Backend Java',
      department: 'Software Engineering',
      startDate: '2026-06-01',
      employmentStatus: HrmEmploymentStatus.ACTIVE,
    },
    {
      employeeCode: 'NV-2026-093',
      fullName: 'Vũ Hải Yến',
      email: 'yen.vu@novatech.com',
      position: 'Fresher QA Engineer',
      department: 'Quality Assurance',
      startDate: '2026-04-15',
      employmentStatus: HrmEmploymentStatus.RESIGNED,
    },
  ];

  // Lấy danh sách nhân sự giả lập từ HRM (hỗ trợ lọc theo phòng ban và trạng thái)
  getMockEmployees(department?: string, status?: string) {
    const normalizedDept = department?.trim().toLowerCase();
    const normalizedStatus = status?.trim().toUpperCase();

    if (
      normalizedStatus &&
      normalizedStatus !== HrmEmploymentStatus.ACTIVE &&
      normalizedStatus !== HrmEmploymentStatus.RESIGNED
    ) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Trạng thái lọc (status) không hợp lệ. Chỉ chấp nhận ACTIVE hoặc RESIGNED.',
        errorCode: 'BAD_REQUEST',
      });
    }

    const filtered = this.mockHrmEmployees.filter((emp) => {
      const deptMatch = normalizedDept
        ? emp.department.toLowerCase() === normalizedDept
        : true;
      const empStatus = emp.employmentStatus ?? HrmEmploymentStatus.ACTIVE;
      const statusMatch = normalizedStatus ? empStatus === normalizedStatus : true;
      return deptMatch && statusMatch;
    });

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

  // Đồng bộ nhân sự từ HRM: tạo mới, cập nhật thay đổi chức danh, vô hiệu hóa tài khoản nghỉ việc và ghi hrm_sync_logs
  async syncUsers(payload: SyncHrmUsersDto) {
    const rawItems = this.extractEmployeeItems(payload);
    const validatedItems = rawItems.map((item, idx) => this.validateEmployeeItem(item, idx));

    const defaultHashedPassword = await bcrypt.hash(
      process.env.SEED_DEMO_PASSWORD || 'Password123!',
      10,
    );

    const syncedResults: HrmSyncedUserResult[] = [];
    const summary: SyncSummary = {
      totalProcessed: validatedItems.length,
      createdCount: 0,
      updatedCount: 0,
      positionChangedCount: 0,
      deactivatedCount: 0,
      skippedCount: 0,
    };

    for (const emp of validatedItems) {
      const mappedPosition = this.resolvePositionLevel(emp.position);
      const existingUser = await this.prisma.user.findUnique({
        where: { email: emp.email },
      });

      if (emp.employmentStatus === HrmEmploymentStatus.RESIGNED) {
        const result = await this.handleResignedEmployee(emp, mappedPosition, existingUser, summary);
        syncedResults.push(result);
        continue;
      }

      const safeEmployeeCode = await this.resolveSafeEmployeeCode(emp.employeeCode, existingUser?.id);

      if (existingUser) {
        const result = await this.handleExistingEmployee(
          emp,
          mappedPosition,
          existingUser,
          safeEmployeeCode,
          summary,
        );
        syncedResults.push(result);
        continue;
      }

      const result = await this.handleNewEmployee(
        emp,
        mappedPosition,
        safeEmployeeCode,
        defaultHashedPassword,
        summary,
      );
      syncedResults.push(result);
    }

    const primarySynced = syncedResults[0];

    return {
      statusCode: 201,
      message:
        syncedResults.length === 1
          ? primarySynced.message
          : 'Đã đồng bộ danh sách nhân sự từ HRM và ghi vết lịch sử đồng bộ.',
      syncedCount: syncedResults.length,
      data: {
        userId: primarySynced.userId,
        assignedPathId: primarySynced.assignedPathId,
        status: primarySynced.status,
        action: primarySynced.action,
        isActive: primarySynced.isActive,
        previousPosition: primarySynced.previousPosition,
        currentPosition: primarySynced.positionLevel,
        summary,
        syncedUsers: syncedResults,
      },
    };
  }

  private resolvePositionLevel(position: string): PositionLevel {
    return PositionMapper.mapWithFallback(position, PositionLevel.FRESHER);
  }

  private extractEmployeeItems(payload: SyncHrmUsersDto): Partial<HrmEmployeeItemDto>[] {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Dữ liệu đầu vào không hợp lệ: Body không được để trống.',
        errorCode: 'BAD_REQUEST',
      });
    }

    if (Array.isArray(payload.employees)) {
      if (payload.employees.length === 0) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Danh sách employees không được rỗng.',
          errorCode: 'BAD_REQUEST',
        });
      }
      return payload.employees;
    }

    if (
      payload.email !== undefined ||
      payload.fullName !== undefined ||
      payload.employeeCode !== undefined
    ) {
      return [
        {
          employeeCode: payload.employeeCode,
          fullName: payload.fullName,
          email: payload.email,
          position: payload.position,
          department: payload.department,
          startDate: payload.startDate,
          employmentStatus: payload.employmentStatus,
        },
      ];
    }

    throw new BadRequestException({
      statusCode: 400,
      message: 'Dữ liệu đầu vào không hợp lệ: Cần cung cấp thông tin nhân sự hoặc mảng employees.',
      errorCode: 'BAD_REQUEST',
    });
  }

  private validateEmployeeItem(
    item: Partial<HrmEmployeeItemDto>,
    index: number,
  ): ValidatedHrmEmployee {
    const prefix = `Nhân sự tại vị trí #${index + 1}`;

    if (!item.employeeCode || typeof item.employeeCode !== 'string' || !item.employeeCode.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        message: `${prefix} thiếu mã nhân viên (employeeCode).`,
        errorCode: 'BAD_REQUEST',
      });
    }

    if (!item.fullName || typeof item.fullName !== 'string' || !item.fullName.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        message: `${prefix} thiếu họ và tên (fullName).`,
        errorCode: 'BAD_REQUEST',
      });
    }

    if (!item.email || typeof item.email !== 'string' || !EMAIL_REGEX.test(item.email.trim())) {
      throw new BadRequestException({
        statusCode: 400,
        message: `${prefix} có địa chỉ email không hợp lệ.`,
        errorCode: 'BAD_REQUEST',
      });
    }

    if (!item.position || typeof item.position !== 'string' || !item.position.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        message: `${prefix} thiếu vị trí công việc (position).`,
        errorCode: 'BAD_REQUEST',
      });
    }

    if (!item.department || typeof item.department !== 'string' || !item.department.trim()) {
      throw new BadRequestException({
        statusCode: 400,
        message: `${prefix} thiếu thông tin phòng ban (department).`,
        errorCode: 'BAD_REQUEST',
      });
    }

    let employmentStatus = HrmEmploymentStatus.ACTIVE;
    if (item.employmentStatus !== undefined && item.employmentStatus !== null) {
      if (typeof item.employmentStatus !== 'string') {
        throw new BadRequestException({
          statusCode: 400,
          message: `${prefix} có trạng thái làm việc (employmentStatus) không hợp lệ.`,
          errorCode: 'BAD_REQUEST',
        });
      }

      const normalized = item.employmentStatus.trim().toUpperCase();
      if (
        normalized !== HrmEmploymentStatus.ACTIVE &&
        normalized !== HrmEmploymentStatus.RESIGNED
      ) {
        throw new BadRequestException({
          statusCode: 400,
          message: `${prefix} có employmentStatus không hợp lệ (chỉ chấp nhận ACTIVE hoặc RESIGNED).`,
          errorCode: 'BAD_REQUEST',
        });
      }
      employmentStatus = normalized as HrmEmploymentStatus;
    }

    let parsedStartDate: Date | undefined;
    const trimmedStartDate = item.startDate?.trim();
    if (trimmedStartDate) {
      const candidate = new Date(trimmedStartDate);
      if (Number.isNaN(candidate.getTime())) {
        throw new BadRequestException({
          statusCode: 400,
          message: `${prefix} có định dạng startDate không hợp lệ.`,
          errorCode: 'BAD_REQUEST',
        });
      }
      parsedStartDate = candidate;
    }

    return {
      employeeCode: item.employeeCode.trim(),
      fullName: item.fullName.trim(),
      email: item.email.trim().toLowerCase(),
      position: item.position.trim(),
      department: item.department.trim(),
      startDate: trimmedStartDate,
      parsedStartDate,
      employmentStatus,
    };
  }

  private async resolveSafeEmployeeCode(
    employeeCode: string,
    currentUserId?: string,
  ): Promise<string | undefined> {
    const existingByCode = await this.prisma.user.findUnique({
      where: { employeeCode },
    });

    if (!existingByCode || existingByCode.id === currentUserId) {
      return employeeCode;
    }
    return undefined;
  }

  // Tình huống 1: Tài khoản nghỉ việc (RESIGNED)
  private async handleResignedEmployee(
    emp: ValidatedHrmEmployee,
    mappedPosition: PositionLevel,
    existingUser: ExistingUserSnapshot | null,
    summary: SyncSummary,
  ): Promise<HrmSyncedUserResult> {
    if (!existingUser) {
      summary.skippedCount += 1;
      const skipMessage = 'Bỏ qua tài khoản nghỉ việc vì email chưa tồn tại trên hệ thống LMS.';

      await this.writeSyncLog({
        emp,
        status: HrmSyncStatus.SKIPPED,
        message: skipMessage,
        userId: null,
        assignedPathId: null,
      });

      return {
        userId: null,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        email: emp.email,
        position: emp.position,
        positionLevel: mappedPosition,
        previousPosition: null,
        department: emp.department,
        employmentStatus: emp.employmentStatus,
        isActive: false,
        action: 'SKIPPED',
        assignedPathId: null,
        status: HrmSyncStatus.SKIPPED,
        message: skipMessage,
      };
    }

    const deactivatedUser = await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        fullName: emp.fullName,
        department: emp.department,
        jobTitle: emp.position,
        position: mappedPosition,
        isActive: false,
        tokenVersion: { increment: 1 },
      },
    });

    summary.deactivatedCount += 1;
    const deactivatedMessage =
      'Đã vô hiệu hóa tài khoản nhân sự nghỉ việc và thu hồi phiên đăng nhập.';

    await this.writeSyncLog({
      emp,
      status: HrmSyncStatus.INITIATED,
      message: deactivatedMessage,
      userId: String(deactivatedUser.id),
      assignedPathId: null,
    });

    return {
      userId: String(deactivatedUser.id),
      employeeCode: emp.employeeCode,
      fullName: deactivatedUser.fullName,
      email: deactivatedUser.email,
      position: emp.position,
      positionLevel: mappedPosition,
      previousPosition: existingUser.position,
      department: emp.department,
      employmentStatus: emp.employmentStatus,
      isActive: false,
      action: 'DEACTIVATED',
      assignedPathId: null,
      status: HrmSyncStatus.INITIATED,
      message: deactivatedMessage,
    };
  }

  // Tình huống 2: Nhân sự đã tồn tại -> cập nhật thông tin / thay đổi chức danh
  private async handleExistingEmployee(
    emp: ValidatedHrmEmployee,
    mappedPosition: PositionLevel,
    existingUser: ExistingUserSnapshot,
    safeEmployeeCode: string | undefined,
    summary: SyncSummary,
  ): Promise<HrmSyncedUserResult> {
    const positionChanged =
      existingUser.position !== mappedPosition || (existingUser.jobTitle ?? '') !== emp.position;

    const updatedUser = await this.prisma.user.update({
      where: { id: existingUser.id },
      data: {
        fullName: emp.fullName,
        department: emp.department,
        jobTitle: emp.position,
        position: mappedPosition,
        isActive: true,
        ...(safeEmployeeCode ? { employeeCode: safeEmployeeCode } : {}),
        ...(emp.parsedStartDate ? { startDate: emp.parsedStartDate } : {}),
      },
    });

    const assignedPathId = await this.assignPathForPosition(String(updatedUser.id), mappedPosition);
    const action: HrmSyncAction = positionChanged ? 'POSITION_CHANGED' : 'UPDATED';

    summary.updatedCount += 1;
    if (positionChanged) {
      summary.positionChangedCount += 1;
    }

    const logMessage = positionChanged
      ? `Đã cập nhật thay đổi chức danh từ ${existingUser.position} sang ${mappedPosition} và gán lộ trình tương ứng.`
      : 'Đã cập nhật thông tin nhân sự hiện có từ HRM.';

    await this.writeSyncLog({
      emp,
      status: HrmSyncStatus.INITIATED,
      message: logMessage,
      userId: String(updatedUser.id),
      assignedPathId,
    });

    return {
      userId: String(updatedUser.id),
      employeeCode: emp.employeeCode,
      fullName: updatedUser.fullName,
      email: updatedUser.email,
      position: emp.position,
      positionLevel: mappedPosition,
      previousPosition: existingUser.position,
      department: emp.department,
      employmentStatus: emp.employmentStatus,
      isActive: true,
      action,
      assignedPathId,
      status: HrmSyncStatus.INITIATED,
      message: logMessage,
    };
  }

  // Tình huống 3: Nhân sự mới gia nhập -> tạo tài khoản và tự động gán lộ trình
  private async handleNewEmployee(
    emp: ValidatedHrmEmployee,
    mappedPosition: PositionLevel,
    safeEmployeeCode: string | undefined,
    defaultHashedPassword: string,
    summary: SyncSummary,
  ): Promise<HrmSyncedUserResult> {
    const createdUser = await this.prisma.user.create({
      data: {
        email: emp.email,
        password: defaultHashedPassword,
        fullName: emp.fullName,
        department: emp.department,
        jobTitle: emp.position,
        position: mappedPosition,
        isActive: true,
        mustChangePassword: true,
        ...(safeEmployeeCode ? { employeeCode: safeEmployeeCode } : {}),
        ...(emp.parsedStartDate ? { startDate: emp.parsedStartDate } : {}),
        role: {
          connectOrCreate: {
            where: { code: RoleCode.EMPLOYEE },
            create: { code: RoleCode.EMPLOYEE },
          },
        },
      },
    });

    const assignedPathId = await this.assignPathForPosition(String(createdUser.id), mappedPosition);
    summary.createdCount += 1;
    const createdMessage = 'Đã đồng bộ nhân sự mới và tự động gán Lộ trình Onboarding 30 ngày.';

    await this.writeSyncLog({
      emp,
      status: HrmSyncStatus.INITIATED,
      message: createdMessage,
      userId: String(createdUser.id),
      assignedPathId,
    });

    return {
      userId: String(createdUser.id),
      employeeCode: emp.employeeCode,
      fullName: createdUser.fullName,
      email: createdUser.email,
      position: emp.position,
      positionLevel: mappedPosition,
      previousPosition: null,
      department: emp.department,
      employmentStatus: emp.employmentStatus,
      isActive: true,
      action: 'CREATED',
      assignedPathId,
      status: HrmSyncStatus.INITIATED,
      message: createdMessage,
    };
  }

  private async assignPathForPosition(
    userId: string,
    targetPosition: PositionLevel,
  ): Promise<string> {
    const matchedPath = await this.prisma.learningPath.findFirst({
      where: { targetPosition, archivedAt: null },
      orderBy: [{ isMandatory: 'desc' }, { createdAt: 'asc' }],
    });

    if (!matchedPath) {
      return targetPosition === PositionLevel.FRESHER
        ? DEFAULT_ONBOARDING_PATH_ID
        : `path-${targetPosition.toLowerCase()}`;
    }

    const days =
      matchedPath.estimatedDays > 0 ? matchedPath.estimatedDays : DEFAULT_ONBOARDING_DAYS;
    const deadline = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.pathEnrollment.upsert({
      where: {
        userId_pathId: { userId, pathId: matchedPath.id },
      },
      update: {},
      create: {
        userId,
        pathId: matchedPath.id,
        deadline,
        source: EnrollmentSource.HRM,
      },
    });

    return targetPosition === PositionLevel.FRESHER ? DEFAULT_ONBOARDING_PATH_ID : matchedPath.code;
  }

  private async writeSyncLog(params: {
    emp: ValidatedHrmEmployee;
    status: HrmSyncStatus;
    message: string;
    userId: string | null;
    assignedPathId: string | null;
  }) {
    await this.prisma.hrmSyncLog.create({
      data: {
        employeeCode: params.emp.employeeCode,
        email: params.emp.email,
        payload: {
          employeeCode: params.emp.employeeCode,
          fullName: params.emp.fullName,
          email: params.emp.email,
          position: params.emp.position,
          department: params.emp.department,
          startDate: params.emp.startDate ?? null,
          employmentStatus: params.emp.employmentStatus,
        },
        status: params.status,
        message: params.message,
        userId: params.userId,
        assignedPathId: params.assignedPathId,
      },
    });
  }
}