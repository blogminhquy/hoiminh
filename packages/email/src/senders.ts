// Hai bộ gửi: Resend (API HTTP) và Log (dev/test, ghi ra console và callback).
import type { EmailMessage, EmailSender, EmailSendResult } from './types';

/** Gửi qua Resend bằng fetch, không cần SDK. */
export class ResendSender implements EmailSender {
  constructor(private readonly apiKey: string, private readonly from: string) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, html: message.html, text: message.text, reply_to: message.replyTo }),
      });
      if (!res.ok) return { status: 'failed', error: `Resend ${res.status}: ${await res.text()}` };
      const data = (await res.json()) as { id?: string };
      return { status: 'sent', providerMessageId: data.id };
    } catch (err) {
      return { status: 'failed', error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/** Ghi email ra log thay vì gửi. Dùng khi chưa cấu hình RESEND_API_KEY và trong test. */
export class LogSender implements EmailSender {
  readonly outbox: EmailMessage[] = [];
  constructor(private readonly onSend?: (m: EmailMessage) => void) {}

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.outbox.push(message);
    this.onSend?.(message);
    console.info(`[email] → ${message.to} · ${message.subject}`);
    return { status: 'logged' };
  }
}

/**
 * Bọc một bộ gửi để ghi lại kết quả của MỌI lần gửi (sent / failed / logged, id của Resend, lỗi).
 * Không có lớp này thì email gửi qua Resend thất bại là mất dấu: không log, không bảng nào ghi.
 */
export class RecordingSender implements EmailSender {
  readonly label: string;
  private readonly pending = new Set<Promise<void>>();
  constructor(private readonly inner: EmailSender, private readonly record: (m: EmailMessage, r: EmailSendResult) => Promise<void> | void) {
    this.label = inner instanceof ResendSender ? 'Resend' : inner instanceof LogSender ? 'log' : 'custom';
  }
  async send(message: EmailMessage): Promise<EmailSendResult> {
    const r = await this.inner.send(message);
    // Không chờ ghi: email được gửi từ trong transaction của request, mà việc ghi dùng kết nối
    // gốc. Chờ ở đây trên PGlite (một kết nối) là khóa chết. Ai cần chắc đã ghi thì gọi flush().
    const p = Promise.resolve()
      .then(() => this.record(message, r))
      .catch(() => undefined)
      .finally(() => this.pending.delete(p));
    this.pending.add(p);
    return r;
  }
  /** Chờ mọi dòng nhật ký đang ghi xong; gọi trước khi đóng kết nối DB. */
  async flush(): Promise<void> {
    await Promise.all([...this.pending]);
  }
}

/** Chọn bộ gửi theo cấu hình. */
export function createEmailSender(opts: { resendApiKey: string; from: string; onLog?: (m: EmailMessage) => void }): EmailSender {
  return opts.resendApiKey ? new ResendSender(opts.resendApiKey, opts.from) : new LogSender(opts.onLog);
}

/** Bộ gửi đang dùng là gì, để hiện ở /health và Hệ thống · Tổng quan. */
export function emailProviderLabel(sender: EmailSender): string {
  if (sender instanceof RecordingSender) return sender.label;
  if (sender instanceof ResendSender) return 'Resend';
  if (sender instanceof LogSender) return 'log';
  return 'custom';
}
