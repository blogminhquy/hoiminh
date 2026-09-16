// Mẫu email tiếng Việt, HTML tối giản theo bảng màu Hội Mình.
import type { EmailMessage } from './types';

const BRAND = { bg: '#F7F3EC', ink: '#1F1B17', accent: '#D4593A', line: '#E8E1D6', muted: '#8C8478' };

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html lang="vi"><body style="margin:0;background:${BRAND.bg};font-family:'Open Sans',Segoe UI,Arial,sans-serif;color:${BRAND.ink};">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
  <div style="font-weight:800;font-size:20px;margin-bottom:20px;">Hội Mình</div>
  <div style="background:#FFFDF9;border:1px solid ${BRAND.line};border-radius:16px;padding:28px;">
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${title}</h1>
    <div style="font-size:15px;line-height:1.7;">${bodyHtml}</div>
    ${cta ? `<p style="margin:24px 0 0;"><a href="${cta.url}" style="display:inline-block;background:${BRAND.accent};color:#FFFDF9;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">${cta.label}</a></p>` : ''}
  </div>
  <p style="font-size:12px;color:${BRAND.muted};margin-top:16px;">Bạn nhận email này vì có tài khoản tại Hội Mình. Thanh toán bằng chuyển khoản, MoMo, VNPAY. Không thu phí giao dịch.</p>
</div></body></html>`;
}

function strip(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

const make = (template: string, to: string, subject: string, title: string, body: string, cta?: { label: string; url: string }): EmailMessage => {
  const html = layout(title, body, cta);
  return { to, subject, html, text: strip(html), template };
};

/** Bộ mẫu email hệ thống. */
export const templates = {
  verifyCode: (to: string, name: string, code: string) =>
    make('verify_code', to, `${code} là mã xác minh Hội Mình của bạn`, 'Xác minh email', `<p>Chào ${name}, nhập mã dưới đây để xác minh email. Mã hết hạn sau 15 phút.</p><p style="font-size:32px;font-weight:800;letter-spacing:0.2em;">${code}</p>`),
  passwordChanged: (to: string, name: string) =>
    make('password_changed', to, 'Mật khẩu Hội Mình của bạn vừa được đổi', 'Mật khẩu đã đổi', `<p>Chào ${name}, mật khẩu tài khoản của bạn vừa được đổi. Nếu không phải bạn làm việc này, hãy đặt lại mật khẩu ngay và kiểm tra email đăng nhập.</p>`),
  twoFactorChanged: (to: string, name: string, enabled: boolean) =>
    make(
      'two_factor_changed',
      to,
      enabled ? 'Đã bật xác thực hai lớp cho tài khoản Hội Mình' : 'Đã tắt xác thực hai lớp cho tài khoản Hội Mình',
      enabled ? 'Xác thực hai lớp đã bật' : 'Xác thực hai lớp đã tắt',
      enabled
        ? `<p>Chào ${name}, từ giờ mỗi lần đăng nhập bạn sẽ cần thêm mã 6 số từ ứng dụng xác thực. Giữ kỹ bộ mã dự phòng để dùng khi mất điện thoại.</p><p>Nếu không phải bạn làm việc này, hãy đổi mật khẩu ngay.</p>`
        : `<p>Chào ${name}, xác thực hai lớp cho tài khoản của bạn vừa được tắt. Nếu không phải bạn làm việc này, hãy đổi mật khẩu ngay và bật lại.</p>`,
    ),
  resetPassword: (to: string, name: string, url: string) =>
    make('reset_password', to, 'Đặt lại mật khẩu Hội Mình', 'Đặt lại mật khẩu cho tài khoản của bạn', `<p>Chào ${name}, bấm nút dưới đây để đặt mật khẩu mới. Link hết hạn sau 30 phút.</p>`, { label: 'Đặt mật khẩu mới', url }),
  welcomeMember: (to: string, name: string, community: string, url: string) =>
    make('welcome_member', to, `Chào mừng bạn đến với ${community}`, `Chào mừng ${name}`, `<p>Bạn đã là thành viên của <strong>${community}</strong>. Bắt đầu ở Bảng tin, học module 1 miễn phí và đặt câu hỏi ở Hỏi đáp.</p>`, { label: 'Vào hội', url }),
  paymentSucceeded: (to: string, name: string, item: string, amount: string, url: string) =>
    make('payment_succeeded', to, `Đã nhận thanh toán ${amount} · ${item}`, 'Thanh toán thành công', `<p>Chào ${name}, chúng tôi đã nhận <strong>${amount}</strong> cho <strong>${item}</strong>. Quyền truy cập đã được mở.</p>`, { label: 'Vào học ngay', url }),
  paymentRefunded: (to: string, name: string, item: string, amount: string) =>
    make('payment_refunded', to, `Đã hoàn tiền ${amount} · ${item}`, 'Hoàn tiền', `<p>Chào ${name}, khoản <strong>${amount}</strong> cho <strong>${item}</strong> đã được hoàn. Tiền về theo phương thức bạn đã trả trong 3–7 ngày làm việc.</p>`),
  eventReminder: (to: string, name: string, event: string, when: string, url: string) =>
    make('event_reminder', to, `Sắp diễn ra: ${event}`, `${event}`, `<p>Chào ${name}, sự kiện bắt đầu ${when}. Link phòng hiện trong trang sự kiện.</p>`, { label: 'Xem sự kiện', url }),
  trialReminder: (to: string, name: string, daysLeft: number, url: string) =>
    make('trial_reminder', to, daysLeft > 0 ? `Gói dùng thử còn ${daysLeft} ngày` : 'Gói dùng thử đã hết hạn', daysLeft > 0 ? `Còn ${daysLeft} ngày dùng thử` : 'Hết dùng thử', `<p>Chào ${name}, ${daysLeft > 0 ? `gói dùng thử Hội Mình của bạn còn ${daysLeft} ngày.` : 'gói dùng thử đã hết hạn, hội của bạn tạm khóa tạo nội dung nhưng không mất dữ liệu.'} Thanh toán bằng chuyển khoản hoặc MoMo để tiếp tục, 499.000đ/tháng hoặc 4.990.000đ/năm.</p>`, { label: 'Thanh toán gói', url }),
  commissionAvailable: (to: string, name: string, amount: string, url: string) =>
    make('commission_available', to, `Hoa hồng ${amount} đã có thể rút`, 'Hoa hồng đã được duyệt', `<p>Chào ${name}, hoa hồng <strong>${amount}</strong> đã hết thời gian giữ và vào số dư có thể rút.</p>`, { label: 'Xem ví cộng sự', url }),
  withdrawalPaid: (to: string, name: string, amount: string, reference: string) =>
    make('withdrawal_paid', to, `Đã chuyển ${amount} cho bạn`, 'Yêu cầu rút đã được thanh toán', `<p>Chào ${name}, <strong>${amount}</strong> đã được chuyển khoản. Mã tham chiếu: <code>${reference}</code>.</p>`),
  withdrawalRejected: (to: string, name: string, amount: string, reason: string) =>
    make('withdrawal_rejected', to, `Yêu cầu rút ${amount} bị từ chối`, 'Yêu cầu rút bị từ chối', `<p>Chào ${name}, yêu cầu rút <strong>${amount}</strong> bị từ chối với lý do: ${reason}. Số tiền đã trả lại ví của bạn.</p>`),
  broadcastPost: (to: string, community: string, title: string, excerpt: string, url: string) =>
    make('broadcast_post', to, `[${community}] ${title}`, title, `<p>${excerpt}</p>`, { label: 'Đọc bài', url }),
  newMessage: (to: string, from: string, preview: string, url: string) =>
    make('new_message', to, `${from} nhắn cho bạn`, `Tin nhắn mới từ ${from}`, `<p>${preview}</p>`, { label: 'Trả lời', url }),
  invite: (to: string, community: string, inviter: string, url: string) =>
    make('invite', to, `${inviter} mời bạn vào ${community}`, `Bạn được mời vào ${community}`, `<p><strong>${inviter}</strong> mời bạn tham gia hội <strong>${community}</strong> trên Hội Mình.</p>`, { label: 'Tham gia', url }),
};
export type TemplateName = keyof typeof templates;
