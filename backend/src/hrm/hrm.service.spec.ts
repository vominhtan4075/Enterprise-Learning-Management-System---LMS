import { HrmService } from './hrm.service.js';
import { PrismaService } from '../prisma.service.js';

describe('HrmService (Mock HRM Integration)', () => {
  let service: HrmService;

  const mockPrismaService = {
    user: {
      upsert: () => Promise.resolve({ id: 'u-102-uuid', email: 'tri.le@novatech.com' }),
    },
  } as unknown as PrismaService;

  beforeEach(() => {
    service = new HrmService(mockPrismaService);
  });

  it('Nên trả về danh sách nhân viên giả lập từ HRM', () => {
    const result = service.getMockEmployees('Software Engineering');
    expect(result.statusCode).toBe(200);
    expect(result.data.mockEmployees.length).toBeGreaterThan(0);
  });

  it('Nên đồng bộ nhân sự mới và gán lộ trình path-onboarding-java-30days', async () => {
    const result = await service.syncUsers({
      employeeCode: 'NV-2026-089',
      fullName: 'Lê Minh Trí',
      email: 'tri.le@novatech.com',
      position: 'Fresher Backend Java',
      department: 'Software Engineering',
    });

    expect(result.statusCode).toBe(201);
    expect(result.data.assignedPathId).toBe('path-onboarding-java-30days');
    expect(result.data.status).toBe('INITIATED');
  });
});