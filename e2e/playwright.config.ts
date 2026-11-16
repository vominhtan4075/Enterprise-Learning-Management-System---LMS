import { defineConfig } from '@playwright/test';

const backendUrl = process.env.BACKEND_URL || 'http://localhost:3000';

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
    baseURL: backendUrl,
    extraHTTPHeaders: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'node dist/main.js',
    cwd: '../backend',
    url: `${backendUrl}/api/v1/health`,
    timeout: 60000,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      NODE_ENV: 'development',
      PORT: '3000',
      DATABASE_URL:
        process.env.DATABASE_URL ??
        'postgresql://lms_user:lms_password@localhost:5432/corporate_lms?schema=public',
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      JWT_SECRET:
        process.env.JWT_SECRET ??
        'novatech_lms_super_secret_jwt_key_2026_min_32_chars',
      JWT_EXPIRES_IN: '86400',
      HRM_API_KEY: process.env.HRM_API_KEY ?? 'hrm-secret-api-key-2026',
      CORS_ORIGINS: 'http://localhost:3000,http://localhost:3001',
    },
  },
});