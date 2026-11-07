import { defineConfig } from '@playwright/test';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const BACKEND_PORT = new URL(BACKEND_URL).port || '5000';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  use: {
    baseURL: BACKEND_URL,
    extraHTTPHeaders: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    trace: 'on-first-retry',
  },
  // Tự khởi động Backend thật (cần đã `npm run build` ở thư mục backend và có DATABASE_URL).
  // Ở máy local: nếu đang chạy sẵn `npm run start:dev` ở cổng 5000 thì Playwright dùng lại server đó.
  webServer: {
    command: 'npm run start:prod',
    cwd: '../backend',
    url: `${BACKEND_URL}/api/v1/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: { PORT: BACKEND_PORT },
  },
});