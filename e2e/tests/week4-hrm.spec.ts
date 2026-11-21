import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const HRM_API_KEY = process.env.HRM_API_KEY || 'hrm-secret-api-key-2026';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Password123!';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://lms_user:lms_password@localhost:5432/corporate_lms?schema=public';

const backendRequire = createRequire(
  path.resolve(process.cwd(), '../backend/package.json'),
);
const { Pool } = backendRequire('pg');

const hrmHeaders = { 'x-api-key': HRM_API_KEY };

async function queryDb<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const pool = new Pool({ connectionString: DATABASE_URL.split('?')[0] });
  try {
    const result = await pool.query(sql, params);
    return result.rows as T[];
  } finally {
    await pool.end();
  }
}

test.describe('Corporate LMS E2E - Mở rộng Mock HRM Integration (Tuần 4)', () => {
  test('TC-HRM-01 - Lọc danh sách nhân sự Mock HRM theo trạng thái RESIGNED và chặn status không hợp lệ', async ({
    request,
  }) => {
    const resignedRes = await request.get(
      `${BACKEND_URL}/api/v1/hrm/employees?status=RESIGNED`,
      { headers: hrmHeaders },
    );
    expect(resignedRes.status()).toBe(200);

    const resignedBody = await resignedRes.json();
    const payload = resignedBody.data ?? resignedBody;
    expect(Array.isArray(payload.mockEmployees)).toBe(true);
    expect(payload.mockEmployees.length).toBeGreaterThanOrEqual(1);
    expect(
      payload.mockEmployees.every(
        (emp: { employmentStatus: string }) => emp.employmentStatus === 'RESIGNED',
      ),
    ).toBe(true);

    const invalidRes = await request.get(
      `${BACKEND_URL}/api/v1/hrm/employees?status=INVALID_STATUS`,
      { headers: hrmHeaders },
    );
    expect(invalidRes.status()).toBe(400);
  });

  test('TC-HRM-02 - Đồng bộ thay đổi chức danh (Fresher -> Junior), cập nhật DB và ghi bảng hrm_sync_logs', async ({
    request,
  }) => {
    const ts = Date.now();
    const email = `hrm.promote.${ts}@novatech.com`;
    const employeeCode = `NV-PRM-${String(ts).slice(-5)}`;

    // 1. Tạo nhân sự ban đầu ở cấp bậc Fresher
    const createRes = await request.post(`${BACKEND_URL}/api/v1/hrm/sync-users`, {
      headers: hrmHeaders,
      data: {
        employeeCode,
        fullName: 'Trần Văn Thăng Tiến',
        email,
        position: 'Fresher Backend Java',
        department: 'Software Engineering',
        startDate: '2026-11-01',
      },
    });
    expect(createRes.status()).toBe(201);
    const createData = (await createRes.json()).data;
    expect(createData.action).toBe('CREATED');
    expect(createData.currentPosition).toBe('FRESHER');

    // 2. Đồng bộ lại cùng email với chức danh mới (Junior Backend Java)
    const promoteRes = await request.post(`${BACKEND_URL}/api/v1/hrm/sync-users`, {
      headers: hrmHeaders,
      data: {
        employeeCode,
        fullName: 'Trần Văn Thăng Tiến',
        email,
        position: 'Junior Backend Java',
        department: 'Software Engineering',
        employmentStatus: 'ACTIVE',
      },
    });
    expect(promoteRes.status()).toBe(201);
    const promoteData = (await promoteRes.json()).data;
    expect(promoteData.action).toBe('POSITION_CHANGED');
    expect(promoteData.previousPosition).toBe('FRESHER');
    expect(promoteData.currentPosition).toBe('JUNIOR');
    expect(promoteData.summary.positionChangedCount).toBe(1);

    // 3. Đối chiếu trực tiếp bảng users và hrm_sync_logs trong PostgreSQL
    const users = await queryDb<{
      position: string;
      job_title: string;
      is_active: boolean;
    }>(
      'SELECT position, job_title, is_active FROM users WHERE email = $1',
      [email],
    );
    expect(users).toHaveLength(1);
    expect(users[0].position).toBe('JUNIOR');
    expect(users[0].job_title).toBe('Junior Backend Java');
    expect(users[0].is_active).toBe(true);

    const logs = await queryDb<{ status: string; message: string }>(
      'SELECT status, message FROM hrm_sync_logs WHERE email = $1 ORDER BY created_at ASC',
      [email],
    );
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(logs[logs.length - 1].status).toBe('INITIATED');
  });

  test('TC-HRM-03 - Đồng bộ nhân sự nghỉ việc (RESIGNED): vô hiệu hóa tài khoản, chặn đăng nhập và ghi log', async ({
    request,
  }) => {
    const ts = Date.now();
    const email = `hrm.resign.${ts}@novatech.com`;
    const employeeCode = `NV-RSG-${String(ts).slice(-5)}`;

    // 1. Tạo nhân sự đang hoạt động
    const createRes = await request.post(`${BACKEND_URL}/api/v1/hrm/sync-users`, {
      headers: hrmHeaders,
      data: {
        employeeCode,
        fullName: 'Nguyễn Thị Nghỉ Việc',
        email,
        position: 'Fresher QA Engineer',
        department: 'Quality Assurance',
      },
    });
    expect(createRes.status()).toBe(201);

    // 2. Đăng nhập thành công trước khi nghỉ việc để lấy JWT đang sống
    const loginBeforeRes = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
      data: { email, password: DEMO_PASSWORD },
    });
    expect(loginBeforeRes.status()).toBe(200);
    const loginBeforeBody = await loginBeforeRes.json();
    const activeToken: string = (loginBeforeBody.data ?? loginBeforeBody).accessToken;
    expect(activeToken).toBeTruthy();

    // 3. Gửi tín hiệu nghỉ việc (RESIGNED) từ Mock HRM
    const resignRes = await request.post(`${BACKEND_URL}/api/v1/hrm/sync-users`, {
      headers: hrmHeaders,
      data: {
        employeeCode,
        fullName: 'Nguyễn Thị Nghỉ Việc',
        email,
        position: 'Fresher QA Engineer',
        department: 'Quality Assurance',
        employmentStatus: 'RESIGNED',
      },
    });
    expect(resignRes.status()).toBe(201);
    const resignData = (await resignRes.json()).data;
    expect(resignData.action).toBe('DEACTIVATED');
    expect(resignData.isActive).toBe(false);
    expect(resignData.summary.deactivatedCount).toBe(1);

    // 4. Kiểm tra JWT cũ bị thu hồi và không thể đăng nhập lại
    const meAfterRes = await request.get(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${activeToken}` },
    });
    expect([401, 403]).toContain(meAfterRes.status());

    const loginAfterRes = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
      data: { email, password: DEMO_PASSWORD },
    });
    expect([401, 403]).toContain(loginAfterRes.status());

    // 5. Đối chiếu is_active = false, token_version >= 1 và log trong DB
    const users = await queryDb<{ is_active: boolean; token_version: number }>(
      'SELECT is_active, token_version FROM users WHERE email = $1',
      [email],
    );
    expect(users).toHaveLength(1);
    expect(users[0].is_active).toBe(false);
    expect(users[0].token_version).toBeGreaterThanOrEqual(1);

    const logs = await queryDb<{ status: string }>(
      'SELECT status FROM hrm_sync_logs WHERE email = $1 ORDER BY created_at DESC LIMIT 1',
      [email],
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('INITIATED');
  });

  test('TC-HRM-04 - Ghi log SKIPPED vào hrm_sync_logs khi nhận yêu cầu RESIGNED cho email chưa tồn tại', async ({
    request,
  }) => {
    const ts = Date.now();
    const ghostEmail = `hrm.ghost.${ts}@novatech.com`;
    const ghostCode = `NV-GH-${String(ts).slice(-5)}`;

    const res = await request.post(`${BACKEND_URL}/api/v1/hrm/sync-users`, {
      headers: hrmHeaders,
      data: {
        employeeCode: ghostCode,
        fullName: 'Nhân sự chưa từng đồng bộ',
        email: ghostEmail,
        position: 'Intern QA',
        department: 'Quality Assurance',
        employmentStatus: 'RESIGNED',
      },
    });
    expect(res.status()).toBe(201);

    const data = (await res.json()).data;
    expect(data.action).toBe('SKIPPED');
    expect(data.status).toBe('SKIPPED');
    expect(data.userId).toBeNull();

    const logs = await queryDb<{ status: string; user_id: string | null }>(
      'SELECT status, user_id FROM hrm_sync_logs WHERE email = $1',
      [ghostEmail],
    );
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe('SKIPPED');
    expect(logs[0].user_id).toBeNull();
  });
});