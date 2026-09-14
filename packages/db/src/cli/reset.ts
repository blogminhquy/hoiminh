// pnpm db:reset — xóa dữ liệu PGlite local rồi migrate + seed lại. Không dùng cho PostgreSQL thật.
import { rmSync } from 'node:fs';
import { connect } from '../client';
import { runMigrations } from '../migrate';
import { seedAll } from '../seed';
import { loadCliEnv } from './env';

const env = loadCliEnv();
if (!env.DATABASE_URL.startsWith('pglite://')) {
  console.error('db:reset chỉ dùng cho PGlite local. Với PostgreSQL hãy tự drop schema.');
  process.exit(1);
}
const dir = env.DATABASE_URL.slice('pglite://'.length);
rmSync(dir, { recursive: true, force: true });
const handle = await connect(env.DATABASE_URL);
await runMigrations(handle);
const summary = await seedAll(handle.db, { encryptionKey: env.ENCRYPTION_KEY, appUrl: env.APP_URL });
console.log('✔ Reset xong:', summary);
await handle.close();
