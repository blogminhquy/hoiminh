// Đẩy sự kiện thời gian thực tới trình duyệt (tin nhắn mới, thông báo mới) thay cho việc web hỏi lại mỗi 15 giây.
// Trên Cloudflare: mỗi người dùng một Durable Object giữ WebSocket của mọi tab/thiết bị (apps/api/src/realtime-hub.ts).
// Ở Node và test không có hub: web tự quay về hỏi định kỳ.

/** Sự kiện chỉ báo "có gì mới, tải lại phần này"; không mang nội dung, nên không lộ dữ liệu nếu gửi nhầm. */
export type RealtimeEvent =
  | { type: 'message'; conversationId: string }
  | { type: 'notification' };

export interface RealtimePublisher {
  publish(userIds: string[], event: RealtimeEvent): Promise<void>;
}

/**
 * Giữ sự kiện tới khi transaction commit rồi mới đẩy, giống email: thao tác bị hủy thì không báo
 * "có tin mới" cho thứ không tồn tại, và không giữ kết nối database trong lúc gọi Durable Object.
 */
export class DeferredRealtime implements RealtimePublisher {
  private readonly queue: Array<{ userIds: string[]; event: RealtimeEvent }> = [];
  constructor(private readonly inner: RealtimePublisher) {}
  async publish(userIds: string[], event: RealtimeEvent): Promise<void> {
    if (userIds.length) this.queue.push({ userIds, event });
  }
  async flush(onError: (err: unknown) => void): Promise<void> {
    // Gộp theo người nhận: một transaction tạo 10 thông báo cho cùng người chỉ cần một lần báo.
    const byUser = new Map<string, Map<string, RealtimeEvent>>();
    for (const { userIds, event } of this.queue.splice(0)) {
      for (const id of userIds) {
        const events = byUser.get(id) ?? new Map<string, RealtimeEvent>();
        events.set(JSON.stringify(event), event);
        byUser.set(id, events);
      }
    }
    await Promise.all([...byUser].flatMap(([id, events]) => [...events.values()].map((e) => this.inner.publish([id], e).catch(onError))));
  }
  discard(): void {
    this.queue.length = 0;
  }
}

/** Namespace Durable Object tối thiểu mà bộ phát cần (binding `REALTIME`). */
export interface HubNamespace {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: string | Request, init?: RequestInit): Promise<Response> };
}

/** Bộ phát trên Cloudflare: gửi sự kiện tới hub của từng người nhận (mỗi người một Durable Object). */
export function durableObjectRealtime(ns: HubNamespace): RealtimePublisher {
  return {
    async publish(userIds, event) {
      const body = JSON.stringify(event);
      await Promise.all([...new Set(userIds)].map((id) => ns.get(ns.idFromName(id)).fetch('https://hub/publish', { method: 'POST', body })));
    },
  };
}
