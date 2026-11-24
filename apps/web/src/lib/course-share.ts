// Chia sẻ khóa học ở thư viện khóa học: phần tính toán không dính giao diện (dòng chữ trên thẻ, câu trong bảng chia sẻ).
// Dữ liệu từ GET /v1/communities/:id/course-share (số tiền) và POST .../course-share/links (link kèm mã).
import type { CourseShareOffer } from '@hoiminh/contracts';
import { money } from '@hoiminh/ui';

/**
 * Khóa này chia sẻ được kiếm bao nhiêu, để in lên thẻ. Khóa bán lẻ có hoa hồng: tiền mỗi đơn. Khóa không bán lẻ (hoặc
 * bán lẻ không tính hoa hồng) mà hội có gói trả phí: tiền mỗi tháng khi giới thiệu người vào hội. Không có gì để nhận thì null
 * (thẻ không hiện dòng chia sẻ).
 */
export function shareAmount(offer: CourseShareOffer | null | undefined, courseId: string): { minor: number; perMonth: boolean } | null {
  if (!offer?.enabled) return null;
  const course = offer.courses.find((c) => c.courseId === courseId);
  if (course) return { minor: course.commissionMinor, perMonth: false };
  if (offer.monthlyCommissionMinor) return { minor: offer.monthlyCommissionMinor, perMonth: true };
  return null;
}

/** Dòng chữ nhỏ trên thẻ khóa học (chủ dự án chốt ngày 23/11/2026): "Nhận 99.800đ khi chia sẻ", "Nhận 39.800đ/tháng khi chia sẻ". */
export function shareLineLabel(a: { minor: number; perMonth: boolean }): { amount: string; text: string } {
  const amount = `${money(a.minor)}${a.perMonth ? '/tháng' : ''}`;
  return { amount, text: `Nhận ${amount} khi chia sẻ` };
}

/** Câu nói rõ tiền giới thiệu vào hội nhận trong bao lâu, và tổng tối đa cho mỗi người khi có giới hạn tháng. */
export function monthlyTerms(monthlyMinor: number, durationMonths: number | null): string {
  if (!durationMonths) return `Mỗi tháng người được giới thiệu còn ở trong hội, bạn nhận ${money(monthlyMinor)}.`;
  return `Mỗi tháng người được giới thiệu còn ở trong hội, bạn nhận ${money(monthlyMinor)}, trong ${durationMonths} tháng đầu. Tổng tối đa ${money(monthlyMinor * durationMonths)} cho mỗi người.`;
}

/**
 * Link chứng nhận để người học khoe, kèm mã giới thiệu của họ. Trang chứng nhận không nằm dưới đường dẫn của hội, nên phải
 * kèm `hoi=<slug>` để mã được tính cho chương trình của hội đó, không phải chương trình nền tảng (xem refScopeOf).
 * Tấm chứng chỉ (ảnh, bản in) vẫn in link gốc không có mã.
 */
export function certificateShareUrl(verifyUrl: string, code: string | null | undefined, communitySlug: string | null | undefined): string {
  if (!code || !communitySlug) return verifyUrl;
  return `${verifyUrl}?ref=${encodeURIComponent(code)}&hoi=${encodeURIComponent(communitySlug)}`;
}
