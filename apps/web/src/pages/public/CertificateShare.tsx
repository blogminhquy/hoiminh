// Giới thiệu khóa học ngay dưới tấm chứng nhận (chủ dự án yêu cầu ngày 23/11/2026). Trang chứng nhận ai có link cũng mở
// được, nên mỗi người thấy một khác:
//   - Chính người học: khối "Khóa học giúp ích cho bạn? Giới thiệu cho bạn bè" với hai ô như bảng chia sẻ ở thư viện khóa
//     học (giới thiệu khóa học này, giới thiệu vào hội). Link chứng nhận họ chia sẻ hay sao chép cũng kèm sẵn mã của họ,
//     nên khoe chứng chỉ cũng là đang giới thiệu.
//   - Người khác: lời mời "Bạn cũng muốn học khóa này?" với giá và lối xem khóa, xem hội. Không thấy gì về hoa hồng.
import type { CourseShareLinks, CourseShareOffer } from '@hoiminh/contracts';
import { Skeleton, T, money } from '@hoiminh/ui';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Info, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api';
import { certificateShareUrl, monthlyTerms } from '@/lib/course-share';
import { CopyRow, ShareOption } from '../community/CourseShare';
import type { CertificateDto } from './CertificateParts';

export interface CertificateReferral {
  offer: CourseShareOffer | null;
  links: CourseShareLinks | null;
  loading: boolean;
  /** Link chứng nhận để chia sẻ: kèm mã của người học khi họ giới thiệu được, không thì link gốc. */
  shareUrl: string;
}

/**
 * Phần giới thiệu của chính người học. Hội đang bật affiliate và có tiền để nhận thì lấy luôn link (máy chủ tạo ví
 * affiliate nếu chưa có: người học vừa xong khóa, mở chứng chỉ của mình, là lúc họ muốn khoe nhất). Người khác xem thì không hỏi gì.
 */
export function useCertificateReferral(c: CertificateDto, isLearner: boolean): CertificateReferral {
  const communityId = c.community?.id ?? null;
  const offer = useQuery({
    queryKey: ['course-share', communityId],
    queryFn: () => api.get<CourseShareOffer>(`/v1/communities/${communityId}/course-share`),
    enabled: isLearner && Boolean(communityId),
    staleTime: 5 * 60_000,
    retry: false,
  });
  const o = offer.data?.enabled ? offer.data : null;
  const hasMoney = Boolean(o && (o.monthlyCommissionMinor || o.courses.some((x) => x.courseId === c.course.id)));
  const links = useQuery({
    queryKey: ['course-share-links', communityId, c.course.id],
    queryFn: () => api.post<CourseShareLinks>(`/v1/communities/${communityId}/course-share/links`, { courseId: c.course.id }),
    enabled: hasMoney,
    staleTime: 10 * 60_000,
    retry: false,
  });
  return {
    offer: hasMoney ? o : null,
    links: links.data ?? null,
    loading: offer.isLoading || (hasMoney && links.isLoading),
    shareUrl: certificateShareUrl(c.verifyUrl, links.data?.code, c.community?.slug),
  };
}

/** Khối giới thiệu dưới chứng chỉ, cho chính người học. Không có gì để nhận thì không hiện. */
export function CertificateReferralBlock({ c, r }: { c: CertificateDto; r: CertificateReferral }) {
  if (!r.offer) return null;
  const retail = r.offer.courses.find((x) => x.courseId === c.course.id);
  const monthly = r.offer.monthlyCommissionMinor;
  const both = Boolean(retail && r.links?.courseUrl && monthly);
  return (
    <section className="cert-noprint card flex flex-col gap-4 px-4 py-5 md:px-5" data-testid="cert-referral">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-[19px] md:text-[20px] font-extrabold" style={{ color: T.ink }}>Khóa học giúp ích cho bạn? Giới thiệu cho bạn bè</h2>
        <p className="m-0 text-[15px]" style={{ color: T.ink2 }}>Người bạn giới thiệu mua khóa hoặc vào hội qua link của bạn, bạn nhận tiền.</p>
      </div>
      {!r.links ? (
        <Skeleton h={190} />
      ) : (
        <div className={`grid gap-3 items-stretch${both ? ' md:grid-cols-2' : ''}`}>
          {retail && r.links.courseUrl && (
            <ShareOption icon={<BookOpen size={19} />} name="Giới thiệu khóa học này" amount={money(retail.commissionMinor)} unit="mỗi người mua" note={`Mỗi người mua khóa ${money(retail.priceMinor)} qua link của bạn, bạn nhận ${money(retail.commissionMinor)}.`}>
              <CopyRow url={r.links.courseUrl} what="course" />
            </ShareOption>
          )}
          {monthly && (
            <ShareOption strong icon={<Users size={19} />} name="Giới thiệu vào hội" pill="Nhận hằng tháng" amount={money(monthly)} unit="mỗi tháng" note={monthlyTerms(monthly, r.offer.durationMonths)}>
              <CopyRow url={r.links.communityUrl} what="community" />
            </ShareOption>
          )}
        </div>
      )}
      {r.links && (
        <div className="flex gap-2.5 items-start rounded-[12px] px-3.5 py-3 text-[15px]" style={{ background: T.moneySoft, color: T.moneyText }}>
          <Info size={18} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>Link chứng nhận bạn chia sẻ đã gắn sẵn mã giới thiệu của bạn. Bạn bè xem chứng chỉ rồi mua khóa hoặc vào hội, bạn cũng được tính.</span>
        </div>
      )}
    </section>
  );
}

/** Lời mời học khóa cho người được chia sẻ chứng chỉ. Mã của người học đi theo link đã được ghi nhớ, nên mua qua đây vẫn tính cho họ. */
export function CertificateInvite({ c }: { c: CertificateDto }) {
  if (!c.community) return null;
  const courseTo = c.sale?.path ?? `/${c.community.slug}`;
  return (
    <section className="cert-noprint card flex flex-col gap-3 px-4 py-5 md:px-5" data-testid="cert-invite">
      <h2 className="m-0 text-[19px] md:text-[20px] font-extrabold" style={{ color: T.ink }}>Bạn cũng muốn học khóa này?</h2>
      <div className="flex flex-col gap-1">
        <span className="font-bold text-[17px]" style={{ color: T.ink }}>{c.course.title}</span>
        <span className="text-[15px]" style={{ color: T.ink3 }}>{c.learner.name} đã học xong {c.course.lessonCount} bài · {c.community.name}</span>
        {c.sale && <span className="font-extrabold text-[20px]" style={{ color: T.ink }}>{money(c.sale.priceMinor)}</span>}
      </div>
      <div className="flex gap-2.5 flex-wrap">
        <Link to={courseTo} className="btn btn-primary btn-lg flex-1" style={{ minWidth: 200 }}>{c.sale ? 'Xem khóa học' : `Xem hội ${c.community.name}`}</Link>
        {c.sale && <Link to={`/${c.community.slug}`} className="btn btn-ghost btn-lg flex-1" style={{ minWidth: 200 }}>Xem hội {c.community.name}</Link>}
      </div>
    </section>
  );
}
