// Lắp ráp AppContext từ env: db, email, media, payments, bus, realtime, queue, logger, handlers.
import type { Env } from '@hoiminh/config';
import { connect, runMigrations, type Database } from '@hoiminh/db';
import { createEmailSender, type EmailMessage } from '@hoiminh/email';
import { createMediaProvider } from '@hoiminh/media';
import { createPaymentRouter } from '@hoiminh/payments';
import { emailLogs } from '@hoiminh/db';
import { LocalAuthProvider, SupabaseAuthProvider, type AuthProvider } from './auth/providers';
import { consoleLogger, type AppContext } from './context';
import { createEventBus } from './events/bus';
import { registerHandlers } from './events/handlers';
import { createJobHandler } from './jobs/handlers';
import { InMemoryQueue, type JobQueue } from './jobs/queue';
import { createRealtimeHub } from './realtime/hub';

export interface CreateAppOptions {
  env: Env;
  db?: Database;
  queue?: JobQueue;
  /** Tự chạy migration khi khởi động (local/test). */
  migrate?: boolean;
  onEmail?: (m: EmailMessage) => void;
}

export interface App {
  ctx: AppContext;
  auth: AuthProvider;
  close: () => Promise<void>;
}

/** Tạo ứng dụng: dùng cho API (Node hoặc Worker), test và CLI. */
export async function createApp(opts: CreateAppOptions): Promise<App> {
  const { env } = opts;
  let close = async () => {};
  let db = opts.db;
  if (!db) {
    const handle = await connect(env.DATABASE_URL);
    if (opts.migrate ?? handle.kind === 'pglite') await runMigrations(handle);
    db = handle.db;
    close = handle.close;
  }
  const log = consoleLogger(env.LOG_LEVEL);
  const email = createEmailSender({
    resendApiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    onLog: (m) => {
      opts.onEmail?.(m);
      void db!.insert(emailLogs).values({ toEmail: m.to, template: m.template, subject: m.subject, status: 'logged' }).catch(() => null);
    },
  });
  const media = createMediaProvider({ r2: { accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET, publicBaseUrl: env.R2_PUBLIC_BASE_URL }, apiUrl: env.API_URL, secret: env.AUTH_JWT_SECRET });
  const payments = createPaymentRouter(env, `${env.API_URL}/pay/simulator`);
  const events = createEventBus((name, err) => log.error('event.handler_failed', { name, err: String(err) }));
  const queue = opts.queue ?? new InMemoryQueue();
  const realtime = createRealtimeHub((err) => log.error('realtime.listener_failed', { err: String(err) }));
  const ctx: AppContext = { db, env, email, media, payments, events, realtime, queue, log, now: () => new Date() };
  if (queue instanceof InMemoryQueue) queue.setHandler(createJobHandler(ctx));
  registerHandlers(ctx);
  const auth: AuthProvider = env.AUTH_PROVIDER === 'supabase' && env.SUPABASE_URL
    ? new SupabaseAuthProvider({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, jwtSecret: env.SUPABASE_JWT_SECRET || env.AUTH_JWT_SECRET })
    : new LocalAuthProvider(db, env.AUTH_JWT_SECRET);
  return { ctx, auth, close };
}
