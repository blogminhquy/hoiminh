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

/** Chọn bộ gửi theo cấu hình. */
export function createEmailSender(opts: { resendApiKey: string; from: string; onLog?: (m: EmailMessage) => void }): EmailSender {
  return opts.resendApiKey ? new ResendSender(opts.resendApiKey, opts.from) : new LogSender(opts.onLog);
}
