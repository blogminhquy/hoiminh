// Hub thời gian thực (V2): đẩy sự kiện tới các phiên đang mở của từng người dùng và theo dõi ai đang online.
// Trong tiến trình — đủ cho một node API. Nhiều node cần một hub phân tán (xem DECISIONS.md mục Tin nhắn thời gian thực).

/** Sự kiện đẩy xuống trình duyệt. Tên đặt theo miền để client chỉ xử lý cái mình quan tâm. */
export type RealtimeEvent =
  | { type: 'message.new'; conversationId: string; message: RealtimeMessage; senderName: string; preview: string }
  | { type: 'message.read'; conversationId: string; byUserId: string; readAt: string }
  | { type: 'conversation.typing'; conversationId: string; byUserId: string; expiresAt: string }
  | { type: 'notification.new'; notificationId: string; title: string; body: string; link: string | null }
  | { type: 'badges.changed' }
  | { type: 'presence.changed'; userId: string; online: boolean };

export interface RealtimeMessage {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  imageUrl: string | null;
  automated: boolean;
  readAt: string | null;
  createdAt: string;
}

export type RealtimeListener = (event: RealtimeEvent) => void;

export interface RealtimeHub {
  /** Mở một phiên cho người dùng. Gọi hàm trả về để đóng. */
  subscribe(userId: string, listener: RealtimeListener): () => void;
  /** Đẩy sự kiện tới mọi phiên của những người dùng này (bỏ qua id trùng và người không online). */
  publish(userIds: readonly string[], event: RealtimeEvent): void;
  /** Có ít nhất một phiên đang mở. */
  isOnline(userId: string): boolean;
  /** Lọc ra những người đang online trong danh sách. */
  onlineAmong(userIds: readonly string[]): string[];
  /** Số phiên đang mở (mọi người dùng) — dùng cho /health và test. */
  connectionCount(): number;
}

/** Hub trong bộ nhớ. Lỗi của một listener không chặn các listener còn lại. */
export function createRealtimeHub(onError: (err: unknown) => void = (e) => console.error('[realtime]', e)): RealtimeHub {
  const sessions = new Map<string, Set<RealtimeListener>>();

  const announcePresence = (userId: string, online: boolean) => {
    // Người đang trò chuyện với userId cũng cần biết; hub không biết quan hệ nên phát cho tất cả phiên đang mở.
    const event: RealtimeEvent = { type: 'presence.changed', userId, online };
    for (const [uid, set] of sessions) {
      if (uid === userId) continue;
      for (const listener of set) {
        try {
          listener(event);
        } catch (err) {
          onError(err);
        }
      }
    }
  };

  return {
    subscribe(userId, listener) {
      let set = sessions.get(userId);
      const first = !set || set.size === 0;
      if (!set) {
        set = new Set();
        sessions.set(userId, set);
      }
      set.add(listener);
      if (first) announcePresence(userId, true);
      let closed = false;
      return () => {
        if (closed) return;
        closed = true;
        const current = sessions.get(userId);
        if (!current) return;
        current.delete(listener);
        if (current.size === 0) {
          sessions.delete(userId);
          announcePresence(userId, false);
        }
      };
    },
    publish(userIds, event) {
      for (const userId of new Set(userIds)) {
        for (const listener of sessions.get(userId) ?? []) {
          try {
            listener(event);
          } catch (err) {
            onError(err);
          }
        }
      }
    },
    isOnline(userId) {
      return (sessions.get(userId)?.size ?? 0) > 0;
    },
    onlineAmong(userIds) {
      return [...new Set(userIds)].filter((id) => (sessions.get(id)?.size ?? 0) > 0);
    },
    connectionCount() {
      let n = 0;
      for (const set of sessions.values()) n += set.size;
      return n;
    },
  };
}
