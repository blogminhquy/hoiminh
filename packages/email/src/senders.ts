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
  private readonly pending = new Set<Promise<void>>();
  constructor(private readonly inner: EmailSender, private readonly record: (m: EmailMessage, r: EmailSendResult) => Promise<void> | void) {}
  /** Tính lại mỗi lần đọc: bộ gửi bên trong có thể đổi lúc chạy (SwitchableSender). */
  get label(): string {
    return emailProviderLabel(this.inner);
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

/**
 * Bộ gửi thay được lúc đang chạy: đổi API key Resend ở Hệ thống · Hạ tầng thì email kế tiếp
 * (kể cả email thử ngay sau khi lưu) đi qua key mới mà không cần khởi động lại.
 */
export class SwitchableSender implements EmailSender {
  constructor(private current: EmailSender) {}
  use(next: EmailSender): void {
    this.current = next;
  }
  get inner(): EmailSender {
    return this.current;
  }
  send(message: EmailMessage): Promise<EmailSendResult> {
    return this.current.send(message);
  }
}

/**
 * Giữ email lại tới khi transaction của request (hoặc job) đóng rồi mới gửi.
 * Gửi qua Resend là một lời gọi HTTP: gọi giữa transaction thì kết nối database bị giữ suốt lúc chờ,
 * đông người là cạn kết nối. Kèm lợi ích đúng đắn: thao tác lỗi và bị hủy thì email không đi.
 */
export class DeferredSender implements EmailSender {
  private readonly queue: EmailMessage[] = [];
  constructor(readonly inner: EmailSender) {}
  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.queue.push(message);
    return { status: 'queued' };
  }
  /** Gửi ngay, không chờ (email thử của quản trị cần biết kết quả tức thì). */
  sendNow(message: EmailMessage): Promise<EmailSendResult> {
    return this.inner.send(message);
  }
  /** Gửi mọi email đang giữ; gọi sau khi transaction đã commit. */
  async flush(onError: (m: EmailMessage, err: unknown) => void): Promise<void> {
    for (const m of this.queue.splice(0)) {
      try {
        await this.inner.send(m);
      } catch (err) {
        onError(m, err);
      }
    }
  }
  /** Bỏ mọi email đang giữ; gọi khi transaction bị hủy. */
  discard(): number {
    return this.queue.splice(0).length;
  }
}

/** Gửi ngay cả khi đang ở trong transaction (bỏ qua DeferredSender). Chỉ dùng khi cần kết quả tức thì. */
export function sendImmediately(sender: EmailSender, message: EmailMessage): Promise<EmailSendResult> {
  return sender instanceof DeferredSender ? sender.sendNow(message) : sender.send(message);
}

/** Chọn bộ gửi theo cấu hình. */
export function createEmailSender(opts: { resendApiKey: string; from: string; onLog?: (m: EmailMessage) => void }): EmailSender {
  return opts.resendApiKey ? new ResendSender(opts.resendApiKey, opts.from) : new LogSender(opts.onLog);
}

/** Bộ gửi đang dùng là gì, để hiện ở /health và Hệ thống · Tổng quan. */
export function emailProviderLabel(sender: EmailSender): string {
  if (sender instanceof RecordingSender) return sender.label;
  if (sender instanceof SwitchableSender) return emailProviderLabel(sender.inner);
  if (sender instanceof DeferredSender) return emailProviderLabel(sender.inner);
  if (sender instanceof ResendSender) return 'Resend';
  if (sender instanceof LogSender) return 'log';
  return 'custom';
}
