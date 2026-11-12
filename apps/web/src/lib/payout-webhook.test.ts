import { describe, expect, it } from 'vitest';
import { WEBHOOK_POLL_MS, webhookLink, webhookPollMs } from './payout-webhook';

describe('trạng thái nối dịch vụ báo có của chủ hội', () => {
  it('chưa cài tài khoản hoặc tự bấm xác nhận thì không có gì để nối, không hỏi lại máy chủ', () => {
    expect(webhookLink(null)).toBe('off');
    expect(webhookLink(undefined)).toBe('off');
    expect(webhookLink({ confirmMode: 'manual', lastWebhookAt: null })).toBe('off');
    // Từng nối rồi quay về tự bấm: vẫn là tắt.
    expect(webhookLink({ confirmMode: 'manual', lastWebhookAt: '2026-11-12T03:00:00.000Z' })).toBe('off');
    expect(webhookPollMs(null)).toBe(false);
    expect(webhookPollMs({ confirmMode: 'manual', lastWebhookAt: null })).toBe(false);
  });

  it('tự xác nhận mà chưa có lần báo có nào thì đang chờ và tự hỏi lại', () => {
    const a = { confirmMode: 'auto' as const, lastWebhookAt: null };
    expect(webhookLink(a)).toBe('waiting');
    expect(webhookPollMs(a)).toBe(WEBHOOK_POLL_MS);
  });

  it('đã nhận một lần báo có thì là đã nối và thôi hỏi lại', () => {
    const a = { confirmMode: 'auto' as const, lastWebhookAt: '2026-11-12T03:00:00.000Z' };
    expect(webhookLink(a)).toBe('connected');
    expect(webhookPollMs(a)).toBe(false);
  });
});
