// Dựng App trong Cloudflare Worker, dùng chung cho Worker web + API (hoiminh-api) và Worker chạy nền (hoiminh-jobs).
//
// Không cache App giữa các request: kết nối Postgres là một socket, mà Workers cấm dùng socket mở ở
// request này cho request khác ("Cannot perform I/O on behalf of a different request"). Vì vậy mỗi
// lần gọi dựng App mới: phần ngoài DB chỉ là tạo object, còn postgres-js kết nối lười và Hyperdrive
// giữ sẵn pool ở phía Cloudflare nên bắt tay gần như không tốn gì.
import { loadEnv } from '@hoiminh/config';
import { createApp, type App } from './app';
import { CloudflareQueue, type Job } from './jobs/queue';

/** Phần env của Worker mà App cần: biến/secret dạng chuỗi, hàng đợi job, Hyperdrive. */
export interface WorkerBindings {
  JOBS: { send(body: Job): Promise<void> };
  HYPERDRIVE?: { connectionString: string };
  [key: string]: unknown;
}

export async function createWorkerApp(env: WorkerBindings): Promise<App> {
  const raw: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(env)) if (typeof v === 'string') raw[k] = v;
  // Hyperdrive gộp kết nối phía Cloudflare; không có binding thì dùng thẳng DATABASE_URL (pooler Supabase).
  if (env.HYPERDRIVE?.connectionString) raw.DATABASE_URL = env.HYPERDRIVE.connectionString;
  return createApp({ env: loadEnv(raw), queue: new CloudflareQueue(env.JOBS), migrate: false });
}
