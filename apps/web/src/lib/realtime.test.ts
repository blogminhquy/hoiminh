// Kênh thời gian thực phía web: sự kiện nào tải lại phần nào, và địa chỉ WebSocket theo môi trường.
import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import { applyRealtimeEvent, realtimeUrl } from './realtime';

function invalidated(qc: QueryClient, run: () => void): string[] {
  const keys: string[] = [];
  const orig = qc.invalidateQueries.bind(qc);
  qc.invalidateQueries = ((f?: { queryKey?: unknown[] }) => { keys.push(JSON.stringify(f?.queryKey)); return orig(f as never); }) as typeof qc.invalidateQueries;
  run();
  return keys;
}

describe('kênh thời gian thực', () => {
  it('tin nhắn mới tải lại số chưa đọc, đúng hội thoại và danh sách hội thoại', () => {
    const qc = new QueryClient();
    expect(invalidated(qc, () => applyRealtimeEvent(qc, { type: 'message', conversationId: 'c1' })).sort()).toEqual(['["badges"]', '["conversations"]', '["thread","c1"]'].sort());
  });

  it('thông báo mới tải lại số chưa đọc và danh sách thông báo', () => {
    const qc = new QueryClient();
    expect(invalidated(qc, () => applyRealtimeEvent(qc, { type: 'notification' })).sort()).toEqual(['["badges"]', '["notifications"]']);
  });

  it('production dùng cùng tên miền (wss), dev dùng API ở cổng riêng (ws)', () => {
    expect(realtimeUrl('', 'https://hoiminh.com')).toBe('wss://hoiminh.com/v1/realtime');
    expect(realtimeUrl('http://localhost:8787', 'http://localhost:5173')).toBe('ws://localhost:8787/v1/realtime');
  });
});
