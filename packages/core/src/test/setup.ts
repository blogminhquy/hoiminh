// Khởi tạo app test: PGlite trong bộ nhớ, migration + seed, email ghi log, hàng đợi in-memory.
import { loadEnv } from '@hoiminh/config';
import { connect, runMigrations } from '@hoiminh/db';
import { seedAll, sid } from '@hoiminh/db/seed';
import type { EmailMessage } from '@hoiminh/email';
import { createApp, type App } from '../app';
import type { Ctx } from '../context';
import { InMemoryQueue } from '../jobs/queue';

export interface TestApp extends App {
  emails: EmailMessage[];
  queue: InMemoryQueue;
  as: (userKey: 'admin' | 'minhquy' | 'hoangvu' | 'hongkim' | 'kienbui' | 'dien' | 'duy' | 'cong' | 'thulan' | 'member1' | 'member2') => Promise<Ctx>;
  anon: () => Ctx;
  system: () => Ctx;
  ids: typeof sid;
}

/** Tạo app test mới với dữ liệu seed. */
export async function createTestApp(): Promise<TestApp> {
  const env = loadEnv({ APP_ENV: 'test', DATABASE_URL: 'pglite://memory', AUTH_JWT_SECRET: 'test-secret-test-secret-test-secret', ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' });
  const handle = await connect(env.DATABASE_URL);
  await runMigrations(handle);
  await seedAll(handle.db, { encryptionKey: env.ENCRYPTION_KEY, appUrl: env.APP_URL });
  const emails: EmailMessage[] = [];
  const queue = new InMemoryQueue();
  const app = await createApp({ env, db: handle.db, queue, onEmail: (m) => emails.push(m) });
  const close = app.close;
  const emailsByKey = new Map<string, string>([['admin', 'admin@hoiminh.vn'], ['minhquy', 'minhquy@gmail.com'], ['hoangvu', 'hoangvu@gmail.com'], ['hongkim', 'kimhong.hn@gmail.com'], ['kienbui', 'kienbui@gmail.com'], ['dien', 'ngocdien1221@gmail.com'], ['duy', 'duynguyen@gmail.com'], ['cong', 'congtran@gmail.com'], ['thulan', 'thulan@gmail.com'], ['member1', 'an.nguyen@example.com'], ['member2', 'bao.tran@example.com']]);
  return {
    ...app,
    emails,
    queue,
    ids: sid,
    close: async () => {
      await close();
      await handle.close();
    },
    as: async (key) => ({ ...app.ctx, actor: { type: 'user', userId: await sid(`user:${key}`), isSuperAdmin: key === 'admin', email: emailsByKey.get(key)! }, requestId: `test-${key}` }),
    anon: () => ({ ...app.ctx, actor: { type: 'anonymous' }, requestId: 'test-anon' }),
    system: () => ({ ...app.ctx, actor: { type: 'system' }, requestId: 'test-system' }),
  };
}
