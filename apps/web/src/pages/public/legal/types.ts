// Kiểu dữ liệu cho hai trang pháp lý (Điều khoản sử dụng, Chính sách quyền riêng tư).
// Chữ nằm ở `terms.ts`, `privacy.ts` và `contact.ts`; phần dựng giao diện nằm ở `LegalDocument.tsx`: sửa chữ không phải đụng giao diện.
//
// Cách viết chữ trong các tệp nội dung:
//   - `**chữ đậm**` để in đậm.
//   - `[chữ hiện ra](/duong-dan)` để gắn link. Đường dẫn bắt đầu bằng "/" là trang trong Hội Mình;
//     link ra ngoài thì ghi đủ "https://...".
//   - Không dùng gạch ngang dài. Dùng dấu phẩy, dấu hai chấm, ngoặc đơn hoặc tách câu.

/** Một khối trong phần: đoạn văn, tiêu đề nhỏ, danh sách gạch đầu dòng, ô lưu ý, hoặc khối liên hệ dùng chung (`contact.ts`). */
export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'contact' };

export interface LegalSection {
  /** Dùng làm neo trên địa chỉ (ví dụ /dieu-khoan#hoan-tien): chữ thường không dấu, nối bằng gạch ngang. Không đổi sau khi đã đăng. */
  id: string;
  /** Tiêu đề phần, không ghi số. Số thứ tự do trang tự đánh theo vị trí. */
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDoc {
  /** Địa chỉ của trang, ví dụ "/dieu-khoan". */
  path: string;
  title: string;
  /** Ngày cập nhật lần cuối, dạng ngày/tháng/năm. Sửa nội dung thì sửa luôn ngày này. */
  updatedAt: string;
  /** Vài câu mở đầu, hiện trước mục lục. */
  intro: string[];
  sections: LegalSection[];
}
