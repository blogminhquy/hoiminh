// Mẫu email tiếng Việt, HTML tối giản theo bảng màu Hội Mình.
import type { EmailMessage } from './types';

const BRAND = { bg: '#F7F3EC', ink: '#1F1B17', accent: '#D4593A', line: '#E8E1D6', muted: '#8C8478' };

/**
 * Mã hóa ký tự đặc biệt của HTML. Mọi giá trị đưa vào mẫu (tên người dùng, tên hội, trích đoạn bài,
 * lý do từ chối...) đều do người dùng nhập: chèn thẳng thì ai đặt tên là `<a href=...>` sẽ gửi được
 * link tùy ý trong email mang tên miền hoiminh.com.
 */
export function escapeHtml(value: string | number): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const h = escapeHtml;

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html lang="vi"><body style="margin:0;background:${BRAND.bg};font-family:'Open Sans',Segoe UI,Arial,sans-serif;color:${BRAND.ink};">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
  <div style="font-weight:800;font-size:20px;margin-bottom:20px;">Hội Mình</div>
  <div style="background:#FFFDF9;border:1px solid ${BRAND.line};border-radius:16px;padding:28px;">
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${h(title)}</h1>
    <div style="font-size:15px;line-height:1.7;">${bodyHtml}</div>
    ${cta ? `<p style="margin:24px 0 0;"><a href="${h(cta.url)}" style="display:inline-block;background:${BRAND.accent};color:#FFFDF9;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">${h(cta.label)}</a></p>` : ''}
  </div>
  <p style="font-size:12px;color:${BRAND.muted};margin-top:16px;">Bạn nhận email này vì có tài khoản tại Hội Mình. Thanh toán bằng chuyển khoản, MoMo, VNPAY. Không thu phí giao dịch.</p>
</div></body></html>`;
}

/** Bản text của email: bỏ thẻ rồi giải mã lại ký tự đã mã hóa, để người đọc thấy đúng chữ gốc. */
function strip(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .trim();
}

const make = (template: string, to: string, subject: string, title: string, body: string, cta?: { label: string; url: string }): EmailMessage => {
  const html = layout(title, body, cta);
  return { to, subject, html, text: strip(html), template };
};

/** Văn bản thường do chủ hội soạn thành HTML an toàn: mã hóa ký tự, giữ đoạn và xuống dòng, link bấm được. */
export function plainToHtml(text: string): string {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((para) => `<p style="margin:0 0 12px;">${h(para).replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${BRAND.accent};">$1</a>`).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/**
 * Khung email gửi cho liên hệ của một chủ hội (người để lại email ở landing, có thể chưa có tài khoản Hội Mình):
 * đứng tên người gửi thay vì "Hội Mình", chân thư nói rõ vì sao nhận và có link ngừng nhận.
 */
function contactLayout(sender: string, title: string, bodyHtml: string, cta: { label: string; url: string } | undefined, unsubscribeUrl: string): string {
  return `<!doctype html><html lang="vi"><body style="margin:0;background:${BRAND.bg};font-family:'Open Sans',Segoe UI,Arial,sans-serif;color:${BRAND.ink};">
<div style="max-width:560px;margin:0 auto;padding:32px 20px;">
  <div style="font-weight:800;font-size:20px;margin-bottom:20px;">${h(sender)}</div>
  <div style="background:#FFFDF9;border:1px solid ${BRAND.line};border-radius:16px;padding:28px;">
    <h1 style="margin:0 0 12px;font-size:22px;line-height:1.3;">${h(title)}</h1>
    <div style="font-size:16px;line-height:1.7;">${bodyHtml}</div>
    ${cta ? `<p style="margin:24px 0 0;"><a href="${h(cta.url)}" style="display:inline-block;background:${BRAND.accent};color:#FFFDF9;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px;">${h(cta.label)}</a></p>` : ''}
  </div>
  <p style="font-size:12px;color:${BRAND.muted};margin-top:16px;">Bạn nhận email này vì đã để lại thông tin tại ${h(sender)}. Email gửi qua nền tảng Hội Mình. <a href="${h(unsubscribeUrl)}" style="color:${BRAND.muted};">Ngừng nhận email</a></p>
</div></body></html>`;
}

/** Bộ mẫu email hệ thống. */
export const templates = {
  verifyCode: (to: string, name: string, code: string) =>
    make('verify_code', to, `${code} là mã xác minh Hội Mình của bạn`, 'Xác minh email', `<p>Chào ${h(name)}, nhập mã dưới đây để xác minh email. Mã hết hạn sau 15 phút.</p><p style="font-size:32px;font-weight:800;letter-spacing:0.2em;">${h(code)}</p>`),
  passwordChanged: (to: string, name: string) =>
    make('password_changed', to, 'Mật khẩu Hội Mình của bạn vừa được đổi', 'Mật khẩu đã đổi', `<p>Chào ${h(name)}, mật khẩu tài khoản của bạn vừa được đổi. Nếu không phải bạn làm việc này, hãy đặt lại mật khẩu ngay và kiểm tra email đăng nhập.</p>`),
  twoFactorChanged: (to: string, name: string, enabled: boolean) =>
    make(
      'two_factor_changed',
      to,
      enabled ? 'Đã bật xác thực hai lớp cho tài khoản Hội Mình' : 'Đã tắt xác thực hai lớp cho tài khoản Hội Mình',
      enabled ? 'Xác thực hai lớp đã bật' : 'Xác thực hai lớp đã tắt',
      enabled
        ? `<p>Chào ${h(name)}, từ giờ mỗi lần đăng nhập bạn sẽ cần thêm mã 6 số từ ứng dụng xác thực. Giữ kỹ bộ mã dự phòng để dùng khi mất điện thoại.</p><p>Nếu không phải bạn làm việc này, hãy đổi mật khẩu ngay.</p>`
        : `<p>Chào ${h(name)}, xác thực hai lớp cho tài khoản của bạn vừa được tắt. Nếu không phải bạn làm việc này, hãy đổi mật khẩu ngay và bật lại.</p>`,
    ),
  resetPassword: (to: string, name: string, url: string) =>
    make('reset_password', to, 'Đặt lại mật khẩu Hội Mình', 'Đặt lại mật khẩu cho tài khoản của bạn', `<p>Chào ${h(name)}, bấm nút dưới đây để đặt mật khẩu mới. Link hết hạn sau 30 phút.</p>`, { label: 'Đặt mật khẩu mới', url }),
  welcomeMember: (to: string, name: string, community: string, url: string) =>
    make('welcome_member', to, `Chào mừng bạn đến với ${community}`, `Chào mừng ${name}`, `<p>Bạn đã là thành viên của <strong>${h(community)}</strong>. Bắt đầu ở Bảng tin, học module 1 miễn phí và đặt câu hỏi ở Hỏi đáp.</p>`, { label: 'Vào hội', url }),
  paymentSucceeded: (to: string, name: string, item: string, amount: string, url: string) =>
    make('payment_succeeded', to, `Đã nhận thanh toán ${amount} · ${item}`, 'Thanh toán thành công', `<p>Chào ${h(name)}, chúng tôi đã nhận <strong>${h(amount)}</strong> cho <strong>${h(item)}</strong>. Quyền truy cập đã được mở.</p>`, { label: 'Vào học ngay', url }),
  paymentRefunded: (to: string, name: string, item: string, amount: string) =>
    make('payment_refunded', to, `Đã hoàn tiền ${amount} · ${item}`, 'Hoàn tiền', `<p>Chào ${h(name)}, khoản <strong>${h(amount)}</strong> cho <strong>${h(item)}</strong> đã được hoàn. Tiền về theo phương thức bạn đã trả trong 3-7 ngày làm việc.</p>`),
  /**
   * Báo chủ hội: người mua vừa bấm "Tôi đã chuyển khoản" ở đơn chủ hội tự xác nhận. Chủ hội phải tự kiểm tra tài khoản
   * (tiền về thẳng chủ hội, Hội Mình không thấy) rồi bấm xác nhận thì người mua mới được mở quyền.
   */
  ownerTransferReported: (to: string, p: { ownerName: string; buyerName: string; item: string; community: string; amount: string; reference: string; url: string }) =>
    make('owner_transfer_reported', to, `${p.buyerName} báo đã chuyển ${p.amount} · ${p.reference}`, 'Có người báo đã chuyển khoản',
      `<p>Chào ${h(p.ownerName)}, <strong>${h(p.buyerName)}</strong> báo đã chuyển khoản để mua <strong>${h(p.item)}</strong> tại hội <strong>${h(p.community)}</strong>.</p>`
      + `<p style="margin:0;">Số tiền: <strong>${h(p.amount)}</strong><br>Nội dung chuyển khoản cần đối chiếu: <strong>${h(p.reference)}</strong></p>`
      + `<p>Bạn mở app ngân hàng, thấy đúng số tiền và đúng nội dung thì bấm "Đã nhận tiền" để mở quyền cho người mua. Tiền về thẳng tài khoản của bạn nên Hội Mình không kiểm tra hộ được, người mua đang chờ bạn xác nhận.</p>`,
      { label: 'Mở trang Tiền để xác nhận', url: p.url }),
  /** Báo chủ hội: một đơn của hội vừa được thanh toán xong (ngân hàng hoặc cổng báo về, hoặc chủ hội bấm xác nhận). */
  ownerOrderPaid: (to: string, p: { ownerName: string; buyerName: string; item: string; community: string; amount: string; reference: string; url: string }) =>
    make('owner_order_paid', to, `Đơn mới đã thanh toán: ${p.buyerName} · ${p.amount}`, 'Có đơn mới đã thanh toán',
      `<p>Chào ${h(p.ownerName)}, <strong>${h(p.buyerName)}</strong> đã thanh toán <strong>${h(p.amount)}</strong> cho <strong>${h(p.item)}</strong> tại hội <strong>${h(p.community)}</strong>.</p>`
      + `<p style="margin:0;">Mã đơn: <strong>${h(p.reference)}</strong></p>`
      + `<p>Hệ thống đã mở quyền cho người mua. Bạn xem lại đơn ở trang Tiền của hội.</p>`,
      { label: 'Xem ở trang Tiền', url: p.url }),
  eventReminder: (to: string, name: string, event: string, when: string, url: string) =>
    make('event_reminder', to, `Sắp diễn ra: ${event}`, `${event}`, `<p>Chào ${h(name)}, sự kiện bắt đầu ${h(when)}. Link phòng hiện trong trang sự kiện.</p>`, { label: 'Xem sự kiện', url }),
  /** Nhắc gia hạn gói Hội Mình của một hội (daysLeft > 0), hoặc báo gói đã hết hạn (daysLeft = 0). Email hệ thống, luôn gửi. */
  planReminder: (to: string, name: string, community: string, plan: string, daysLeft: number, url: string) =>
    make('plan_reminder', to, daysLeft > 0 ? `Gói ${plan} của ${community} còn ${daysLeft} ngày` : `Gói ${plan} của ${community} đã hết hạn`, daysLeft > 0 ? `Còn ${daysLeft} ngày` : 'Gói đã hết hạn',
      `<p>Chào ${h(name)}, ${daysLeft > 0
        ? `gói <strong>${h(plan)}</strong> của hội <strong>${h(community)}</strong> còn ${daysLeft} ngày. Gia hạn trước ngày hết hạn thì số ngày mới được nối tiếp, không mất ngày nào.`
        : `gói <strong>${h(plan)}</strong> của hội <strong>${h(community)}</strong> đã hết hạn. Hội trở về gói Miễn phí: thành viên và dữ liệu vẫn được giữ nguyên, hội chỉ chưa nhận thêm người mới nếu đã vượt trần của gói Miễn phí, và các tính năng của gói trả phí tạm khóa.`}</p>`,
      { label: daysLeft > 0 ? 'Gia hạn gói' : 'Xem các gói', url }),
  commissionAvailable: (to: string, name: string, amount: string, url: string) =>
    make('commission_available', to, `Hoa hồng ${amount} đã có thể rút`, 'Hoa hồng đã được duyệt', `<p>Chào ${h(name)}, hoa hồng <strong>${h(amount)}</strong> đã hết thời gian giữ và vào số dư có thể rút.</p>`, { label: 'Xem ví affiliate', url }),
  withdrawalPaid: (to: string, name: string, amount: string, reference: string) =>
    make('withdrawal_paid', to, `Đã chuyển ${amount} cho bạn`, 'Yêu cầu rút đã được thanh toán', `<p>Chào ${h(name)}, <strong>${h(amount)}</strong> đã được chuyển khoản. Mã tham chiếu: <code>${h(reference)}</code>.</p>`),
  withdrawalRejected: (to: string, name: string, amount: string, reason: string) =>
    make('withdrawal_rejected', to, `Yêu cầu rút ${amount} bị từ chối`, 'Yêu cầu rút bị từ chối', `<p>Chào ${h(name)}, yêu cầu rút <strong>${h(amount)}</strong> bị từ chối với lý do: ${h(reason)}. Số tiền đã trả lại ví của bạn.</p>`),
  newMessage: (to: string, from: string, preview: string, url: string) =>
    make('new_message', to, `${from} nhắn cho bạn`, `Tin nhắn mới từ ${from}`, `<p>${h(preview)}</p>`, { label: 'Trả lời', url }),
  /** Email thử do quản trị hệ thống bấm gửi để kiểm chứng Resend đã nối. */
  testEmail: (to: string, name: string, meta: { env: string; from: string; sentAt: string }) =>
    make('test_email', to, 'Email thử từ Hội Mình', 'Resend đã nối', `<p>Chào ${h(name)}, đây là email thử gửi từ Hệ thống · Tổng quan. Nhận được nghĩa là RESEND_API_KEY đúng và tên miền gửi đã xác minh.</p><p style="font-size:13px;color:#8C8478;">Môi trường: ${h(meta.env)} · Gửi từ: ${h(meta.from)} · Lúc: ${h(meta.sentAt)}</p>`),
  /** Email do quy tắc tự động của chủ hội gửi. `body` là văn bản thường đã thay biến. */
  automationEmail: (to: string, p: { sender: string; subject: string; body: string; cta?: { label: string; url: string }; unsubscribeUrl: string }): EmailMessage => {
    const html = contactLayout(p.sender, p.subject, plainToHtml(p.body), p.cta, p.unsubscribeUrl);
    return { to, subject: p.subject, html, text: strip(html), template: 'automation_email' };
  },
  /** Mời khách bấm link để nhận quyền đang giữ theo email (chưa có tài khoản hoặc email chưa xác minh). */
  activationInvite: (to: string, p: { sender: string; name: string; items: string[]; url: string; unsubscribeUrl: string }): EmailMessage => {
    const list = p.items.map((i) => `<li>${h(i)}</li>`).join('');
    const body = `<p style="margin:0 0 12px;">Chào ${h(p.name || 'bạn')}, ${h(p.sender)} vừa mở cho bạn:</p><ul style="margin:0 0 12px;padding-left:20px;">${list}</ul><p style="margin:0;">Bấm nút dưới đây, đặt mật khẩu một lần là vào được ngay. Link dùng được trong 30 ngày.</p>`;
    const html = contactLayout(p.sender, 'Quyền truy cập của bạn đã sẵn sàng', body, { label: 'Kích hoạt và vào xem', url: p.url }, p.unsubscribeUrl);
    return { to, subject: `${p.sender}: quyền truy cập của bạn đã sẵn sàng`, html, text: strip(html), template: 'activation_invite' };
  },
  invite: (to: string, community: string, inviter: string, url: string) =>
    make('invite', to, `${inviter} mời bạn vào ${community}`, `Bạn được mời vào ${community}`, `<p><strong>${h(inviter)}</strong> mời bạn tham gia hội <strong>${h(community)}</strong> trên Hội Mình.</p>`, { label: 'Tham gia', url }),
};
export type TemplateName = keyof typeof templates;
