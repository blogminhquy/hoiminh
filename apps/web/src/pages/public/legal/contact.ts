// Mục Liên hệ dùng chung cho hai trang pháp lý. Chỉ có chữ: xem cách viết ở `types.ts`.

/** Tên đơn vị vận hành hiện trên hai trang. Khi có tên pháp nhân chính thức thì sửa ở đây. */
export const LEGAL_OPERATOR = 'Hội Mình';

/**
 * Email hỗ trợ hiện ở mục Liên hệ của cả hai trang. Đang để trống vì trong repo chưa có địa chỉ nào được xác nhận là
 * hộp thư hỗ trợ thật. Điền địa chỉ vào đây (ví dụ 'hotro@...') là mục Liên hệ tự hiện dòng email và bỏ dòng
 * "chưa công bố hộp thư", không cần sửa gì khác.
 */
export const LEGAL_CONTACT_EMAIL: string | null = null;

/** Mục Liên hệ: một đoạn mở và các dòng thành danh sách. Truyền `email` để xem trước khi đã có hộp thư hỗ trợ. */
export function legalContact(email: string | null = LEGAL_CONTACT_EMAIL): { lead: string; items: string[] } {
  const items = [
    '**Việc của một hội** (đơn hàng, khóa học, hoàn tiền, hoa hồng của hội): nhắn chủ hội ở mục [Tin nhắn](/tin-nhan). Chủ hội là người bán và là người xử lý các việc này.',
    '**Báo cáo người vi phạm:** mở cuộc trò chuyện với người đó trong Tin nhắn, bấm menu ba chấm rồi chọn Báo cáo. Báo cáo được gửi tới quản trị viên Hội Mình.',
  ];
  if (email) {
    items.unshift(`**Email hỗ trợ:** [${email}](mailto:${email}). Dùng cho mọi việc cần Hội Mình xử lý: tài khoản, dữ liệu cá nhân, gói Hội Mình, khiếu nại.`);
  } else {
    items.push('**Việc cần Hội Mình xử lý trực tiếp** (tài khoản bị khóa, yêu cầu về dữ liệu cá nhân, gói Hội Mình): Hội Mình chưa công bố hộp thư hỗ trợ ở trang này. Địa chỉ sẽ được ghi tại đây khi có.');
  }
  return { lead: `Đơn vị vận hành nền tảng là **${LEGAL_OPERATOR}**, địa chỉ web hoiminh.com.`, items };
}
