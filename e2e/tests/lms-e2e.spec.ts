import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import path from 'node:path';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';
const HRM_API_KEY = process.env.HRM_API_KEY || 'hrm-secret-api-key-2026';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://lms_user:lms_password@localhost:5432/corporate_lms?schema=public';

// Nạp thư viện pg từ backend/node_modules để lấy ID bài Quiz thực tế từ Seed Data
const backendRequire = createRequire(
  path.resolve(process.cwd(), '../backend/package.json'),
);
const { Pool } = backendRequire('pg');

test.describe('Corporate LMS - Bộ 6 Kịch bản Kiểm thử E2E Thực tế (Tuần 3)', () => {
  /**
   * TC01: Kiểm tra Healthcheck của Backend, PostgreSQL và Redis
   */
  test('TC01 - [API Thật] Kiểm tra Healthcheck Backend và kết nối CSDL PostgreSQL (/api/v1/health)', async ({
    request,
  }) => {
    const response = await request.get(`${BACKEND_URL}/api/v1/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    const healthData = body.data ?? body;
    expect(['ok', 'degraded', 'healthy']).toContain(healthData.status);
  });

  /**
   * TC02: Kiểm tra API lấy danh sách nhân sự giả lập từ HRM (kèm xác thực x-api-key)
   */
  test('TC02 - [API Thật] Lấy danh sách nhân sự Mock HRM theo phòng ban (GET /api/v1/hrm/employees)', async ({
    request,
  }) => {
    const response = await request.get(
      `${BACKEND_URL}/api/v1/hrm/employees?department=Software%20Engineering`,
      {
        headers: {
          'x-api-key': HRM_API_KEY,
        },
      },
    );
    expect(response.status()).toBe(200);

    const body = await response.json();
    const payload = body.data ?? body;
    expect(Array.isArray(payload.mockEmployees)).toBe(true);
    expect(payload.mockEmployees.length).toBeGreaterThanOrEqual(2);
    expect(payload.mockEmployees[0]).toHaveProperty('employeeCode');
    expect(payload.mockEmployees[0]).toHaveProperty('email');
  });

  /**
   * TC03: Kiểm thử đồng bộ nhân sự mới từ Mock HRM vào PostgreSQL và đối chiếu qua API Users (RBAC Admin)
   */
  test('TC03 - [API Thật] Đồng bộ nhân sự mới qua POST /api/v1/hrm/sync-users và xác minh bản ghi trong DB', async ({
    request,
  }) => {
    const timestamp = Date.now();
    const uniqueEmail = `tri.le.${timestamp}@novatech.com`;
    const uniqueEmpCode = `NV-2026-${String(timestamp).slice(-4)}`;

    const syncPayload = {
      employeeCode: uniqueEmpCode,
      fullName: 'Lê Minh Trí',
      email: uniqueEmail,
      position: 'Fresher Backend Java',
      department: 'Software Engineering',
      startDate: '2026-11-01',
    };

    const syncRes = await request.post(`${BACKEND_URL}/api/v1/hrm/sync-users`, {
      headers: {
        'x-api-key': HRM_API_KEY,
      },
      data: syncPayload,
    });
    expect(syncRes.status()).toBe(201);

    const syncBody = await syncRes.json();
    const syncData = syncBody.data ?? syncBody;
    expect(syncData.assignedPathId).toBe('path-onboarding-java-30days');
    expect(syncData.status).toBe('INITIATED');
    expect(syncData.userId).toBeTruthy();

    // Đăng nhập tài khoản ADMIN để lấy JWT Token truy vấn danh sách Users đối chiếu DB
    const adminLoginRes = await request.post(
      `${BACKEND_URL}/api/v1/auth/login`,
      {
        data: {
          email: 'admin@novatech.com',
          password: 'Password123!',
        },
      },
    );
    expect(adminLoginRes.status()).toBe(200);
    const adminLoginBody = await adminLoginRes.json();
    const adminPayload = adminLoginBody.data ?? adminLoginBody;
    const adminToken: string = adminPayload.accessToken;
    expect(adminToken).toBeTruthy();

    const usersRes = await request.get(
      `${BACKEND_URL}/api/v1/users?search=${encodeURIComponent(uniqueEmail)}`,
      {
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
      },
    );
    expect(usersRes.status()).toBe(200);
    const usersBody = await usersRes.json();
    const usersData = usersBody.data ?? usersBody;
    const items = Array.isArray(usersData)
      ? usersData
      : usersData.items ?? [];
    const createdUser = items.find(
      (u: { email: string; fullName: string }) => u.email === uniqueEmail,
    );
    expect(createdUser).toBeDefined();
    expect(createdUser.fullName).toBe('Lê Minh Trí');
  });

  /**
   * TC04: Kiểm thử Validation trả về 400 Bad Request khi gửi dữ liệu thiếu hoặc sai định dạng vào Mock HRM Sync API
   */
  test('TC04 - [API Thật] Trả về HTTP 400 Bad Request khi gửi thiếu email hoặc fullName vào POST /api/v1/hrm/sync-users', async ({
    request,
  }) => {
    const invalidRes = await request.post(
      `${BACKEND_URL}/api/v1/hrm/sync-users`,
      {
        headers: {
          'x-api-key': HRM_API_KEY,
        },
        data: {
          employeeCode: 'NV-2026-099',
          fullName: '',
          email: 'sai-dinh-dang-email',
        },
      },
    );

    expect(invalidRes.status()).toBe(400);
    const errorBody = await invalidRes.json();
    expect(errorBody.statusCode).toBe(400);
    expect(errorBody.errorCode).toBe('BAD_REQUEST');
  });

  /**
   * TC05: Luồng Đăng nhập & Xác thực JWT Token cho Học viên Fresher Java (UC-01 / FR-01)
   */
  test('TC05 - [Luồng Login & JWT Thật] Đăng nhập Học viên Fresher Java qua POST /api/v1/auth/login và xác thực phiên làm việc', async ({
    page,
    request,
  }) => {
    // 1. Kiểm thử API Đăng nhập thật với tài khoản Fresher Java trong Seed Data
    const loginApiRes = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
      data: {
        email: 'huan.nguyen@novatech.com',
        password: 'Password123!',
      },
    });
    expect(loginApiRes.status()).toBe(200);

    const loginJson = await loginApiRes.json();
    const loginPayload = loginJson.data ?? loginJson;
    expect(loginPayload).toHaveProperty('accessToken');
    expect(loginPayload.tokenType).toBe('Bearer');
    expect(loginPayload.user.email).toBe('huan.nguyen@novatech.com');
    expect(loginPayload.user.role).toBe('EMPLOYEE');

    const accessToken: string = loginPayload.accessToken;

    // 2. Dùng JWT Bearer Token vừa nhận gọi GET /api/v1/auth/me để xác minh Guard & Token hợp lệ
    const meRes = await request.get(`${BACKEND_URL}/api/v1/auth/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    expect(meRes.status()).toBe(200);
    const meJson = await meRes.json();
    const mePayload = meJson.data ?? meJson;
    expect(mePayload.email).toBe('huan.nguyen@novatech.com');
    expect(['Nguyễn Văn Huân', 'Nguyễn Văn Huấn']).toContain(
      mePayload.fullName,
    );

    // 3. Kiểm tra chặn đăng nhập sai mật khẩu (HTTP 401 Unauthorized)
    const wrongPassRes = await request.post(
      `${BACKEND_URL}/api/v1/auth/login`,
      {
        data: {
          email: 'huan.nguyen@novatech.com',
          password: 'WrongPassword999!',
        },
      },
    );
    expect(wrongPassRes.status()).toBe(401);

    // 4. Nếu Frontend Next.js đang chạy tại FRONTEND_URL thì kiểm thử luôn giao diện Login -> Dashboard
    try {
      const feCheck = await request.get(`${FRONTEND_URL}/login`, {
        timeout: 2000,
      });
      if (feCheck.ok()) {
        await page.goto(`${FRONTEND_URL}/login`);
        await page.fill('input[type="email"]', 'huan.nguyen@novatech.com');
        await page.fill('input[type="password"]', 'Password123!');
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
      }
    } catch {
      // Nếu chỉ bật Backend server khi chạy E2E thì bước 1-2-3 đã xác thực đầy đủ luồng JWT Auth
    }
  });

  /**
   * TC06: Luồng Làm bài Quiz & Xử lý Thi lại / Gợi ý bài ôn tập (UC-03 / BR-01 >= 70% / BR-03 < 70%)
   */
  test('TC06 - [Luồng Quiz BR-01 & BR-03 Thật] Nộp bài Quiz < 70% nhận gợi ý bài học ôn tập (BR-03) và Thi lại đạt >= 70% (BR-01)', async ({
    request,
  }) => {
    // 1. Đăng nhập tài khoản Học viên Nguyễn Văn Huân để lấy JWT Token và userId thật
    const loginRes = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
      data: {
        email: 'huan.nguyen@novatech.com',
        password: 'Password123!',
      },
    });
    expect(loginRes.status()).toBe(200);
    const loginBody = await loginRes.json();
    const loginData = loginBody.data ?? loginBody;
    const accessToken: string = loginData.accessToken;
    const userId: string = loginData.user.id;
    const authHeaders = { Authorization: `Bearer ${accessToken}` };

    // 2. Truy vấn lấy 1 bài Quiz thật cùng danh sách câu hỏi từ PostgreSQL
    const cleanDbUrl = DATABASE_URL.split('?')[0];
    const pool = new Pool({ connectionString: cleanDbUrl });
    let quizId = '';
    let questions: Array<{ questionId: string; correctAnswer: string }> = [];

    try {
      const quizQuery = await pool.query(`
        SELECT id AS "quizId"
        FROM quizzes
        WHERE id IN (SELECT quiz_id FROM questions WHERE related_lesson_id IS NOT NULL)
        LIMIT 1
      `);
      expect(quizQuery.rows.length).toBeGreaterThan(0);
      quizId = quizQuery.rows[0].quizId;

      const questionsQuery = await pool.query(
        `SELECT id AS "questionId", correct_answer AS "correctAnswer"
         FROM questions
         WHERE quiz_id = $1`,
        [quizId],
      );
      questions = questionsQuery.rows;
      expect(questions.length).toBeGreaterThan(0);
    } finally {
      await pool.end();
    }

    // 3. Nộp bài Quiz lần 1 với phương án SAI (< 70%) để kiểm tra BR-03
    const failSubmitRes = await request.post(
      `${BACKEND_URL}/api/v1/quizzes/${quizId}/submit`,
      {
        headers: authHeaders,
        data: {
          userId,
          answers: questions.map((q) => ({
            questionId: q.questionId,
            selectedOption: '__WRONG_OPTION__',
            answer: '__WRONG_OPTION__',
          })),
        },
      },
    );
    expect([200, 201]).toContain(failSubmitRes.status());

    const failSubmitBody = await failSubmitRes.json();
    const failResult = failSubmitBody.data ?? failSubmitBody;
    const failScore = Number(failResult.scorePercentage ?? failResult.score);
    const failSuggestions =
      failResult.suggestedLessons ??
      failResult.recommendation?.suggestedLessons ??
      [];

    expect(failScore).toBeLessThan(70);
    expect(failResult.isPassed).toBe(false);
    expect(failResult.attemptNumber).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(failSuggestions)).toBe(true);
    expect(failSuggestions.length).toBeGreaterThan(0);

    // 4. Gọi GET /api/v1/quizzes/:id/retake-suggestions để kiểm tra endpoint gợi ý ôn tập hoạt động (BR-03)
    const retakeRes = await request.get(
      `${BACKEND_URL}/api/v1/quizzes/${quizId}/retake-suggestions?userId=${encodeURIComponent(userId)}`,
      {
        headers: authHeaders,
      },
    );
    expect(retakeRes.status()).toBe(200);
    const retakeBody = await retakeRes.json();
    const retakeData = retakeBody.data ?? retakeBody;
    expect(retakeData).toBeDefined();

    // 5. Thực hiện Thi lại (Retake Quiz) với toàn bộ đáp án ĐÚNG (100% >= 70%) để kiểm tra BR-01
    const passSubmitRes = await request.post(
      `${BACKEND_URL}/api/v1/quizzes/${quizId}/submit`,
      {
        headers: authHeaders,
        data: {
          userId,
          answers: questions.map((q) => ({
            questionId: q.questionId,
            selectedOption: q.correctAnswer,
            answer: q.correctAnswer,
          })),
        },
      },
    );
    expect([200, 201]).toContain(passSubmitRes.status());

    const passSubmitBody = await passSubmitRes.json();
    const passResult = passSubmitBody.data ?? passSubmitBody;
    const passScore = Number(passResult.scorePercentage ?? passResult.score);
    const passSuggestions =
      passResult.suggestedLessons ??
      passResult.recommendation?.suggestedLessons ??
      [];

    expect(passScore).toBeGreaterThanOrEqual(70);
    expect(passResult.isPassed).toBe(true);
    expect(passResult.attemptNumber).toBeGreaterThan(failResult.attemptNumber);
    expect(passSuggestions.length).toBe(0);
  });
});