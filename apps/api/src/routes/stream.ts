// Luồng thời gian thực (V2): SSE một chiều máy chủ → trình duyệt cho tin nhắn, biên nhận đã đọc, đang gõ, thông báo.
// Gửi tin vẫn đi bằng POST thường. Dùng SSE thay WebSocket để giữ được middleware xác thực Bearer sẵn có.
import type { RealtimeEvent } from '@hoiminh/core';
import { messaging, requireUser } from '@hoiminh/core';
import { body, parse, router } from '../lib/hono';
import { requireAuth } from '../middleware/auth';
import { z } from 'zod';

/** Nhịp giữ kết nối: proxy thường đóng luồng im lặng sau 30-60 giây. */
const HEARTBEAT_MS = 25_000;

export const streamRoutes = router();
streamRoutes.use('*', requireAuth);

streamRoutes.get('/stream', (c) => {
  const ctx = c.get('ctx');
  const userId = requireUser(ctx);
  const encoder = new TextEncoder();
  let unsubscribe = () => {};
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          /* luồng đã đóng */
        }
      };

      // `retry` bảo trình duyệt chờ 3 giây trước khi nối lại; `ready` để client biết đã sẵn sàng.
      write(`retry: 3000\n\n`);
      write(sse({ type: 'ready', userId, at: new Date().toISOString() }));

      unsubscribe = ctx.realtime.subscribe(userId, (event: RealtimeEvent) => write(sse(event)));
      heartbeat = setInterval(() => write(`: ping\n\n`), HEARTBEAT_MS);
      c.req.raw.signal.addEventListener('abort', cleanup);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
      unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // Tắt buffer của nginx, nếu không sự kiện sẽ bị gom lại và mất tính thời gian thực.
      'X-Accel-Buffering': 'no',
    },
  });
});

/** Báo "đang gõ": client gửi lại tối đa mỗi vài giây trong lúc người dùng gõ. */
streamRoutes.post('/conversations/:id/typing', async (c) => c.json(await messaging.setTyping(c.get('ctx'), c.req.param('id'))));

/** Đánh dấu đã đọc mà không cần tải lại cả luồng tin. */
streamRoutes.post('/conversations/:id/read', async (c) => c.json(await messaging.markConversationRead(c.get('ctx'), c.req.param('id'))));

/** Ai trong danh sách đang mở luồng: dùng cho chấm xanh khi tải trang lần đầu. */
streamRoutes.post('/presence', async (c) => {
  const input = await parse(z.object({ userIds: z.array(z.string().uuid()).max(200) }), await body(c));
  return c.json({ online: c.get('ctx').realtime.onlineAmong(input.userIds) });
});

/** Một sự kiện SSE: `event:` để client lọc theo loại, `data:` là JSON một dòng. */
function sse(payload: { type: string } & Record<string, unknown>): string {
  return `event: ${payload.type}\ndata: ${JSON.stringify(payload)}\n\n`;
}
