// Trước khi chạy: xóa và tạo lại PGlite e2e (migrate + seed) bằng lệnh db:reset với DATABASE_URL riêng.
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { E2E_ENV } from './playwright.config';

export default function globalSetup(): void {
  const root = resolve(__dirname, '..');
  execSync('pnpm --filter @hoiminh/db reset', { cwd: root, stdio: 'inherit', env: { ...process.env, ...E2E_ENV } });
}
