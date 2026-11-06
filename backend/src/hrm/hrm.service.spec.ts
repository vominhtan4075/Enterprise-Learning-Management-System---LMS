import { HrmService } from './hrm.service.js';

// Định nghĩa kiểu mock tối thiểu cho PrismaService để test độc lập,
// tránh lỗi nạp Prisma 7 Client CJS/ESM trong môi trường test Jest.
interface MockPrismaUserUpsertArgs {
  where: { email: string };
  update: { fullName: string };
  create: { email: string; fullName: string };
}

describe('HrmService (Mock HRM Integration)', () => {
  let service: HrmService;
  let upsertCalls: MockPrismaUserUpsertArgs[] = [];

  const mockPrismaService = {
    user: {
      upsert: (args: MockPrismaUserUpsertArgs) => {
        upsertCalls.push(args);
        return Promise.resolve({
          id: 102,
          email: args.create.email,
          fullName: args.create.fullName,
          createdAt: new Date(),
        });
      },
    },
  };

  beforeEach(() => {
    upsertCalls = [];
    service = new HrmService(mockPrismaService as any);
  });

  it('Nên trả về danh sách nhân viên giả lập từ HRM và lọc đúng theo phòng ban', () => {
    const allResult = service.getMockEmployees();
    expect(allResult.statusCode).toBe(200);
    expect(allResult.data.mockEmployees.length).toBe(3);

    const qaResult = service.getMockEmployees('Quality Assurance');
    expect(qaResult.statusCode).toBe(200);
    expect(qaResult.data.mockEmployees.length).toBe(1);
    expect(qaResult.data.mockEmployees[0].employeeCode).toBe('NV-2026-091');
  });

  it('Nên đồng bộ nhân sự đơn lẻ vào DB với trường fullName và trả về đúng cấu trúc API Contract v1.0.0', async () => {
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
    expect(result.data.userId).toBe('102');
    expect(result.data.assignedPathId).toBe('path-onboarding-java-30days');
    expect(result.data.status).toBe('INITIATED');

    expect(upsertCalls.length).toBe(1);
    expect(upsertCalls[0]).toEqual({
      where: { email: 'tri.le@novatech.com' },
      update: { fullName: 'Lê Minh Trí' },
      create: {
        email: 'tri.le@novatech.com',
        fullName: 'Lê Minh Trí',
      },
    });
  });

  it('Nên hỗ trợ đồng bộ danh sách nhiều nhân sự qua mảng employees[]', async () => {
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
          position: 'Junior Frontend React',
          department: 'Software Engineering',
        },
      ],
    });

    expect(result.statusCode).toBe(201);
    expect(result.syncedCount).toBe(2);
    expect(upsertCalls.length).toBe(2);
  });

  it('Nên ném lỗi khi thiếu email, thiếu fullName hoặc sai định dạng email', async () => {
    // Kiểm tra ném lỗi khi thiếu fullName
    await expect(
      service.syncUsers({
        employeeCode: 'NV-2026-089',
        fullName: '',
        email: 'tri.le@novatech.com',
        position: 'Fresher Backend Java',
        department: 'Software Engineering',
      }),
    ).rejects.toThrow();

    // Kiểm tra ném lỗi khi sai định dạng email
    await expect(
      service.syncUsers({
        employeeCode: 'NV-2026-089',
        fullName: 'Lê Minh Trí',
        email: 'email-khong-hop-le',
        position: 'Fresher Backend Java',
        department: 'Software Engineering',
      }),
    ).rejects.toThrow();
  });
});