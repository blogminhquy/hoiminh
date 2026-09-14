// pnpm db:migrate — áp dụng migration lên DATABASE_URL (hoặc DATABASE_DIRECT_URL nếu có).
import { connect } from '../client';
import { runMigrations } from '../migrate';
import { loadCliEnv } from './env';

const env = loadCliEnv();
const url = env.DATABASE_DIRECT_URL || env.DATABASE_URL;
const handle = await connect(url);
await runMigrations(handle);
console.log(`✔ Migration xong (${handle.kind}) → ${url.startsWith('pglite') ? url : url.replace(/:[^:@/]+@/, ':***@')}`);
await handle.close();
