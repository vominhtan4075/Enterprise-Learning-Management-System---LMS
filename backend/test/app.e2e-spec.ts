import { describe, beforeEach, afterEach, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma.service.js';
import { RedisService } from './../src/common/redis/redis.service.js';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter.js';
import { PositionLevel, RoleCode } from './../src/generated/prisma/enums.js';

describe('App Security & Global Guards (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  const mockUsersById: Record<string, any> = {
    'u-emp-active': {
      id: 'u-emp-active',
      email: 'emp.active@novatech.com',
      fullName: 'Active Employee',
      role: { id: 1, code: RoleCode.EMPLOYEE },
      position: PositionLevel.FRESHER,
      department: 'Engineering',
      isActive: true,
      deletedAt: null,
      mustChangePassword: false,
      tokenVersion: 0,
    },
    'u-emp-must-change': {
      id: 'u-emp-must-change',
      email: 'emp.new@novatech.com',
      fullName: 'New Employee',
      role: { id: 1, code: RoleCode.EMPLOYEE },
      position: PositionLevel.FRESHER,
      department: 'Engineering',
      isActive: true,
      deletedAt: null,
      mustChangePassword: true,
      tokenVersion: 0,
    },
  };

  beforeEach(async () => {
    process.env.DATABASE_URL ??=
      'postgresql://lms_user:lms_password@localhost:5432/corporate_lms?schema=public';
    process.env.JWT_SECRET ??=
      'novatech-lms-super-secret-jwt-key-2026-dev-32chars';
    process.env.HRM_API_KEY ??= 'novatech-hrm-secret-api-key-2026';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $queryRaw: async () => [{ '?column?': 1 }],
        user: {
          count: async () => 1,
          findUnique: async ({ where }: { where: { id?: string } }) =>
            where?.id ? (mockUsersById[where.id] ?? null) : null,
        },
      })
      .overrideProvider(RedisService)
      .useValue({
        ping: async () => true,
        get: async () => null,
        set: async () => undefined,
        del: async () => undefined,
        delByPattern: async () => undefined,
        remember: async (_k: string, _ttl: number, fn: () => Promise<unknown>) =>
          fn(),
      })
      .compile();

    jwtService = moduleFixture.get(JwtService);
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
  });

  it('GET /api/v1/health (@Public) nên trả về 200 mà không cần token', () => {
    return request(app.getHttpServer()).get('/api/v1/health').expect(200);
  });

  it('Các endpoint bảo mật không có token nên bị chặn 401 AUTH_UNAUTHORIZED', async () => {
    const usersRes = await request(app.getHttpServer())
      .post('/api/v1/users')
      .send({})
      .expect(401);
    expect(usersRes.body.errorCode).toBe('AUTH_UNAUTHORIZED');

    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
    expect(meRes.body.errorCode).toBe('AUTH_UNAUTHORIZED');

    const hrmLogsRes = await request(app.getHttpServer())
      .get('/api/v1/hrm/sync-logs')
      .expect(401);
    expect(hrmLogsRes.body.errorCode).toBe('AUTH_UNAUTHORIZED');
  });

  it('EMPLOYEE token gọi API quản trị nên bị chặn 403 AUTH_FORBIDDEN', async () => {
    const empToken = jwtService.sign({
      sub: 'u-emp-active',
      email: 'emp.active@novatech.com',
      role: RoleCode.EMPLOYEE,
      position: PositionLevel.FRESHER,
      tokenVersion: 0,
      jti: 'e2e-emp-1',
    });

    const syncLogsRes = await request(app.getHttpServer())
      .get('/api/v1/hrm/sync-logs')
      .set('Authorization', `Bearer ${empToken}`)
      .expect(403);
    expect(syncLogsRes.body.errorCode).toBe('AUTH_FORBIDDEN');

    const completionRes = await request(app.getHttpServer())
      .get('/api/v1/reports/completion')
      .set('Authorization', `Bearer ${empToken}`)
      .expect(403);
    expect(completionRes.body.errorCode).toBe('AUTH_FORBIDDEN');
  });

  it('User có mustChangePassword=true gọi API nghiệp vụ nên bị chặn 403 AUTH_MUST_CHANGE_PASSWORD', async () => {
    const newEmpToken = jwtService.sign({
      sub: 'u-emp-must-change',
      email: 'emp.new@novatech.com',
      role: RoleCode.EMPLOYEE,
      position: PositionLevel.FRESHER,
      tokenVersion: 0,
      jti: 'e2e-emp-2',
    });

    const res = await request(app.getHttpServer())
      .get('/api/v1/courses')
      .set('Authorization', `Bearer ${newEmpToken}`)
      .expect(403);
    expect(res.body.errorCode).toBe('AUTH_MUST_CHANGE_PASSWORD');
  });

  afterEach(async () => {
    await app.close();
  });
});
