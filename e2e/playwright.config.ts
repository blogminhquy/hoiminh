// Playwright: server API tự reset PGlite riêng (.data/e2e: migrate + seed) rồi chạy (8787, APP_ENV=test), web ở 5173; 7 luồng chạy tuần tự.
import { defineConfig, devices } from '@playwright/test';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const E2E_DB = `pglite://${resolve(root, '.data', 'e2e').replace(/\\/g, '/')}`;
export const E2E_ENV = {
  APP_ENV: 'test',
  DATABASE_URL: E2E_DB,
  AUTH_PROVIDER: 'local',
  AUTH_JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-32',
  ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  APP_URL: 'http://localhost:5173',
  API_URL: 'http://localhost:8787',
  API_PORT: '8787',
  SEPAY_API_KEY: 'sepay-sandbox-key',
  MOMO_ACCESS_KEY: 'momo-access',
  MOMO_SECRET_KEY: 'momo-secret',
  VNPAY_TMN_CODE: 'VNPTEST',
  VNPAY_HASH_SECRET: 'vnpay-secret',
  LOG_LEVEL: 'warn',
};

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure', locale: 'vi-VN', ...devices['Desktop Chrome'] },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    { command: 'pnpm --filter @hoiminh/db reset && pnpm --filter @hoiminh/api dev', url: 'http://localhost:8787/health', cwd: root, env: E2E_ENV, timeout: 180_000, reuseExistingServer: false, stdout: 'ignore', stderr: 'pipe' },
    { command: 'pnpm --filter @hoiminh/web dev', url: 'http://localhost:5173', cwd: root, env: { VITE_API_URL: 'http://localhost:8787', VITE_APP_URL: 'http://localhost:5173' }, timeout: 180_000, reuseExistingServer: false, stdout: 'ignore', stderr: 'pipe' },
  ],
});
