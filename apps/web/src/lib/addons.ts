// Gói bổ sung: phần chủ hội mua thêm cho hội, nằm ngoài bốn gói (Miễn phí, Khởi đầu, Chuyên nghiệp, Không giới hạn).
// Chủ dự án chốt ngày 23/11/2026: tên miền riêng rời khỏi các gói và thành gói bổ sung; email marketing cũng bán riêng.
// Lúc này cả hai đều "Sắp ra mắt": trang Gói bổ sung chỉ giới thiệu, chưa bán, chưa có nút mua.
// Hàm thuần để test được.
import type { MyCommunity } from './auth';

/** Trang Gói bổ sung của chủ hội. */
export const ADDONS_PATH = '/admin/goi-bo-sung';

export type AddonKey = 'custom_domain' | 'email_marketing';
export type AddonStatus = 'soon' | 'available';

export interface PlatformAddon {
  key: AddonKey;
  name: string;
  /** Một câu nói gói này để làm gì. */
  summary: string;
  /** Vài dòng lợi ích cụ thể, mỗi dòng một ý. */
  points: string[];
  status: AddonStatus;
}

export const PLATFORM_ADDONS: readonly PlatformAddon[] = [
  {
    key: 'custom_domain',
    name: 'Tên miền riêng',
    summary: 'Hội chạy trên tên miền của bạn, ví dụ hoc.tenban.vn, thay vì địa chỉ của Hội Mình.',
    points: ['Trỏ một tên miền bạn đã có, không cần mua lại', 'Thành viên vào hội bằng địa chỉ mang thương hiệu của bạn', 'Có chứng chỉ bảo mật (https) tự động'],
    status: 'soon',
  },
  {
    key: 'email_marketing',
    name: 'Email marketing',
    summary: 'Gửi email tới thành viên và khách của hội: bản tin, thông báo khóa mới, chuỗi email chăm sóc.',
    points: ['Gửi theo nhóm: thành viên, người mua, người để lại email', 'Chuỗi email tự chạy theo thẻ', 'Mua theo số email, dùng tới đâu trả tới đó'],
    status: 'soon',
  },
];

export const addonStatusLabel = (s: AddonStatus) => (s === 'soon' ? 'Sắp ra mắt' : 'Đang bán');

/**
 * Người dùng đã làm chủ một hội chưa. Chưa làm chủ hội nào (chỉ là thành viên, hoặc cộng sự ở hội người khác)
 * thì thấy lời mời "Tạo hội của bạn, miễn phí".
 */
export const ownsCommunity = (communities: ReadonlyArray<Pick<MyCommunity, 'role'>>) => communities.some((c) => c.role === 'owner');
