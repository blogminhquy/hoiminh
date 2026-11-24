// Chia sẻ khóa học ngay ở thư viện khóa học (chủ dự án chốt ngày 23/11/2026, cách A): dưới nút chính của thẻ có một dòng
// chữ nhỏ, kín đáo "Nhận 99.800đ khi chia sẻ" (chỉ số tiền màu xanh). Bấm vào mở bảng hai lựa chọn, mỗi lựa chọn có nút
// sao chép riêng: giới thiệu khóa học này (link trang bán lẻ, nhận một lần mỗi đơn) và giới thiệu vào hội (link trang hội,
// nhận hằng tháng). Mọi chỗ ghi số tiền cụ thể, không ghi phần trăm.
import type { CourseShareLinks, CourseShareOffer } from '@hoiminh/contracts';
import { ErrorBox, Modal, Skeleton, T, money } from '@hoiminh/ui';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Check, Copy, Gift, Share2, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { copyText } from '@/lib/affiliate-link';
import { api, errorMessage } from '@/lib/api';
import { monthlyTerms, shareLineLabel } from '@/lib/course-share';

/** Dòng chữ nhỏ dưới nút chính của thẻ khóa học. */
export function CourseShareLine({ amount, onOpen }: { amount: { minor: number; perMonth: boolean }; onOpen: () => void }) {
  const label = shareLineLabel(amount);
  return (
    <button type="button" onClick={onOpen} className="self-center inline-flex items-center gap-1.5 rounded-lg px-2 text-[14px] font-medium hover:underline underline-offset-4" style={{ minHeight: 40, color: T.ink3 }} aria-label={`${label.text}. Mở bảng chia sẻ khóa học`}>
      <Gift size={15} aria-hidden="true" style={{ color: T.moneyText }} />
      <span>Nhận <b style={{ color: T.money, fontWeight: 700 }}>{label.amount}</b> khi chia sẻ</span>
    </button>
  );
}

export function CopyRow({ url, what }: { url: string; what: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const copy = () => { void copyText(url).then((ok) => { setState(ok ? 'copied' : 'failed'); setTimeout(() => setState('idle'), 2000); }); };
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const share = () => { void navigator.share({ url }).catch(() => { /* người dùng đóng bảng chia sẻ */ }); };
  return (
    <div className="flex flex-col gap-2">
      <div className="text-[14px] font-semibold rounded-[10px] px-3 py-2.5" style={{ background: T.bg, color: T.primaryText, wordBreak: 'break-all', userSelect: 'all' }} data-testid={`share-url-${what}`}>{url}</div>
      <div className="flex gap-2 flex-wrap">
        <button type="button" className="btn btn-primary flex-1" style={{ minWidth: 140 }} onClick={copy}>{state === 'copied' ? <Check size={18} /> : <Copy size={18} />}{state === 'copied' ? 'Đã sao chép' : 'Sao chép link'}</button>
        {canShare && <button type="button" className="btn btn-ghost flex-1" style={{ minWidth: 140 }} onClick={share}><Share2 size={18} />Chia sẻ</button>}
      </div>
      {state === 'failed' && <div className="text-[14px]" style={{ color: T.accentText }}>Trình duyệt không cho sao chép tự động. Bạn nhấn giữ vào link ở trên để sao chép.</div>}
    </div>
  );
}

export function ShareOption({ icon, name, pill, amount, unit, note, children, strong }: { icon: ReactNode; name: string; pill?: string; amount: string; unit: string; note: string; children: ReactNode; strong?: boolean }) {
  return (
    <section className="rounded-[14px] p-4 flex flex-col gap-2.5" style={{ border: `1px solid ${strong ? T.money : T.line}`, boxShadow: strong ? `0 0 0 1px ${T.money}` : undefined }}>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="w-9 h-9 rounded-[10px] inline-flex items-center justify-center flex-shrink-0" style={{ background: T.moneySoft, color: T.moneyText }}>{icon}</span>
        <h3 className="m-0 font-bold text-[16px] flex-grow">{name}</h3>
        {pill && <span className="text-[13px] font-bold rounded-full px-2.5 py-0.5" style={{ background: T.moneySoft, color: T.moneyText }}>{pill}</span>}
      </div>
      <div className="font-extrabold text-[26px] leading-tight" style={{ color: T.money, fontVariantNumeric: 'tabular-nums' }}>{amount} <span className="text-[15px] font-semibold" style={{ color: T.ink2 }}>{unit}</span></div>
      <p className="m-0 text-[15px]" style={{ color: T.ink2 }}>{note}</p>
      {children}
    </section>
  );
}

/** Bảng chia sẻ một khóa học. Mở ra mới lấy link (máy chủ tạo ví affiliate nếu chưa có). */
export function CourseShareModal({ communityId, course, offer, onClose }: { communityId: string; course: { id: string; title: string } | null; offer: CourseShareOffer; onClose: () => void }) {
  const links = useQuery({
    queryKey: ['course-share-links', communityId, course?.id],
    queryFn: () => api.post<CourseShareLinks>(`/v1/communities/${communityId}/course-share/links`, { courseId: course!.id }),
    enabled: Boolean(course),
    staleTime: 10 * 60_000,
  });
  const retail = course ? offer.courses.find((c) => c.courseId === course.id) : undefined;
  const monthly = offer.monthlyCommissionMinor;
  return (
    <Modal open={Boolean(course)} onClose={onClose} width={540} title={course ? `Giới thiệu "${course.title}"` : ''}>
      <div className="p-5 flex flex-col gap-4">
        <p className="m-0 text-[15px]" style={{ color: T.ink3 }}>Chọn link muốn gửi. Ai mua hoặc vào hội qua link đều tính cho bạn.</p>
        {links.isLoading && <div className="flex flex-col gap-3"><Skeleton h={150} /><Skeleton h={150} /></div>}
        {links.isError && <ErrorBox message={errorMessage(links.error)} onRetry={() => void links.refetch()} />}
        {links.data && (
          <>
            {retail && links.data.courseUrl && (
              <ShareOption icon={<BookOpen size={19} />} name="Giới thiệu khóa học này" amount={money(retail.commissionMinor)} unit="mỗi người mua" note={`Mỗi người mua khóa ${money(retail.priceMinor)} qua link của bạn, bạn nhận ${money(retail.commissionMinor)}.`}>
                <CopyRow url={links.data.courseUrl} what="course" />
              </ShareOption>
            )}
            {monthly && (
              <ShareOption strong icon={<Users size={19} />} name="Giới thiệu vào hội" pill="Nhận hằng tháng" amount={money(monthly)} unit="mỗi tháng" note={monthlyTerms(monthly, offer.durationMonths)}>
                <CopyRow url={links.data.communityUrl} what="community" />
              </ShareOption>
            )}
            {!(retail && links.data.courseUrl) && monthly && <div className="text-[14px]" style={{ color: T.ink3 }}>Khóa này không bán lẻ riêng, nên bạn giới thiệu qua link vào hội.</div>}
            <div className="text-[14px] flex items-center gap-2 flex-wrap" style={{ color: T.ink3 }}>
              <span>Mã giới thiệu của bạn: <b style={{ color: T.ink }}>{links.data.code}</b></span>
              <span aria-hidden="true">·</span>
              <Link to={offer.programId ? `/tai-khoan/cong-su/${offer.programId}` : '/tai-khoan/cong-su'} className="font-semibold" style={{ color: T.primaryText }} onClick={onClose}>Xem tiền đã nhận</Link>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
