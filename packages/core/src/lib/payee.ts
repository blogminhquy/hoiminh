// Tiền của một thanh toán về tài khoản của ai. Tách riêng thành tệp nhỏ để dịch vụ thanh toán và dịch vụ nhận tiền
// của chủ hội cùng dùng mà không phải nhập vòng lẫn nhau.

/** Thanh toán này trả thẳng vào tài khoản chủ hội (đơn của hội), không phải tài khoản Hội Mình (đơn gói). */
export function isOwnerPayee(payment: { instruction: unknown }): boolean {
  return (payment.instruction as { payee?: unknown } | null)?.payee === 'owner';
}
