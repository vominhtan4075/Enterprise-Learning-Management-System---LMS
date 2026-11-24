import { expect, request as playwrightRequest, test } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3000';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'Password123!';

test.describe('Corporate LMS E2E - Dashboard Admin & Báo cáo Thống kê (Tuần 4)', () => {
  let adminToken = '';
  let employeeToken = '';

  test.beforeAll(async () => {
    // Tạo context API riêng để lấy JWT 1 lần cho cả suite, tránh vượt rate-limit 10 lần/phút của /auth/login
    const api = await playwrightRequest.newContext({ baseURL: BACKEND_URL });

    try {
      const adminLoginRes = await api.post('/api/v1/auth/login', {
        data: {
          email: 'admin@novatech.com',
          password: DEMO_PASSWORD,
        },
      });
      expect(adminLoginRes.status()).toBe(200);
      const adminBody = await adminLoginRes.json();
      expect(adminBody.accessToken).toBeTruthy();
      adminToken = adminBody.accessToken;

      const employeeLoginRes = await api.post('/api/v1/auth/login', {
        data: {
          email: 'huan.nguyen@novatech.com',
          password: DEMO_PASSWORD,
        },
      });
      expect(employeeLoginRes.status()).toBe(200);
      const employeeBody = await employeeLoginRes.json();
      expect(employeeBody.accessToken).toBeTruthy();
      employeeToken = employeeBody.accessToken;
    } finally {
      await api.dispose();
    }
  });

  test('TC07 - [UAT-SEC-02] Phân quyền Báo cáo & HRM: chặn chưa đăng nhập (401), chặn EMPLOYEE (403) và cho phép xem phạm vi cá nhân (200)', async ({
    request,
  }) => {
    // 1. Không gửi Bearer token -> phải bị chặn bằng 401 Unauthorized
    const unauthRes = await request.get(`${BACKEND_URL}/api/v1/reports/completion`);
    expect(unauthRes.status()).toBe(401);

    // 2. Vai trò EMPLOYEE gọi các API quản trị -> phải bị chặn bằng 403 Forbidden
    const restrictedEndpoints = [
      '/api/v1/reports/completion',
      '/api/v1/reports/quiz-scores',
      '/api/v1/reports/competency-matrix',
      '/api/v1/reports/competency-matrix/export',
      '/api/v1/hrm/sync-logs',
    ];

    for (const endpoint of restrictedEndpoints) {
      const res = await request.get(`${BACKEND_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${employeeToken}` },
      });
      expect(
        res.status(),
        `EMPLOYEE phải nhận HTTP 403 khi gọi ${endpoint}`,
      ).toBe(403);
    }

    // 3. Vai trò EMPLOYEE vẫn xem được Dashboard cá nhân & Hồ sơ năng lực của chính mình (HTTP 200)
    const empDashboardRes = await request.get(`${BACKEND_URL}/api/v1/reports/dashboard`, {
      headers: { Authorization: `Bearer ${employeeToken}` },
    });
    expect(empDashboardRes.status()).toBe(200);

    const empCompetencyRes = await request.get(
      `${BACKEND_URL}/api/v1/reports/competency-matrix/me`,
      {
        headers: { Authorization: `Bearer ${employeeToken}` },
      },
    );
    expect(empCompetencyRes.status()).toBe(200);
    const empCompetency = await empCompetencyRes.json();
    expect(Array.isArray(empCompetency.competencies)).toBe(true);
  });

  test('TC08 - [UAT-REP-01] Admin xem Dashboard, Báo cáo tỷ lệ hoàn thành, Điểm Quiz và xuất file Excel (.xlsx)', async ({
    request,
  }) => {
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // 1. Dashboard thống kê theo vai trò Admin
    const dashboardRes = await request.get(`${BACKEND_URL}/api/v1/reports/dashboard`, {
      headers: authHeaders,
    });
    expect(dashboardRes.status()).toBe(200);
    const dashboard = await dashboardRes.json();
    expect(dashboard).toBeTruthy();

    // 2. Báo cáo tỷ lệ hoàn thành đào tạo
    const completionRes = await request.get(`${BACKEND_URL}/api/v1/reports/completion`, {
      headers: authHeaders,
    });
    expect(completionRes.status()).toBe(200);
    const completion = await completionRes.json();
    expect(completion).toHaveProperty('summary');
    expect(Array.isArray(completion.byDepartment)).toBe(true);
    expect(Array.isArray(completion.byEmployee)).toBe(true);

    // 3. Báo cáo điểm trung bình và tỷ lệ đạt Quiz
    const quizScoresRes = await request.get(`${BACKEND_URL}/api/v1/reports/quiz-scores`, {
      headers: authHeaders,
    });
    expect(quizScoresRes.status()).toBe(200);
    const quizScores = await quizScoresRes.json();
    expect(typeof quizScores.totalQuizzes).toBe('number');
    expect(typeof quizScores.totalAttempts).toBe('number');
    expect(Array.isArray(quizScores.quizzes)).toBe(true);

    // 4. Xuất file Excel (.xlsx) Ma trận Năng lực và kiểm tra header + chữ ký nhị phân PK
    const exportRes = await request.get(
      `${BACKEND_URL}/api/v1/reports/competency-matrix/export`,
      { headers: authHeaders },
    );
    expect(exportRes.status()).toBe(200);

    const contentType = exportRes.headers()['content-type'] || '';
    const contentDisposition = exportRes.headers()['content-disposition'] || '';
    expect(contentType).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(contentDisposition).toContain('attachment;');
    expect(contentDisposition).toContain('.xlsx');

    const fileBuffer = await exportRes.body();
    expect(fileBuffer.byteLength).toBeGreaterThan(100);
    // File .xlsx thực chất là định dạng nén ZIP nên 2 byte đầu luôn là 0x50 0x4B ("PK")
    expect(fileBuffer[0]).toBe(0x50);
    expect(fileBuffer[1]).toBe(0x4b);
  });

  test('TC09 - [UAT-REP-02] Admin truy xuất Ma trận Năng lực (/reports/competency-matrix) và xác nhận các alias cũ đã được dọn (404)', async ({
    request,
  }) => {
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // 1. Route chuẩn duy nhất của Ma trận Năng lực (dữ liệu bọc trong .data, có kèm data.matrix cho Frontend)
    const matrixRes = await request.get(
      `${BACKEND_URL}/api/v1/reports/competency-matrix`,
      { headers: authHeaders },
    );
    expect(matrixRes.status()).toBe(200);
    const matrix = await matrixRes.json();
    expect(matrix.success).toBe(true);
    expect(Array.isArray(matrix.data?.skills)).toBe(true);
    expect(Array.isArray(matrix.data?.employees)).toBe(true);
    expect(Array.isArray(matrix.data?.matrix)).toBe(true);

    // 2. Kiểm tra bộ lọc position (chấp nhận cả chữ hoa/thường)
    const filteredRes = await request.get(
      `${BACKEND_URL}/api/v1/reports/competency-matrix?position=FRESHER`,
      { headers: authHeaders },
    );
    expect(filteredRes.status()).toBe(200);

    // 3. Các endpoint trùng chức năng đã được dọn phải trả về 404
    const removedAliasRes = await request.get(`${BACKEND_URL}/api/v1/reports/competency`, {
      headers: authHeaders,
    });
    expect(removedAliasRes.status()).toBe(404);

    const removedCompetencyRes = await request.get(`${BACKEND_URL}/api/v1/competency/matrix`, {
      headers: authHeaders,
    });
    expect(removedCompetencyRes.status()).toBe(404);
  });

  test('TC10 - [UAT-HRM-01] Admin xem nhật ký đồng bộ HRM (sync-logs, chi tiết) và trạng thái đào tạo (training-status)', async ({
    request,
  }) => {
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // 1. Lấy danh sách lịch sử đồng bộ HRM có phân trang
    const logsRes = await request.get(
      `${BACKEND_URL}/api/v1/hrm/sync-logs?page=1&limit=10`,
      { headers: authHeaders },
    );
    expect(logsRes.status()).toBe(200);
    const logsBody = await logsRes.json();
    expect(Array.isArray(logsBody.data)).toBe(true);
    expect(typeof logsBody.total).toBe('number');
    expect(logsBody.page).toBe(1);

    // 2. Nếu có bản ghi log (được tạo từ các kịch bản sync trước đó), kiểm tra luôn API xem chi tiết theo ID
    if (logsBody.data.length > 0) {
      const firstLogId = logsBody.data[0].id;
      const detailRes = await request.get(
        `${BACKEND_URL}/api/v1/hrm/sync-logs/${firstLogId}`,
        { headers: authHeaders },
      );
      expect(detailRes.status()).toBe(200);
      const detailBody = await detailRes.json();
      expect(detailBody.id).toBe(firstLogId);
    }

    // 3. Kiểm tra API trạng thái đào tạo trả ngược cho HRM
    const trainingRes = await request.get(
      `${BACKEND_URL}/api/v1/hrm/training-status?page=1&limit=5`,
      { headers: authHeaders },
    );
    expect(trainingRes.status()).toBe(200);
    const trainingBody = await trainingRes.json();
    expect(trainingBody).toBeTruthy();
  });
});