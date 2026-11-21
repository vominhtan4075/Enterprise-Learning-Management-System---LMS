import { EnrollmentStatus, HrmSyncStatus, PositionLevel, RoleCode } from '../generated/prisma/enums.js';
import type { PrismaService } from '../prisma.service.js';
import { HrmEmploymentStatus } from './dto/sync-user.dto.js';
import { HrmService } from './hrm.service.js';

interface MockPathEnrollmentRecord {
  id: string;
  pathId: string;
  status: EnrollmentStatus;
  deadline: Date;
  completedAt: Date | null;
  progressPercentage: number;
  source: string;
  learningPath: {
    id: string;
    code: string;
    title: string;
    targetPosition: PositionLevel;
  };
}

interface MockCourseEnrollmentRecord {
  id: string;
  courseId: string;
  status: EnrollmentStatus;
  deadline: Date;
  completedAt: Date | null;
  progressPercentage: number;
  source: string;
  course: {
    id: string;
    code: string;
    title: string;
  };
}

interface MockCompetencyRecord {
  skillName: string;
  proficiencyScore: number;
  updatedAt: Date;
}

interface MockUserRecord {
  id: string;
  email: string;
  fullName: string;
  department: string | null;
  jobTitle: string | null;
  position: PositionLevel;
  employeeCode: string | null;
  isActive: boolean;
  startDate?: Date | null;
  deletedAt?: Date | null;
  roleCode?: RoleCode;
  tokenVersion: number;
  pathEnrollments?: MockPathEnrollmentRecord[];
  courseEnrollments?: MockCourseEnrollmentRecord[];
  competencyMatrices?: MockCompetencyRecord[];
}

interface MockSyncLogRecord {
  id?: string;
  employeeCode: string;
  email: string;
  payload?: unknown;
  status: string;
  message: string | null;
  userId: string | null;
  assignedPathId: string | null;
  createdAt?: Date;
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
  let failOnEmails: Set<string>;

  const filterLogs = (
    logs: MockSyncLogRecord[],
    where?: {
      status?: string;
      OR?: Array<{
        employeeCode?: { contains?: string };
        email?: { contains?: string };
      }>;
    },
  ) =>
    logs.filter((log) => {
      if (where?.status && log.status !== where.status) {
        return false;
      }
      if (where?.OR?.length) {
        const keyword = (
          where.OR[0]?.employeeCode?.contains ??
          where.OR[1]?.email?.contains ??
          ''
        ).toLowerCase();
        if (
          keyword &&
          !log.employeeCode.toLowerCase().includes(keyword) &&
          !log.email.toLowerCase().includes(keyword)
        ) {
          return false;
        }
      }
      return true;
    });

  const filterTrainingUsers = (
    users: MockUserRecord[],
    where?: {
      employeeCode?: { equals?: string };
      email?: { equals?: string };
      department?: { equals?: string };
      role?: { code?: RoleCode };
    },
  ) =>
    users.filter((u) => {
      if (u.deletedAt) return false;
      if (where?.role?.code && (u.roleCode ?? RoleCode.EMPLOYEE) !== where.role.code) {
        return false;
      }
      if (
        where?.employeeCode?.equals &&
        (u.employeeCode ?? '').toLowerCase() !== where.employeeCode.equals.toLowerCase()
      ) {
        return false;
      }
      if (
        where?.email?.equals &&
        u.email.toLowerCase() !== where.email.equals.toLowerCase()
      ) {
        return false;
      }
      if (
        where?.department?.equals &&
        (u.department ?? '').toLowerCase() !== where.department.equals.toLowerCase()
      ) {
        return false;
      }
      return true;
    });

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
        if (failOnEmails.has(String(data.email))) {
          return Promise.reject(new Error('Simulated database write failure'));
        }
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
          deletedAt: null,
          roleCode: RoleCode.EMPLOYEE,
          tokenVersion: 0,
          pathEnrollments: [],
          courseEnrollments: [],
          competencyMatrices: [],
        };
        usersStore.push(created);
        return Promise.resolve(created);
      },

      findMany: ({
        where,
        skip = 0,
        take = 20,
      }: {
        where?: {
          employeeCode?: { equals?: string };
          email?: { equals?: string };
          department?: { equals?: string };
          role?: { code?: RoleCode };
        };
        skip?: number;
        take?: number;
      } = {}) => {
        const filtered = filterTrainingUsers(usersStore, where);
        return Promise.resolve(
          filtered.slice(skip, skip + take).map((u) => ({
            ...u,
            pathEnrollments: u.pathEnrollments ?? [],
            courseEnrollments: u.courseEnrollments ?? [],
            competencyMatrices: u.competencyMatrices ?? [],
          })),
        );
      },

      count: ({
        where,
      }: {
        where?: {
          employeeCode?: { equals?: string };
          email?: { equals?: string };
          department?: { equals?: string };
          role?: { code?: RoleCode };
        };
      } = {}) => Promise.resolve(filterTrainingUsers(usersStore, where).length),

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
        const record: MockSyncLogRecord = {
          id: `log-${syncLogsStore.length + 1}`,
          createdAt: new Date(Date.now() + syncLogsStore.length * 1000),
          ...data,
        };
        syncLogsStore.push(record);
        return Promise.resolve(record);
      },

      findMany: ({
        where,
        skip = 0,
        take = 20,
      }: {
        where?: {
          status?: string;
          OR?: Array<{
            employeeCode?: { contains?: string };
            email?: { contains?: string };
          }>;
        };
        skip?: number;
        take?: number;
      } = {}) => {
        const filtered = filterLogs(syncLogsStore, where).slice().reverse();
        return Promise.resolve(filtered.slice(skip, skip + take));
      },

      count: ({
        where,
      }: {
        where?: {
          status?: string;
          OR?: Array<{
            employeeCode?: { contains?: string };
            email?: { contains?: string };
          }>;
        };
      } = {}) => Promise.resolve(filterLogs(syncLogsStore, where).length),

      findUnique: ({ where }: { where: { id: string } }) =>
        Promise.resolve(syncLogsStore.find((item) => item.id === where.id) ?? null),
    },
  });

  beforeEach(() => {
    usersStore = [];
    syncLogsStore = [];
    pathEnrollmentUpserts = [];
    idCounter = 100;
    failOnEmails = new Set();
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

  it('WP12: syncUsers ghi log FAILED và tăng failedCount nếu 1 bản ghi gặp lỗi DB mà vẫn tiếp tục đồng bộ các bản ghi còn lại', async () => {
    failOnEmails.add('fail.user@novatech.com');

    const result = await service.syncUsers({
      employees: [
        {
          employeeCode: 'NV-2026-ERR',
          fullName: 'Nhân Sự Lỗi DB',
          email: 'fail.user@novatech.com',
          position: 'Fresher Backend Java',
          department: 'Software Engineering',
        },
        {
          employeeCode: 'NV-2026-OK',
          fullName: 'Nhân Sự Hợp Lệ',
          email: 'ok.user@novatech.com',
          position: 'Junior Backend Java',
          department: 'Software Engineering',
        },
      ],
    });

    expect(result.statusCode).toBe(201);
    expect(result.syncedCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.data.summary.failedCount).toBe(1);
    expect(result.data.summary.createdCount).toBe(1);
    expect(result.data.syncedUsers[0].status).toBe(HrmSyncStatus.FAILED);
    expect(result.data.syncedUsers[0].action).toBe('FAILED');
    expect(result.data.syncedUsers[1].status).toBe(HrmSyncStatus.INITIATED);
    expect(syncLogsStore.find((l) => l.email === 'fail.user@novatech.com')?.status).toBe(
      HrmSyncStatus.FAILED,
    );
  });

  it('WP12: getSyncLogs lọc theo status, search, phân trang chuẩn và getSyncLogDetail trả chi tiết hoặc ném 404', async () => {
    failOnEmails.add('fail.log@novatech.com');

    await service.syncUsers({
      employees: [
        {
          employeeCode: 'NV-2026-101',
          fullName: 'Nguyễn Văn An',
          email: 'an.nguyen@novatech.com',
          position: 'Fresher Java',
          department: 'Software Engineering',
        },
        {
          employeeCode: 'NV-2026-102',
          fullName: 'Lê Thị Bình',
          email: 'fail.log@novatech.com',
          position: 'Junior Java',
          department: 'Software Engineering',
        },
        {
          employeeCode: 'NV-2026-103',
          fullName: 'Trần Nghỉ Việc',
          email: 'ghost.skip@novatech.com',
          position: 'Fresher QA',
          department: 'Quality Assurance',
          employmentStatus: HrmEmploymentStatus.RESIGNED,
        },
      ],
    });

    const failedPage = await service.getSyncLogs({
      page: 1,
      limit: 10,
      status: HrmSyncStatus.FAILED,
      search: 'NV-2026-102',
    });

    expect(failedPage.total).toBe(1);
    expect(failedPage.page).toBe(1);
    expect(failedPage.limit).toBe(10);
    expect(failedPage.totalPages).toBe(1);
    expect(failedPage.data[0].email).toBe('fail.log@novatech.com');

    const logId = String(failedPage.data[0].id);
    const detail = await service.getSyncLogDetail(logId);
    expect(detail.id).toBe(logId);
    expect(detail.status).toBe(HrmSyncStatus.FAILED);

    await expect(service.getSyncLogDetail('non-existent-id')).rejects.toThrow(
      'Không tìm thấy lịch sử đồng bộ HRM',
    );
  });

  it('WP12 FR-08: getTrainingStatus lọc theo nhân sự/phòng ban và tính đúng overallStatus, tiến độ, điểm năng lực TB', async () => {
    const pastDeadline = new Date('2020-01-01T00:00:00Z');
    const futureDeadline = new Date('2027-12-31T00:00:00Z');

    usersStore.push(
      {
        id: 'u-train-1',
        email: 'completed@novatech.com',
        fullName: 'Học Viên Hoàn Thành',
        department: 'Backend',
        jobTitle: 'Fresher Backend',
        position: PositionLevel.FRESHER,
        employeeCode: 'NV-TR-01',
        isActive: true,
        roleCode: RoleCode.EMPLOYEE,
        tokenVersion: 0,
        pathEnrollments: [
          {
            id: 'pe-1',
            pathId: 'p-1',
            status: EnrollmentStatus.COMPLETED,
            deadline: futureDeadline,
            completedAt: new Date(),
            progressPercentage: 100,
            source: 'HRM',
            learningPath: {
              id: 'p-1',
              code: 'path-fresher-java',
              title: 'Onboarding Fresher Java',
              targetPosition: PositionLevel.FRESHER,
            },
          },
        ],
        courseEnrollments: [],
        competencyMatrices: [
          { skillName: 'Java Core', proficiencyScore: 90, updatedAt: new Date() },
          { skillName: 'Spring Boot', proficiencyScore: 80, updatedAt: new Date() },
        ],
      },
      {
        id: 'u-train-2',
        email: 'overdue@novatech.com',
        fullName: 'Học Viên Quá Hạn',
        department: 'QA',
        jobTitle: 'Intern QA',
        position: PositionLevel.INTERN,
        employeeCode: 'NV-TR-02',
        isActive: true,
        roleCode: RoleCode.EMPLOYEE,
        tokenVersion: 0,
        pathEnrollments: [
          {
            id: 'pe-2',
            pathId: 'p-2',
            status: EnrollmentStatus.IN_PROGRESS,
            deadline: pastDeadline,
            completedAt: null,
            progressPercentage: 40,
            source: 'HRM',
            learningPath: {
              id: 'p-2',
              code: 'path-intern-qa',
              title: 'Onboarding Intern QA',
              targetPosition: PositionLevel.INTERN,
            },
          },
        ],
        courseEnrollments: [],
        competencyMatrices: [],
      },
    );

    const allStatus = await service.getTrainingStatus({ page: 1, limit: 10 });
    expect(allStatus.total).toBe(2);
    expect(allStatus.data[0].overallStatus).toBe('COMPLETED');
    expect(allStatus.data[0].overallProgressPercentage).toBe(100);
    expect(allStatus.data[0].avgCompetencyScore).toBe(85);
    expect(allStatus.data[1].overallStatus).toBe('OVERDUE');
    expect(allStatus.data[1].overallProgressPercentage).toBe(40);
    expect(allStatus.data[1].avgCompetencyScore).toBe(0);

    const byDept = await service.getTrainingStatus({ department: 'qa' });
    expect(byDept.total).toBe(1);
    expect(byDept.data[0].employeeCode).toBe('NV-TR-02');
  });
});