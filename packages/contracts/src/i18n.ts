// Khóa i18n: giao diện tiếng Việt, khung sẵn để thêm tiếng Anh.
export const LOCALES = ['vi-VN', 'en-US'] as const;
export type Locale = (typeof LOCALES)[number];

export const MESSAGES = {
  'vi-VN': {
    'nav.feed': 'Bảng tin',
    'nav.members': 'Thành viên',
    'nav.events': 'Sự kiện',
    'nav.affiliate': 'Xếp hạng cộng sự',
    'nav.courses': 'Khóa học',
    'nav.resources': 'Tài nguyên',
    'nav.store': 'Cửa hàng',
    'nav.settings': 'Cài đặt',
    'nav.revenue': 'Doanh thu',
    'nav.invite': 'Mời thành viên',
    'nav.messages': 'Tin nhắn',
    'nav.notifications': 'Thông báo',
    'nav.me': 'Tôi',
    'common.save': 'Lưu thay đổi',
    'common.saved': 'Đã lưu',
    'common.cancel': 'Hủy',
    'common.loading': 'Đang tải…',
    'common.empty': 'Chưa có gì ở đây',
    'common.error': 'Có lỗi xảy ra, thử lại nhé',
    'common.retry': 'Thử lại',
    'auth.login': 'Đăng nhập',
    'auth.register': 'Tạo tài khoản',
    'auth.logout': 'Đăng xuất',
    'money.free': 'Miễn phí',
    'money.perMonth': '/tháng',
    'money.perYear': '/năm',
  },
  'en-US': {
    'nav.feed': 'Feed',
    'nav.members': 'Members',
    'nav.events': 'Events',
    'nav.affiliate': 'Affiliate ranking',
    'nav.courses': 'Courses',
    'nav.resources': 'Resources',
    'nav.store': 'Store',
    'nav.settings': 'Settings',
    'nav.revenue': 'Revenue',
    'nav.invite': 'Invite members',
    'nav.messages': 'Messages',
    'nav.notifications': 'Notifications',
    'nav.me': 'Me',
    'common.save': 'Save changes',
    'common.saved': 'Saved',
    'common.cancel': 'Cancel',
    'common.loading': 'Loading…',
    'common.empty': 'Nothing here yet',
    'common.error': 'Something went wrong, please retry',
    'common.retry': 'Retry',
    'auth.login': 'Log in',
    'auth.register': 'Create account',
    'auth.logout': 'Log out',
    'money.free': 'Free',
    'money.perMonth': '/month',
    'money.perYear': '/year',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type MessageKey = keyof (typeof MESSAGES)['vi-VN'];

/** Lấy chuỗi theo khóa và ngôn ngữ, mặc định tiếng Việt. */
export function t(key: MessageKey, locale: Locale = 'vi-VN'): string {
  return MESSAGES[locale][key] ?? MESSAGES['vi-VN'][key];
}

/** Định dạng tiền VND kiểu "249.000đ" hoặc USD "$9.99". */
export function formatMoney(amountMinor: number, currency: 'VND' | 'USD' = 'VND'): string {
  if (currency === 'USD') return `$${(amountMinor / 100).toFixed(2)}`;
  return `${Math.round(amountMinor).toLocaleString('vi-VN')}đ`;
}
