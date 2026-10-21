// Worker hoiminh-api: phục vụ cả giao diện lẫn API ở hoiminh.com (và api.hoiminh.com cho webhook, API key).
// File giao diện do Cloudflare trả thẳng (không chạy code, không tính phí request); chỉ các đường dẫn
// khai báo trong `run_worker_first` của wrangler.toml mới vào đây. Cron và hàng đợi job chạy ở Worker
// hoiminh-jobs (apps/jobs) để việc nặng không làm chậm người đang dùng.
import { createWorkerApp, pickSharedEnv, type WorkerBindings } from '@hoiminh/core';
import { WorkerEntrypoint } from 'cloudflare:workers';
import { createHonoApp } from './app';

/** Durable Object giữ WebSocket thời gian thực của từng người dùng (binding REALTIME). */
export { RealtimeHub } from './realtime-hub';

/**
 * Cho hoiminh-jobs đọc secret của Worker này qua service binding, để secret chỉ phải đặt một chỗ.
 * Entrypoint có tên không nhận request từ Internet: chỉ Worker trong cùng tài khoản khai báo
 * `[[services]] entrypoint = "SharedEnv"` mới gọi được.
 */
export class SharedEnv extends WorkerEntrypoint<WorkerBindings> {
  strings(): Record<string, string> {
    return pickSharedEnv(this.env);
  }
}

export default {
  async fetch(request: Request, env: WorkerBindings, ctx: ExecutionContext): Promise<Response> {
    const app = await createWorkerApp(env);
    const res = await createHonoApp(app).fetch(request, env, ctx);
    ctx.waitUntil(app.close().catch(() => undefined));
    return res;
  },
};
