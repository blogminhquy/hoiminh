// Kết nối thời gian thực (V2): đọc SSE /v1/me/stream bằng fetch để gắn được Bearer token
// (EventSource không đặt được header). Tự nối lại có backoff; khi không nối được thì polling vẫn chạy như cũ.
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, tokens } from './api';
import { useAuth, useBadges } from './auth';

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

export type RealtimeEvent =
  | { type: 'ready'; userId: string; at: string }
  | { type: 'message.new'; conversationId: string; message: RealtimeMessage; senderName: string; preview: string }
  | { type: 'message.read'; conversationId: string; byUserId: string; readAt: string }
  | { type: 'conversation.typing'; conversationId: string; byUserId: string; expiresAt: string }
  | { type: 'notification.new'; notificationId: string; title: string; body: string; link: string | null }
  | { type: 'badges.changed' }
  | { type: 'presence.changed'; userId: string; online: boolean };

type Listener = (event: RealtimeEvent) => void;

interface RealtimeApi {
  /** Đăng ký nhận sự kiện. Trả về hàm hủy: gọi trong cleanup của useEffect. */
  on: (listener: Listener) => () => void;
  /** Luồng đang mở. Màn hình dùng cờ này để giãn nhịp polling. */
  connected: boolean;
}

const RealtimeContext = createContext<RealtimeApi>({ on: () => () => {}, connected: false });

/** Chờ tối đa 30 giây, tăng dần theo số lần hỏng liên tiếp. */
function backoffMs(attempt: number): number {
  return Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5));
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const listeners = useRef(new Set<Listener>());
  const [connected, setConnected] = useState(false);

  const on = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => { listeners.current.delete(listener); };
  }, []);

  useEffect(() => {
    if (!userId) { setConnected(false); return; }
    let stopped = false;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const emit = (event: RealtimeEvent) => {
      for (const listener of [...listeners.current]) {
        try { listener(event); } catch { /* một listener hỏng không được chặn các listener khác */ }
      }
    };

    const run = async () => {
      controller = new AbortController();
      const headers: Record<string, string> = { Accept: 'text/event-stream' };
      const at = tokens.access;
      if (at) headers.Authorization = `Bearer ${at}`;
      const res = await fetch(`${api.url}/v1/me/stream`, { headers, credentials: 'include', signal: controller.signal });
      if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
      attempt = 0;
      setConnected(true);
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        // Mỗi sự kiện SSE kết thúc bằng một dòng trống; phần đuôi chưa đủ thì giữ lại chờ gói sau.
        let sep = buffer.indexOf('\n\n');
        while (sep !== -1) {
          const chunk = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
          if (data) {
            try { emit(JSON.parse(data) as RealtimeEvent); } catch { /* bỏ qua gói hỏng */ }
          }
          sep = buffer.indexOf('\n\n');
        }
      }
    };

    const loop = () => {
      if (stopped) return;
      run()
        .catch(() => {})
        .finally(() => {
          if (stopped) return;
          setConnected(false);
          attempt += 1;
          timer = setTimeout(loop, backoffMs(attempt));
        });
    };
    loop();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      setConnected(false);
    };
  }, [userId]);

  const value = useMemo<RealtimeApi>(() => ({ on, connected }), [on, connected]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

/** Chạy `handler` cho mỗi sự kiện. Handler mới nhất luôn được dùng, không cần thêm vào deps. */
export function useRealtimeEvent(handler: Listener): void {
  const { on } = useContext(RealtimeContext);
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => on((event) => ref.current(event)), [on]);
}

/** Luồng có đang mở không: dùng để giãn nhịp polling dự phòng. */
export function useRealtimeConnected(): boolean {
  return useContext(RealtimeContext).connected;
}

/** Nhịp polling: nhanh khi không có luồng, chậm khi đã có (chỉ để bắt sai lệch hiếm gặp). */
export function usePollInterval(fast = 15_000, slow = 120_000): number {
  return useRealtimeConnected() ? slow : fast;
}

/** Badge tin nhắn/thông báo cập nhật ngay khi có sự kiện; polling chỉ còn là lưới an toàn. */
export function useLiveBadges() {
  const qc = useQueryClient();
  useRealtimeEvent(useCallback((e) => {
    if (e.type === 'badges.changed' || e.type === 'message.new' || e.type === 'notification.new') void qc.invalidateQueries({ queryKey: ['badges'] });
  }, [qc]));
  return useBadges(usePollInterval());
}
