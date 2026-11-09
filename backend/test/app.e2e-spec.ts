import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/prisma.service.js';
import { RedisService } from './../src/common/redis/redis.service.js';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter.js';

describe('App Security & Global Guards (e2e)', () => {
  let app: INestApplication<App>;

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
        user: { count: async () => 1, findUnique: async () => null },
      })
      .overrideProvider(RedisService)
      .useValue({
        ping: async () => true,
        get: async () => null,
        set: async () => undefined,
        del: async () => undefined,
      })
      .compile();

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

  it('GET /api/v1/users không có token nên bị chặn 401 AUTH_UNAUTHORIZED', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .expect(401);
    expect(res.body.errorCode).toBe('AUTH_UNAUTHORIZED');
  });

  it('POST /api/v1/hrm/sync-users không có x-api-key hoặc JWT nên bị chặn 401', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/hrm/sync-users')
      .send({})
      .expect(401);
    expect(res.body.errorCode).toBe('AUTH_UNAUTHORIZED');
  });

  afterEach(async () => {
    await app.close();
  });
});
