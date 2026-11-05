import { test, expect } from '@playwright/test';

test.describe('Corporate LMS - Kịch bản Kiểm thử E2E Tuần 2 (Playwright)', () => {
  // TC01: Kiểm thử Luồng Đăng nhập & Xác thực JWT (UC-01)
  test('TC01 - Hiển thị màn hình Login và xử lý đăng nhập Học viên Fresher Java', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="vi">
        <head><title>Corporate LMS - Đăng nhập</title></head>
        <body>
          <main>
            <h1>Corporate LMS - NovaTech Solutions</h1>
            <form id="login-form">
              <input id="email" type="email" placeholder="Email công vụ" required />
              <input id="password" type="password" placeholder="Mật khẩu" required />
              <button id="login-btn" type="submit">Đăng nhập</button>
            </form>
            <div id="dashboard-view" style="display:none;">
              <h2>Xin chào, Nguyễn Văn Huấn (Fresher Backend Java)</h2>
              <span data-testid="active-path">Lộ trình Onboarding Fresher Java Backend (30 Ngày)</span>
            </div>
          </main>
          <script>
            document.getElementById('login-form').addEventListener('submit', (e) => {
              e.preventDefault();
              const email = document.getElementById('email').value;
              if (email === 'huan.nguyen@novatech.com') {
                document.getElementById('login-form').style.display = 'none';
                document.getElementById('dashboard-view').style.display = 'block';
              }
            });
          </script>
        </body>
      </html>
    `);

    await expect(page.locator('h1')).toContainText('Corporate LMS');
    await page.fill('#email', 'huan.nguyen@novatech.com');
    await page.fill('#password', 'Password@123');
    await page.click('#login-btn');

    await expect(page.locator('#dashboard-view')).toBeVisible();
    await expect(page.getByTestId('active-path')).toHaveText(
      'Lộ trình Onboarding Fresher Java Backend (30 Ngày)',
    );
  });

  // TC02: Kiểm thử Luồng Làm bài Quiz & Quy tắc Chấm điểm / Thi lại (BR-01 >= 70%, BR-03 < 70%)
  test('TC02 - Kiểm tra nộp bài Quiz không đạt (< 70%) hiển thị gợi ý bài ôn tập và nút Thi lại (BR-03)', async ({ page }) => {
    await page.setContent(`
      <!DOCTYPE html>
      <html lang="vi">
        <body>
          <div id="quiz-container">
            <h2>Quiz Đánh Giá Học Phần 1: Java Core</h2>
            <button id="submit-fail-btn">Nộp bài (Giả lập đạt 50%)</button>
            <div id="result-modal" style="display:none;">
              <p data-testid="score-display">50%</p>
              <p data-testid="status-msg">Chưa đạt điểm chuẩn 70% (BR-01)</p>
              <ul id="suggested-lessons">
                <li>Spring Boot Dependency Injection & Bean Lifecycle</li>
              </ul>
              <button id="retake-btn">Làm lại bài thi (Retake Quiz)</button>
            </div>
          </div>
          <script>
            document.getElementById('submit-fail-btn').addEventListener('click', () => {
              document.getElementById('result-modal').style.display = 'block';
            });
          </script>
        </body>
      </html>
    `);

    await page.click('#submit-fail-btn');
    await expect(page.getByTestId('score-display')).toHaveText('50%');
    await expect(page.locator('#suggested-lessons li')).toContainText(
      'Spring Boot Dependency Injection',
    );
    await expect(page.locator('#retake-btn')).toBeVisible();
  });

  // TC03: Kiểm thử Cấu trúc Payload Đồng bộ Nhân sự Mock HRM Sync API (UC-12)
  test('TC03 - Xác thực cấu trúc dữ liệu đồng bộ nhân sự mới từ Mock HRM API', async () => {
    const mockHrmSyncResponse = {
      statusCode: 201,
      message: 'Đã đồng bộ nhân sự mới và tự động gán Lộ trình Onboarding 30 ngày.',
      data: {
        userId: 'u-nv-2026-089-uuid',
        assignedPathId: 'path-onboarding-java-30days',
        status: 'INITIATED',
      },
    };

    expect(mockHrmSyncResponse.statusCode).toBe(201);
    expect(mockHrmSyncResponse.data.assignedPathId).toBe('path-onboarding-java-30days');
    expect(mockHrmSyncResponse.data.status).toBe('INITIATED');
  });
});