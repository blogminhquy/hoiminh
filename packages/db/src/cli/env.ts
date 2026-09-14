// Đọc .env ở gốc monorepo cho các lệnh CLI của packages/db.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv, type Env } from '@hoiminh/config';

/** Nạp .env (nếu có) rồi trả về Env đã validate. Đường dẫn PGlite tương đối được neo về gốc repo. */
export function loadCliEnv(): Env {
  const root = resolve(process.cwd(), '..', '..');
  const envPath = resolve(root, '.env');
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m || m[1] === undefined) continue;
      if (process.env[m[1]] === undefined) process.env[m[1]] = (m[2] ?? '').replace(/^"(.*)"$/, '$1');
    }
  }
  const env = loadEnv(process.env);
  if (env.DATABASE_URL.startsWith('pglite://./')) {
    env.DATABASE_URL = 'pglite://' + resolve(root, env.DATABASE_URL.slice('pglite://'.length));
  }
  return env;
}
