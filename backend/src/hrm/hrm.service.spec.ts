import { PositionLevel } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma.service.js';
import { HrmEmploymentStatus } from './dto/sync-user.dto.js';
import { HrmService } from './hrm.service.js';

interface MockUserRecord {
  id: string;
  email: string;
  fullName: string;
  department: string | null;
  jobTitle: string | null;
  position: PositionLevel;
  employeeCode: string | null;
  isActive: boolean;
  tokenVersion: number;
}

interface MockSyncLogRecord {
  employeeCode: string;
  email: string;
  status: string;
  message: string | null;
  userId: string | null;
  assignedPathId: string | null;
}

interface MockPathEnrollmentUpsert {
  where: { userId_pathId: { userId: string; pathId: string } };
  create: Record<string, unknown>;
}

describe('HrmService (Mock HRM Integration)', () => {
  let service: HrmService;
  let usersStore: MockUserRecord[];
  let syncLogsStore: MockSyncLogRecord[];
  let pathEnrollmentUpserts: MockPathEnrollmentUpsert[];
  let idCounter: number;

  const mockLearningPaths = [
    {
      id: 'lp-fresher-1',
      code: 'path-fresher-java',
      targetPosition: PositionLevel.FRESHER,
      isMandatory: true,
      estimatedDays: 30,
      archivedAt: null,
    },
    {
      id: 'lp-junior-1',
      code: 'path-junior-fullstack',
      targetPosition: PositionLevel.JUNIOR,
      isMandatory: true,
      estimatedDays: 45,
      archivedAt: null,
    },
    {
      id: 'lp-senior-1',
      code: 'path-senior-architect',
      targetPosition: PositionLevel.SENIOR,
      isMandatory: true,
      estimatedDays: 60,
      archivedAt: null,
    },
  ];

  const createMockPrisma = () => ({
    user: {
      findUnique: ({ where }: { where: { email?: string; employeeCode?: string } }) => {
        if (where.email) {
          const found = usersStore.find((u) => u.email === where.email);
          return Promise.resolve(found ? { ...found } : null);
        }
        if (where.employeeCode) {
          const found = usersStore.find((u) => u.employeeCode === where.employeeCode);
          return Promise.resolve(found ? { ...found } : null);
        }
        return Promise.resolve(null);
      },

      create: ({ data }: { data: Record<string, unknown> }) => {
        idCounter += 1;
        const created: MockUserRecord = {
          id: `u-mock-${idCounter}`,
          email: String(data.email),
          fullName: String(data.fullName),
          department: (data.department as string) ?? null,
          jobTitle: (data.jobTitle as string) ?? null,
          position: data.position as PositionLevel,
          employeeCode: (data.employeeCode as string) ?? null,
          isActive: data.isActive !== false,
          tokenVersion: 0,
        };
        usersStore.push(created);
        return Promise.resolve(created);
      },

      update: ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const target = usersStore.find((u) => u.id === where.id);
        if (!target) {
          return Promise.reject(new Error('User not found'));
        }

        if (data.fullName !== undefined) {
          target.fullName = String(data.fullName);
        }
        if (data.department !== undefined) {
          target.department = String(data.department);
        }
        if (data.jobTitle !== undefined) {
          target.jobTitle = String(data.jobTitle);
        }
        if (data.position !== undefined) {
          target.position = data.position as PositionLevel;
        }
        if (data.employeeCode !== undefined) {
          target.employeeCode = String(data.employeeCode);
        }
        if (data.isActive !== undefined) {
          target.isActive = Boolean(data.isActive);
        }
        if (
          data.tokenVersion &&
          typeof data.tokenVersion === 'object' &&
          'increment' in data.tokenVersion
        ) {
          target.tokenVersion += Number((data.tokenVersion as { increment: number }).increment);
        }

        return Promise.resolve({ ...target });
      },
    },

    learningPath: {
      findFirst: ({ where }: { where: { targetPosition: PositionLevel; archivedAt: null } }) =>
        Promise.resolve(
          mockLearningPaths.find((lp) => lp.targetPosition === where.targetPosition) ?? null,
        ),
    },

    pathEnrollment: {
      upsert: (args: MockPathEnrollmentUpsert) => {
        pathEnrollmentUpserts.push(args);
        return Promise.resolve({ id: `pe-${pathEnrollmentUpserts.length}` });
      },
    },

    hrmSyncLog: {
      create: ({ data }: { data: MockSyncLogRecord }) => {
        syncLogsStore.push(data);
        return Promise.resolve({ id: `log-${syncLogsStore.length}`, ...data });
      },
    },
  });

  beforeEach(() => {
    usersStore = [];
    syncLogsStore = [];
    pathEnrollmentUpserts = [];
    idCounter = 100;
    service = new HrmService(createMockPrisma() as unknown as PrismaService);
  });

  it('Nên trả về danh sách nhân viên giả lập từ HRM và lọc đúng theo phòng ban, trạng thái', () => {
    const allResult = service.getMockEmployees();
    expect(allResult.statusCode).toBe(200);
    expect(allResult.data.mockEmployees.length).toBe(5);

    const qaResult = service.getMockEmployees('Quality Assurance');
    expect(qaResult.statusCode).toBe(200);
    expect(qaResult.data.mockEmployees.length).toBe(2);

    const resignedResult = service.getMockEmployees(undefined, HrmEmploymentStatus.RESIGNED);
    expect(resignedResult.statusCode).toBe(200);
    expect(resignedResult.data.mockEmployees.length).toBe(1);
    expect(resignedResult.data.mockEmployees[0].employeeCode).toBe('NV-2026-093');
  });

  it('Nên đồng bộ nhân sự mới vào DB, gán lộ trình và ghi log hrm_sync_logs đúng API Contract v1.0.0', async () => {
    const result = await service.syncUsers({
      employeeCode: 'NV-2026-089',
      fullName: 'Lê Minh Trí',
      email: 'tri.le@novatech.com',
      position: 'Fresher Backend Java',
      department: 'Software Engineering',
      startDate: '2026-11-01',
    });

    expect(result.statusCode).toBe(201);
    expect(result.syncedCount).toBe(1);
    expect(result.data.userId).toBe('u-mock-101');
    expect(result.data.assignedPathId).toBe('path-onboarding-java-30days');
    expect(result.data.status).toBe('INITIATED');
    expect(result.data.action).toBe('CREATED');
    expect(result.data.isActive).toBe(true);

    expect(usersStore.length).toBe(1);
    expect(usersStore[0].fullName).toBe('Lê Minh Trí');
    expect(usersStore[0].position).toBe(PositionLevel.FRESHER);
    expect(pathEnrollmentUpserts.length).toBe(1);
    expect(syncLogsStore.length).toBe(1);
    expect(syncLogsStore[0].status).toBe('INITIATED');
  });

  it('Nên xử lý tình huống thay đổi chức danh (Fresher -> Junior), gán lộ trình mới và ghi log', async () => {
    usersStore.push({
      id: 'u-existing-1',
      email: 'tri.le@novatech.com',
      fullName: 'Lê Minh Trí',
      department: 'Software Engineering',
      jobTitle: 'Fresher Backend Java',
      position: PositionLevel.FRESHER,
      employeeCode: 'NV-2026-089',
      isActive: true,
      tokenVersion: 0,
    });

    const result = await service.syncUsers({
      employeeCode: 'NV-2026-089',
      fullName: 'Lê Minh Trí',
      email: 'tri.le@novatech.com',
      position: 'Junior Backend Java',
      department: 'Software Engineering',
      employmentStatus: HrmEmploymentStatus.ACTIVE,
    });

    expect(result.statusCode).toBe(201);
    expect(result.data.action).toBe('POSITION_CHANGED');
    expect(result.data.previousPosition).toBe(PositionLevel.FRESHER);
    expect(result.data.currentPosition).toBe(PositionLevel.JUNIOR);
    expect(result.data.assignedPathId).toBe('path-junior-fullstack');
    expect(result.data.summary.positionChangedCount).toBe(1);

    expect(usersStore[0].position).toBe(PositionLevel.JUNIOR);
    expect(usersStore[0].jobTitle).toBe('Junior Backend Java');
    expect(pathEnrollmentUpserts.length).toBe(1);
    expect(pathEnrollmentUpserts[0].where.userId_pathId.pathId).toBe('lp-junior-1');
    expect(syncLogsStore.length).toBe(1);
    expect(syncLogsStore[0].status).toBe('INITIATED');
  });

  it('Nên xử lý tình huống nhân sự nghỉ việc (RESIGNED): vô hiệu hóa tài khoản, tăng tokenVersion và ghi log', async () => {
    usersStore.push({
      id: 'u-resign-1',
      email: 'yen.vu@novatech.com',
      fullName: 'Vũ Hải Yến',
      department: 'Quality Assurance',
      jobTitle: 'Fresher QA Engineer',
      position: PositionLevel.FRESHER,
      employeeCode: 'NV-2026-093',
      isActive: true,
      tokenVersion: 1,
    });

    const result = await service.syncUsers({
      employeeCode: 'NV-2026-093',
      fullName: 'Vũ Hải Yến',
      email: 'yen.vu@novatech.com',
      position: 'Fresher QA Engineer',
      department: 'Quality Assurance',
      employmentStatus: HrmEmploymentStatus.RESIGNED,
    });

    expect(result.statusCode).toBe(201);
    expect(result.data.action).toBe('DEACTIVATED');
    expect(result.data.isActive).toBe(false);
    expect(result.data.assignedPathId).toBeNull();
    expect(result.data.summary.deactivatedCount).toBe(1);

    expect(usersStore[0].isActive).toBe(false);
    expect(usersStore[0].tokenVersion).toBe(2);
    expect(syncLogsStore.length).toBe(1);
    expect(syncLogsStore[0].status).toBe('INITIATED');
  });

  it('Nên ghi log SKIPPED khi nhận yêu cầu nghỉ việc (RESIGNED) cho email chưa có trên LMS', async () => {
    const result = await service.syncUsers({
      employeeCode: 'NV-2026-999',
      fullName: 'Nhân sự không tồn tại',
      email: 'ghost@novatech.com',
      position: 'Fresher QA',
      department: 'Quality Assurance',
      employmentStatus: HrmEmploymentStatus.RESIGNED,
    });

    expect(result.statusCode).toBe(201);
    expect(result.data.action).toBe('SKIPPED');
    expect(result.data.status).toBe('SKIPPED');
    expect(result.data.userId).toBeNull();
    expect(result.data.summary.skippedCount).toBe(1);

    expect(usersStore.length).toBe(0);
    expect(syncLogsStore.length).toBe(1);
    expect(syncLogsStore[0].status).toBe('SKIPPED');
  });

  it('Nên hỗ trợ đồng bộ hàng loạt employees[] kết hợp tạo mới và đổi chức danh', async () => {
    usersStore.push({
      id: 'u-batch-1',
      email: 'ha.pham@novatech.com',
      fullName: 'Phạm Thu Hà',
      department: 'Software Engineering',
      jobTitle: 'Junior Frontend React',
      position: PositionLevel.JUNIOR,
      employeeCode: 'NV-2026-090',
      isActive: true,
      tokenVersion: 0,
    });

    const result = await service.syncUsers({
      employees: [
        {
          employeeCode: 'NV-2026-089',
          fullName: 'Lê Minh Trí',
          email: 'tri.le@novatech.com',
          position: 'Fresher Backend Java',
          department: 'Software Engineering',
        },
        {
          employeeCode: 'NV-2026-090',
          fullName: 'Phạm Thu Hà',
          email: 'ha.pham@novatech.com',
          position: 'Senior Frontend React',
          department: 'Software Engineering',
          employmentStatus: HrmEmploymentStatus.ACTIVE,
        },
      ],
    });

    expect(result.statusCode).toBe(201);
    expect(result.syncedCount).toBe(2);
    expect(result.data.summary.createdCount).toBe(1);
    expect(result.data.summary.positionChangedCount).toBe(1);
    expect(syncLogsStore.length).toBe(2);
  });

  it('Nên ném lỗi 400 khi thiếu fullName, sai định dạng email hoặc sai employmentStatus', async () => {
    await expect(
      service.syncUsers({
        employeeCode: 'NV-2026-089',
        fullName: '',
        email: 'tri.le@novatech.com',
        position: 'Fresher Backend Java',
        department: 'Software Engineering',
      }),
    ).rejects.toThrow();

    await expect(
      service.syncUsers({
        employeeCode: 'NV-2026-089',
        fullName: 'Lê Minh Trí',
        email: 'email-khong-hop-le',
        position: 'Fresher Backend Java',
        department: 'Software Engineering',
      }),
    ).rejects.toThrow();

    await expect(
      service.syncUsers({
        employeeCode: 'NV-2026-089',
        fullName: 'Lê Minh Trí',
        email: 'tri.le@novatech.com',
        position: 'Fresher Backend Java',
        department: 'Software Engineering',
        employmentStatus: 'UNKNOWN_STATUS',
      }),
    ).rejects.toThrow();
  });
});