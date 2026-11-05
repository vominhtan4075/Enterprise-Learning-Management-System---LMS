import { test, expect } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';

test.describe('Corporate LMS - Kiểm thử E2E Tích hợp Hệ thống Thật (Tuần 2)', () => {
   // TC01: Kiểm tra Healthcheck của Backend và kết nối thực tế tới PostgreSQL
  test('TC01 - [API Thật] Kiểm tra Healthcheck Backend và kết nối CSDL PostgreSQL (/api/health)', async ({
    request,
  }) => {
    const response = await request.get(`${BACKEND_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.status).toBe('ok');
    expect(body.database.status).toBe('connected');
  });

   // TC02: Kiểm tra API lấy danh sách nhân sự giả lập từ HRM
  test('TC02 - [API Thật] Lấy danh sách nhân sự Mock HRM theo phòng ban (GET /api/v1/hrm/employees)', async ({
    request,
  }) => {
    const response = await request.get(
      `${BACKEND_URL}/api/v1/hrm/employees?department=Software%20Engineering`,
    );
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.statusCode).toBe(200);
    expect(Array.isArray(body.data.mockEmployees)).toBe(true);
    expect(body.data.mockEmployees.length).toBeGreaterThanOrEqual(2);
    expect(body.data.mockEmployees[0]).toHaveProperty('employeeCode');
    expect(body.data.mockEmployees[0]).toHaveProperty('email');
  });

  test('TC03 - [API Thật] Đồng bộ nhân sự mới qua POST /api/v1/hrm/sync-users và xác minh bản ghi trong DB', async ({
    request,
  }) => {
    const uniqueEmail = `tri.le.${Date.now()}@novatech.com`;
    const syncPayload = {
      employeeCode: 'NV-2026-089',
      fullName: 'Lê Minh Trí',
      email: uniqueEmail,
      position: 'Fresher Backend Java',
      department: 'Software Engineering',
      startDate: '2026-11-01',
    };

    const syncRes = await request.post(`${BACKEND_URL}/api/v1/hrm/sync-users`, {
      data: syncPayload,
    });
    expect(syncRes.status()).toBe(201);

    const syncBody = await syncRes.json();
    expect(syncBody.statusCode).toBe(201);
    expect(syncBody.message).toContain('Onboarding 30 ngày');
    expect(syncBody.data.assignedPathId).toBe('path-onboarding-java-30days');
    expect(syncBody.data.status).toBe('INITIATED');
    expect(syncBody.data.userId).toBeTruthy();

    // Đối chiếu trực tiếp với bảng User trong PostgreSQL thông qua GET /api/users
    const usersRes = await request.get(`${BACKEND_URL}/api/users`);
    expect(usersRes.status()).toBe(200);
    const usersList = await usersRes.json();
    const createdUser = usersList.find(
      (u: { email: string; fullName: string }) => u.email === uniqueEmail,
    );
    expect(createdUser).toBeDefined();
    expect(createdUser.fullName).toBe('Lê Minh Trí');
  });

  test('TC04 - [API Thật] Trả về HTTP 400 Bad Request khi gửi thiếu email hoặc fullName vào POST /api/v1/hrm/sync-users', async ({
    request,
  }) => {
    const invalidRes = await request.post(
      `${BACKEND_URL}/api/v1/hrm/sync-users`,
      {
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

  test.fixme(
    'TC05 - [Chờ Auth BE & Frontend UI] Đăng nhập Học viên Fresher Java qua POST /api/v1/auth/login và điều hướng tới Dashboard',
    async ({ page, request }) => {
      // 1. Kiểm thử API Contract POST /api/v1/auth/login
      const loginApiRes = await request.post(
        `${BACKEND_URL}/api/v1/auth/login`,
        {
          data: {
            email: 'huan.nguyen@novatech.com',
            password: 'Password@123',
          },
        },
      );
      expect(loginApiRes.status()).toBe(200);
      const loginJson = await loginApiRes.json();
      expect(loginJson.data).toHaveProperty('accessToken');
      expect(loginJson.data.user.role).toBe('EMPLOYEE');

      // 2. Kiểm thử tương tác giao diện thật trên Next.js Frontend
      await page.goto(`${FRONTEND_URL}/login`);
      await page.fill('input[name="email"]', 'huan.nguyen@novatech.com');
      await page.fill('input[name="password"]', 'Password@123');
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.locator('body')).toContainText('Nguyễn Văn Huấn');
    },
  );

  test.fixme(
    'TC06 - [Chờ Quiz Module BE & Seed Data] Nộp bài Quiz không đạt (< 70%) kích hoạt chế độ Thi lại và trả về suggestedLessons (BR-01, BR-03)',
    async ({ request }) => {
      // 1. Đăng nhập lấy JWT Token của học viên Employee
      const loginRes = await request.post(`${BACKEND_URL}/api/v1/auth/login`, {
        data: {
          email: 'huan.nguyen@novatech.com',
          password: 'Password@123',
        },
      });
      const { accessToken } = (await loginRes.json()).data;
      const authHeaders = { Authorization: `Bearer ${accessToken}` };

      // 2. Lấy đề thi Học phần 1 (GET /api/v1/quizzes/quiz-mod-01)
      const quizRes = await request.get(
        `${BACKEND_URL}/api/v1/quizzes/quiz-mod-01`,
        {
          headers: authHeaders,
        },
      );
      expect(quizRes.status()).toBe(200);

      // 3. Nộp bài với phương án chưa đạt < 70% để kiểm tra quy tắc BR-03
      const submitRes = await request.post(
        `${BACKEND_URL}/api/v1/quizzes/quiz-mod-01/submit`,
        {
          headers: authHeaders,
          data: {
            attemptId: 'att-9901-uuid',
            answers: [
              { questionId: 'q-101', selectedOption: 'A' },
              { questionId: 'q-102', selectedOption: 'C' },
            ],
          },
        },
      );
      expect([200, 201]).toContain(submitRes.status());

      const submitBody = await submitRes.json();
      const resultData = submitBody.data || submitBody;
      expect(resultData.isPassed).toBe(false);
      expect(
        resultData.recommendation?.suggestedLessons ||
          resultData.suggestedLessons,
      ).toBeDefined();

      // 4. Kiểm tra endpoint lấy gợi ý ôn tập GET /api/v1/quizzes/{id}/retake-suggestions
      const retakeRes = await request.get(
        `${BACKEND_URL}/api/v1/quizzes/quiz-mod-01/retake-suggestions`,
        {
          headers: authHeaders,
        },
      );
      expect(retakeRes.status()).toBe(200);
    },
  );
});