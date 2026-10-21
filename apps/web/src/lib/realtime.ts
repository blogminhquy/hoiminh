// Kênh thời gian thực: một WebSocket tới /v1/realtime (Durable Object của chính người dùng).
// Có tin nhắn / thông báo mới thì máy chủ báo, web tải lại đúng phần đó. Mất kết nối (hoặc máy chủ chưa
// bật, như khi chạy dev bằng Node) thì các màn tự quay về hỏi định kỳ như trước.
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api';

type RealtimeEvent = { type: 'message'; conversationId: string } | { type: 'notification' };

let connected = false;
const listeners = new Set<() => void>();
function setConnected(v: boolean): void {
  if (connected === v) return;
  connected = v;
  for (const l of listeners) l();
}

/** Kênh thời gian thực đang mở không: đang mở thì không cần hỏi định kỳ. */
export function useRealtimeConnected(): boolean {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => connected, () => false);
}

/** Khoảng hỏi lại cho một màn: tắt khi kênh thời gian thực đang mở, còn không thì như cũ. */
export function usePollInterval(ms: number): number | false {
  return useRealtimeConnected() ? false : ms;
}

/** Đổi một sự kiện thành các phần cần tải lại. */
export function applyRealtimeEvent(qc: QueryClient, e: RealtimeEvent): void {
  void qc.invalidateQueries({ queryKey: ['badges'] });
  if (e.type === 'message') {
    void qc.invalidateQueries({ queryKey: ['thread', e.conversationId] });
    void qc.invalidateQueries({ queryKey: ['conversations'] });
  } else {
    void qc.invalidateQueries({ queryKey: ['notifications'] });
  }
}

export function realtimeUrl(apiUrl: string, origin: string): string {
  return `${(apiUrl || origin).replace(/^http/, 'ws')}/v1/realtime`;
}

/** Mở kênh khi đã đăng nhập; tự kết nối lại với thời gian chờ tăng dần (1 giây tới 1 phút). */
export function useRealtime(enabled: boolean): void {
  const qc = useQueryClient();
  useEffect(() => {
    if (!enabled || typeof WebSocket === 'undefined') return;
    let ws: WebSocket | null = null;
    let stopped = false;
    let delay = 1000;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let ping: ReturnType<typeof setInterval> | undefined;
    const open = () => {
      ws = new WebSocket(realtimeUrl(api.url, window.location.origin));
      ws.onopen = () => {
        delay = 1000;
        setConnected(true);
        // Tải lại một lần khi vừa nối (có thể đã lỡ sự kiện lúc mất kết nối).
        void qc.invalidateQueries({ queryKey: ['badges'] });
        // Giữ kết nối qua proxy và mạng di động; Cloudflare tự trả "pong" mà không đánh thức hub.
        ping = setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send('ping'), 30_000);
      };
      ws.onmessage = (m) => {
        if (m.data === 'pong') return;
        try { applyRealtimeEvent(qc, JSON.parse(String(m.data)) as RealtimeEvent); } catch { /* bỏ qua tin lạ */ }
      };
      ws.onclose = () => {
        setConnected(false);
        clearInterval(ping);
        if (stopped) return;
        retry = setTimeout(open, delay);
        delay = Math.min(delay * 2, 60_000);
      };
    };
    open();
    return () => {
      stopped = true;
      clearTimeout(retry);
      clearInterval(ping);
      ws?.close();
      setConnected(false);
    };
  }, [enabled, qc]);
}
