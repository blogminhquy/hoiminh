// Lắp ráp AppContext từ env: db, email, media, payments, bus, queue, logger, handlers.
import type { Env } from '@hoiminh/config';
import { connect, runMigrations, type Database } from '@hoiminh/db';
import { RecordingSender, SwitchableSender, createEmailSender, type EmailMessage } from '@hoiminh/email';
import { createMediaProvider, type R2BucketLike } from '@hoiminh/media';
import { createPaymentRouter } from '@hoiminh/payments';
import { emailLogs } from '@hoiminh/db';
import { LocalAuthProvider, SupabaseAuthProvider, type AuthProvider } from './auth/providers';
import { consoleLogger, type AppContext } from './context';
import { createEventBus } from './events/bus';
import { registerHandlers } from './events/handlers';
import { createJobHandler } from './jobs/handlers';
import { InMemoryQueue, type JobQueue } from './jobs/queue';
import { loadInfra, mergeInfraEnv } from './lib/infra-settings';

export interface CreateAppOptions {
  env: Env;
  db?: Database;
  queue?: JobQueue;
  /** Tự chạy migration khi khởi động (local/test). */
  migrate?: boolean;
  onEmail?: (m: EmailMessage) => void;
  /** Binding R2 của Worker (`FILES`): có nó thì tệp lên R2 mà không cần secret R2_*. */
  r2Bucket?: R2BucketLike | null;
}

export interface App {
  ctx: AppContext;
  auth: AuthProvider;
  close: () => Promise<void>;
}

/** Tạo ứng dụng: dùng cho API (Node hoặc Worker), test và CLI. */
export async function createApp(opts: CreateAppOptions): Promise<App> {
  const base = opts.env;
  let close = async () => {};
  let db = opts.db;
  if (!db) {
    const handle = await connect(base.DATABASE_URL);
    if (opts.migrate ?? handle.kind === 'pglite') await runMigrations(handle);
    db = handle.db;
    close = handle.close;
  }
  const log = consoleLogger(base.LOG_LEVEL);
  // Khóa nhập ở Hệ thống · Hạ tầng được ưu tiên hơn secret của Worker. `env` là object riêng của App này:
  // lưu khóa mới thì infra.apply ghi đè tại chỗ để mọi nơi đang giữ ctx.env thấy ngay.
  const env = mergeInfraEnv(base, (await loadInfra(db, base, log)).values);
  const makeSender = () => createEmailSender({ resendApiKey: env.RESEND_API_KEY, from: env.EMAIL_FROM, onLog: (m) => opts.onEmail?.(m) });
  const switchable = new SwitchableSender(makeSender());
  // Mọi lần gửi (Resend hay log) đều ghi vào email_logs kèm kết quả, để quản trị thấy email
  // có đi thật không thay vì đoán. Ghi bằng kết nối gốc và không chờ (xem RecordingSender);
  // close() chờ flush để Worker không đóng kết nối khi dòng nhật ký chưa ghi xong.
  const rootDb = db;
  const email = new RecordingSender(
    switchable,
    async (m, r) => {
      await rootDb.insert(emailLogs).values({ toEmail: m.to, template: m.template, subject: m.subject, status: r.status, providerMessageId: r.providerMessageId ?? null, error: r.error ?? null });
    },
  );
  const media = createMediaProvider({ r2: { accountId: env.R2_ACCOUNT_ID, accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, bucket: env.R2_BUCKET, publicBaseUrl: env.R2_PUBLIC_BASE_URL }, r2Bucket: opts.r2Bucket ?? null, apiUrl: env.API_URL, secret: env.AUTH_JWT_SECRET });
  const payments = createPaymentRouter(env, `${env.API_URL}/pay/simulator`);
  const events = createEventBus((name, err) => log.error('event.handler_failed', { name, err: String(err) }));
  const queue = opts.queue ?? new InMemoryQueue();
  const infra = {
    base,
    apply: (values: Parameters<typeof mergeInfraEnv>[1]) => {
      Object.assign(env, mergeInfraEnv(base, values));
      switchable.use(makeSender());
    },
  };
  const ctx: AppContext = { db, env, email, media, payments, events, queue, log, now: () => new Date(), infra };
  if (queue instanceof InMemoryQueue) queue.setHandler(createJobHandler(ctx));
  registerHandlers(ctx);
  const auth: AuthProvider = env.AUTH_PROVIDER === 'supabase' && env.SUPABASE_URL
    ? new SupabaseAuthProvider({ url: env.SUPABASE_URL, anonKey: env.SUPABASE_ANON_KEY, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY, jwtSecret: env.SUPABASE_JWT_SECRET || env.AUTH_JWT_SECRET })
    : new LocalAuthProvider(db, env.AUTH_JWT_SECRET);
  return { ctx, auth, close: async () => { await email.flush(); await close(); } };
}
