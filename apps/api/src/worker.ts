// Worker hoiminh-api: phục vụ cả giao diện lẫn API ở hoiminh.com (và api.hoiminh.com cho webhook, API key).
// File giao diện do Cloudflare trả thẳng (không chạy code, không tính phí request); chỉ các đường dẫn
// khai báo trong `run_worker_first` của wrangler.toml mới vào đây. Cron và hàng đợi job chạy ở Worker
// hoiminh-jobs (apps/jobs) để việc nặng không làm chậm người đang dùng.
import { createWorkerApp, type WorkerBindings } from '@hoiminh/core';
import { createHonoApp } from './app';

export default {
  async fetch(request: Request, env: WorkerBindings, ctx: ExecutionContext): Promise<Response> {
    const app = await createWorkerApp(env);
    const res = await createHonoApp(app).fetch(request, env, ctx);
    ctx.waitUntil(app.close().catch(() => undefined));
    return res;
  },
};
