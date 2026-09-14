// pnpm db:seed — nạp dữ liệu mẫu khớp bản demo thiết kế.
import { connect } from '../client';
import { runMigrations } from '../migrate';
import { seedAll } from '../seed';
import { loadCliEnv } from './env';

const env = loadCliEnv();
const handle = await connect(env.DATABASE_DIRECT_URL || env.DATABASE_URL);
await runMigrations(handle);
const summary = await seedAll(handle.db, { encryptionKey: env.ENCRYPTION_KEY, appUrl: env.APP_URL });
console.log('✔ Seed xong:', summary);
await handle.close();
