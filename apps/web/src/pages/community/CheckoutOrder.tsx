// Màn của một đơn: /thanh-toan/:orderId. Một cột từ trên xuống, đổi theo trạng thái đơn:
// - chờ trả: tóm tắt đơn, hướng dẫn, mã QR to và các hàng sao chép (hoặc nút mở cổng thanh toán), nút "Tôi đã chuyển khoản";
// - đã bấm báo chuyển khoản: màn cảm ơn và chờ xác nhận, có thẻ chủ hội để nhắn tin, mở lại được thông tin chuyển khoản;
// - đã trả: màn thành công với nút vào thẳng thứ vừa mua; hết hạn, đã hủy, đã hoàn: báo rõ.
// Trang tự hỏi lại máy chủ 3 giây một lần khi đơn còn chờ, nên tự chuyển màn khi tiền về hoặc chủ hội xác nhận.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, ErrorBox, T, money } from '@hoiminh/ui';
import { Check, ChevronDown, ExternalLink, MessageCircle, UserRound } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { BankQrCard, CheckoutFrame, Notice, ProviderLine, Section, Spinner, TransferSteps, Waiting, fmtClockDay, providerMeta, type Instruction } from './CheckoutParts';
import { MessageModal } from './MessageModal';

/** Hội và chủ hội bán đơn này (chỉ thông tin công khai trên hồ sơ). Đơn mua gói Hội Mình thì không có. */
interface Seller { communityId: string; communityName: string; communitySlug: string; owner: { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null; acceptsMessages: boolean } }
interface Order { orderId: string; status: 'pending' | 'paid' | 'refunded' | 'expired' | 'cancelled'; paidAt: string | null; reference: string; amountMinor: number; provider: string | null; paymentStatus: string | null; instruction: Instruction | null; title: string; nextUrl: string; expiresAt: string | null; targetType?: 'tier' | 'product' | 'platform'; seller?: Seller | null }

/** Tóm tắt đơn gọn trong một khối: tên món, mã đơn, tổng tiền trên một hàng, hạn giữ chỗ. `extra` là các dòng thêm của từng màn. */
function OrderSummary({ o, extra, sub }: { o: Order; extra?: ReactNode; /** Khối này nằm dưới một tiêu đề lớn khác của trang. */ sub?: boolean }) {
  const Title = sub ? 'h2' : 'h1';
  return (
    <div className="card px-4 py-4 md:px-5 flex flex-col gap-1.5">
      <Title className="serif text-[22px] leading-tight font-extrabold">{o.title || 'Đơn hàng'}</Title>
      <div className="text-[15px]" style={{ color: T.ink2 }}>Mã đơn <strong style={{ color: T.ink }}>{o.reference}</strong></div>
      {extra}
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1 pt-3 mt-1.5" style={{ borderTop: `1px solid ${T.line}` }}><span className="flex-grow font-bold text-[16px] whitespace-nowrap">Tổng thanh toán</span><span className="serif text-[28px] leading-none font-extrabold whitespace-nowrap">{money(o.amountMinor)}</span></div>
      {o.expiresAt && o.status === 'pending' && <div className="text-[14px]" style={{ color: T.ink2 }}>Đơn giữ chỗ đến {fmtClockDay(o.expiresAt)}</div>}
    </div>
  );
}

/** Chữ trên nút vào thứ vừa mua, theo đích mà máy chủ đã tính (`nextUrl`). */
function goLabel(o: Order): string {
  if (o.targetType === 'platform' || o.nextUrl.startsWith('/admin')) return 'Về trang gói của hội';
  if (o.nextUrl === '/hoc') return 'Vào Khu học tập';
  if (o.targetType === 'product') return 'Mở sản phẩm vừa mua';
  return 'Vào hội xem khóa học';
}

/** Đã nhận tiền: báo rõ, có nút vào thẳng thứ vừa mua. Trang cũng tự chuyển sau vài giây. */
function PaidView({ o }: { o: Order }) {
  return (
    <>
      <div className="card px-5 py-7 flex flex-col items-center text-center gap-2.5" style={{ background: T.tealSoft, borderColor: T.tealSoft }}>
        <span className="w-14 h-14 rounded-full inline-flex items-center justify-center" style={{ background: T.teal, color: T.invertInk }}><Check size={30} /></span>
        <div className="serif text-[24px] leading-tight font-extrabold">Đã nhận thanh toán</div>
        <div className="text-[15px] leading-snug" style={{ color: T.tealText }}>Quyền truy cập đã mở{o.paidAt ? ` lúc ${fmtClockDay(o.paidAt)}` : ''}. Đang chuyển bạn về…</div>
        <Link to={o.nextUrl} className="btn btn-primary btn-lg w-full mt-2" style={{ minHeight: 56, maxWidth: 420 }}>{goLabel(o)}</Link>
      </div>
      <OrderSummary o={o} sub />
    </>
  );
}

/** Thẻ chủ hội ở màn chờ: người mua biết đang chờ ai, và nhắn thẳng cho người đó khi chờ lâu. */
function OwnerCard({ seller }: { seller: Seller }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const owner = seller.owner;
  const isSelf = user?.id === owner.id;
  return (
    <Section title="Chủ hội">
      <div className="card px-4 py-4 md:px-5 flex flex-col gap-3.5">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={owner.name} src={owner.avatarUrl} color={owner.coverColor ?? T.ink} size={52} />
          <div className="min-w-0">
            <div className="text-[17px] font-bold truncate">{owner.name}</div>
            <div className="text-[15px] truncate" style={{ color: T.ink2 }}>@{owner.handle}</div>
            <div className="text-[15px] leading-snug" style={{ color: T.ink2 }}>Chủ hội {seller.communityName}</div>
          </div>
        </div>
        {!isSelf && (owner.acceptsMessages ? (
          <>
            <Button variant="dark" size="lg" className="w-full" style={{ minHeight: 52 }} icon={<MessageCircle size={20} />} onClick={() => setOpen(true)}>Nhắn tin cho chủ hội</Button>
            <div className="text-[15px] leading-snug" style={{ color: T.ink2 }}>Gửi ảnh chụp giao dịch nếu chờ lâu, chủ hội sẽ dễ đối chiếu hơn.</div>
          </>
        ) : (
          <>
            <Link to={`/u/${owner.handle}`} className="btn btn-ghost btn-lg w-full" style={{ minHeight: 52 }}><UserRound size={20} />Xem hồ sơ chủ hội</Link>
            <div className="text-[15px] leading-snug" style={{ color: T.ink2 }}>Chủ hội đang tắt nhận tin nhắn riêng. Nếu chờ lâu, bạn xem hồ sơ để tìm cách liên hệ khác.</div>
          </>
        ))}
      </div>
      <MessageModal open={open} onClose={() => setOpen(false)} recipient={{ id: owner.id, name: owner.name }} communityId={seller.communityId} />
    </Section>
  );
}

/**
 * Màn cảm ơn và chờ xác nhận, sau khi người mua bấm "Tôi đã chuyển khoản". Đơn chủ hội tự xác nhận thì chờ chủ hội,
 * các đơn còn lại chờ ngân hàng báo về. Trang vẫn tự hỏi lại nên tự sang màn thành công khi đơn được xác nhận.
 */
function WaitingView({ o, ownerManual }: { o: Order; ownerManual: boolean }) {
  const bank = o.instruction?.kind === 'bank_qr' ? o.instruction : null;
  const seller = o.seller ?? null;
  return (
    <>
      <div className="card px-5 py-7 flex flex-col items-center text-center gap-3" role="status">
        <Spinner size={52} />
        <h1 className="serif text-[24px] leading-tight font-extrabold">Cảm ơn bạn, đã ghi nhận</h1>
        <div className="text-[17px] leading-snug font-semibold" style={{ color: T.primaryText }}>{ownerManual ? 'Đã báo cho chủ hội, đang chờ chủ hội kiểm tra tài khoản và xác nhận' : 'Đang chờ ngân hàng báo về'}</div>
        <div className="text-[15px] leading-snug" style={{ color: T.ink2, maxWidth: 520 }}>
          {ownerManual
            ? 'Chủ hội tự mở tài khoản ngân hàng để đối chiếu, nên nhanh hay chậm tùy lúc chủ hội xem được. Trang này tự cập nhật ngay khi đơn được xác nhận.'
            : 'Ngay khi ngân hàng báo có tiền, đơn tự được xác nhận và trang này tự chuyển. Bạn không cần bấm gì thêm.'}
        </div>
      </div>
      <Section title="Đơn của bạn">
        <OrderSummary o={o} sub extra={bank ? <div className="text-[15px]" style={{ color: T.ink2 }}>Nội dung chuyển khoản <strong style={{ color: T.ink }}>{bank.transferContent}</strong></div> : undefined} />
      </Section>
      {seller && <OwnerCard seller={seller} />}
      {bank && (
        <details className="card overflow-hidden group">
          <summary className="flex items-center gap-2 px-4 md:px-5 font-semibold text-[16px] cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden" style={{ minHeight: 56 }}><span className="flex-grow">Xem lại thông tin chuyển khoản</span><ChevronDown size={20} className="flex-shrink-0 transition-transform group-open:rotate-180" /></summary>
          <div className="flex flex-col gap-3"><div className="text-[15px] leading-snug px-4 md:px-5" style={{ color: T.ink2 }}>Chưa chuyển xong thì dùng lại mã và thông tin dưới đây. Đã chuyển rồi thì không chuyển lần nữa.</div><BankQrCard i={bank} flat /></div>
        </details>
      )}
      <div className="text-[15px] leading-snug text-center" style={{ color: T.ink2 }}>Bạn đóng trang này được. Khi đơn được xác nhận, bạn sẽ nhận thông báo và email.</div>
      <Link to={seller ? `/${seller.communitySlug}` : o.nextUrl} className="btn btn-ghost btn-lg w-full" style={{ minHeight: 52 }}>{seller ? 'Về trang hội' : 'Quay về'}</Link>
    </>
  );
}

/** Chờ trả: hướng dẫn và mã QR (chuyển khoản), hoặc nút mở trang của cổng thanh toán. */
function PayView({ o, ownerManual, onTransferred, sending, error }: { o: Order; ownerManual: boolean; onTransferred: () => void; sending: boolean; error: string | null }) {
  const p = providerMeta(o.provider);
  const failed = o.paymentStatus === 'failed' || o.paymentStatus === 'cancelled';
  return (
    <>
      <OrderSummary o={o} extra={<div className="flex items-center flex-wrap gap-x-2.5 gap-y-1 text-[15px]" style={{ color: T.ink2 }}>Cách thanh toán <ProviderLine p={p} /></div>} />
      {failed && <ErrorBox message="Cổng thanh toán báo giao dịch chưa thành công. Bạn thử lại bên dưới, hoặc quay lại tạo đơn mới với cách thanh toán khác." />}
      {o.instruction?.kind === 'bank_qr' && (
        <>
          <Section title="Cách chuyển khoản"><TransferSteps /></Section>
          <Section title="Mã QR và thông tin chuyển khoản"><BankQrCard i={o.instruction} /></Section>
          {error && <div role="alert" className="text-[15px] leading-snug" style={{ color: T.accentText }}>{error}</div>}
          <Button variant="primary" size="lg" className="w-full" style={{ minHeight: 56 }} loading={sending} onClick={onTransferred}>Tôi đã chuyển khoản</Button>
          {ownerManual
            ? <div className="text-[15px] leading-snug text-center" style={{ color: T.ink2 }}>Chuyển xong thì bấm nút trên để báo chủ hội. Chủ hội kiểm tra tài khoản rồi xác nhận đơn, bạn sẽ nhận thông báo.</div>
            : <Waiting />}
        </>
      )}
      {o.instruction?.kind === 'redirect' && (
        <>
          <Notice>{o.instruction.payee === 'owner' ? `Bạn sẽ trả trên trang của ${p.name}, tiền về thẳng chủ hội. Trả xong, trang này tự chuyển khi cổng báo về.` : `Bạn sẽ trả trên trang của ${p.name}. Trả xong, trang này tự chuyển khi cổng báo về.`}</Notice>
          <a href={o.instruction.url} className="btn btn-primary btn-lg w-full" style={{ height: 'auto', minHeight: 56, whiteSpace: 'normal', padding: '8px 16px', lineHeight: 1.25, textAlign: 'center' }}><ExternalLink size={20} className="flex-shrink-0" /> {p.key === 'stripe' ? 'Mở trang thanh toán thẻ' : `Mở trang ${p.name} để thanh toán`}</a>
          <Waiting text="Đang chờ cổng thanh toán báo về… trang sẽ tự chuyển khi nhận được" />
        </>
      )}
    </>
  );
}

export function OrderView({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  // Đơn còn `pending` (kể cả khi thanh toán đã ở trạng thái đang xử lý) thì hỏi lại 3 giây một lần.
  const q = useQuery({ queryKey: ['order', orderId], queryFn: () => api.get<Order>(`/v1/orders/${orderId}`), refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false) });
  const processing = useMutation({ mutationFn: () => api.post<Order>(`/v1/orders/${orderId}/processing`, {}), onSuccess: (o) => { qc.setQueryData(['order', orderId], o); window.scrollTo({ top: 0 }); } });
  const o = q.data;
  useEffect(() => {
    if (o?.status === 'paid') { const t = setTimeout(() => { window.location.assign(o.nextUrl); }, 2500); return () => clearTimeout(t); }
    return undefined;
  }, [o?.status, o?.nextUrl]);
  if (q.isLoading) return <CheckoutFrame backTo="/"><LoadingBlock /></CheckoutFrame>;
  if (q.isError || !o) return <CheckoutFrame backTo="/"><ErrorBox message={errorMessage(q.error)} onRetry={() => void q.refetch()} /></CheckoutFrame>;
  // Đơn trả thẳng chủ hội mà chủ hội tự bấm xác nhận: không có gì tự đối chiếu, người mua chờ chủ hội.
  const ownerManual = o.instruction?.kind === 'bank_qr' && o.instruction.payee === 'owner' && o.instruction.confirmMode !== 'auto';
  return (
    <CheckoutFrame backTo={o.nextUrl}>
      {o.status === 'paid' && <PaidView o={o} />}
      {o.status === 'pending' && (o.paymentStatus === 'processing'
        ? <WaitingView o={o} ownerManual={ownerManual} />
        : <PayView o={o} ownerManual={ownerManual} onTransferred={() => processing.mutate()} sending={processing.isPending} error={processing.isError ? errorMessage(processing.error) : null} />)}
      {o.status !== 'paid' && o.status !== 'pending' && (
        <>
          <OrderSummary o={o} />
          <ErrorBox message={o.status === 'expired' ? 'Đơn đã hết hạn giữ chỗ. Tạo đơn mới để thanh toán.' : o.status === 'refunded' ? 'Đơn này đã được hoàn tiền.' : 'Đơn này đã bị hủy. Tạo đơn mới để thanh toán.'} />
          <Link to={o.nextUrl} className="btn btn-ghost btn-lg w-full" style={{ minHeight: 52 }}>Quay về</Link>
        </>
      )}
    </CheckoutFrame>
  );
}
