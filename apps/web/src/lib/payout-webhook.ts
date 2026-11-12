// Trạng thái nối dịch vụ báo có (SePay) của chủ hội ở Cài đặt, Nhận tiền. Hàm thuần để test được:
// chủ hội chọn tự xác nhận mà Hội Mình chưa nhận lần báo có nào thì đang chờ, và trang tự hỏi lại máy chủ
// vài giây một lần để báo "Đã nối" ngay khi chủ hội bấm "Gửi thử" bên SePay, không cần tải lại trang.

export type WebhookLink = 'off' | 'waiting' | 'connected';

interface AccountLike { confirmMode: 'manual' | 'auto'; lastWebhookAt: string | null }

/** Trang hỏi lại máy chủ sau mỗi khoảng này trong lúc chờ lần báo có đầu tiên. */
export const WEBHOOK_POLL_MS = 5000;

/** `off`: chủ hội tự bấm xác nhận (hoặc chưa cài). `waiting`: chưa có lần báo có nào. `connected`: đã nhận ít nhất một lần. */
export function webhookLink(account: AccountLike | null | undefined): WebhookLink {
  if (!account || account.confirmMode !== 'auto') return 'off';
  return account.lastWebhookAt ? 'connected' : 'waiting';
}

/** Khoảng tự hỏi lại cho react-query: chỉ hỏi trong lúc chờ, nối xong thì thôi. */
export function webhookPollMs(account: AccountLike | null | undefined): number | false {
  return webhookLink(account) === 'waiting' ? WEBHOOK_POLL_MS : false;
}
