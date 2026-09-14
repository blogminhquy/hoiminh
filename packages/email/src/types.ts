// Giao diện gửi email hệ thống. Chỉ có transactional (Resend); marketing để lớp adapter sau.
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  replyTo?: string;
}

export interface EmailSendResult {
  status: 'sent' | 'logged' | 'failed';
  providerMessageId?: string;
  error?: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

/** Adapter email marketing (mục 28): chưa triển khai, chỉ giữ interface để nối Kit/Mailchimp/Brevo sau. */
export interface MarketingEmailProvider {
  connect(credentials: Record<string, string>): Promise<void>;
  testConnection(): Promise<boolean>;
  createContact(email: string, fields: Record<string, string>): Promise<void>;
  addTag(email: string, tag: string): Promise<void>;
  removeTag(email: string, tag: string): Promise<void>;
  unsubscribe(email: string): Promise<void>;
}
