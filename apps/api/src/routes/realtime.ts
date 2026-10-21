// /v1/realtime: trình duyệt mở WebSocket ở đây để nhận "có tin nhắn / thông báo mới" ngay, thay cho hỏi lại mỗi 15 giây.
// Worker xác thực (cookie phiên) rồi chuyển kết nối sang Durable Object của chính người đó.
import { AppError, type HubNamespace } from '@hoiminh/core';
import { router } from '../lib/hono';
import { trustedOrigins } from '../lib/session-cookie';
import { requireAuth } from '../middleware/auth';

export const realtimeRoutes = router();

realtimeRoutes.get('/', requireAuth, async (c) => {
  const actor = c.get('ctx').actor;
  if (actor.type !== 'user') throw new AppError('forbidden', 'Kênh thời gian thực chỉ dành cho người dùng đăng nhập trên web');
  // Chặn trang lạ mở WebSocket bằng cookie của người dùng (cross-site WebSocket hijacking).
  const origin = c.req.header('origin');
  if (origin && !trustedOrigins(c).has(origin)) throw new AppError('forbidden', 'Yêu cầu không đến từ trang Hội Mình');
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') return c.json({ code: 'upgrade_required', message: 'Cần kết nối WebSocket' }, 426);
  const ns = (c.env as { REALTIME?: HubNamespace } | undefined)?.REALTIME;
  // Node (dev) và test không có Durable Object: web tự quay về hỏi định kỳ.
  if (!ns) throw new AppError('invalid_state', 'Máy chủ này chưa bật kênh thời gian thực', 501);
  return ns.get(ns.idFromName(actor.userId)).fetch(c.req.raw);
});
