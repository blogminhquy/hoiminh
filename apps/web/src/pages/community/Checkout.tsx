// Thanh toán: /:slug/thanh-toan (chọn gói, cổng) và /thanh-toan/:orderId (QR hoặc chuyển hướng, chờ tiền về 3 giây/lần, xong tự chuyển).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, T, money } from '@hoiminh/ui';
import { Check, ExternalLink } from 'lucide-react';
import { useEffect } from 'react';
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { ErrorBox } from '@hoiminh/ui';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useShellQuery } from '@/lib/community';
import { fmtDateTime } from '@/lib/format';
import { CheckoutConfigure } from './CheckoutConfigure';
import { BankQrCard, CheckoutFrame, PROVIDERS, ProviderOption, Waiting, type Instruction } from './CheckoutParts';

interface Order { orderId: string; status: 'pending' | 'paid' | 'refunded' | 'expired' | 'cancelled'; paidAt: string | null; reference: string; amountMinor: number; provider: string | null; paymentStatus: string | null; instruction: Instruction | null; title: string; nextUrl: string; expiresAt: string | null }

function OrderView({ orderId }: { orderId: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['order', orderId], queryFn: () => api.get<Order>(`/v1/orders/${orderId}`), refetchInterval: (query) => (query.state.data?.status === 'pending' ? 3000 : false) });
  const processing = useMutation({ mutationFn: () => api.post<Order>(`/v1/orders/${orderId}/processing`, {}), onSuccess: (o) => qc.setQueryData(['order', orderId], o) });
  const o = q.data;
  useEffect(() => {
    if (o?.status === 'paid') { const t = setTimeout(() => { window.location.assign(o.nextUrl); }, 2500); return () => clearTimeout(t); }
    return undefined;
  }, [o?.status, o?.nextUrl]);
  const back = o?.nextUrl ?? '/kham-pha';
  if (q.isLoading) return <CheckoutFrame backTo="/kham-pha"><LoadingBlock /></CheckoutFrame>;
  if (q.isError || !o) return <CheckoutFrame backTo="/kham-pha"><ErrorBox message={errorMessage(q.error)} onRetry={() => void q.refetch()} /></CheckoutFrame>;
  const p = PROVIDERS.find((x) => x.key === o.provider) ?? PROVIDERS[0]!;
  return (
    <CheckoutFrame backTo={back}>
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-[520px]">
          <div className="card p-6 flex flex-col gap-3">
            <div className="muted text-[12px]">Đơn hàng · mã {o.reference}</div>
            <div className="serif text-[22px] font-extrabold">{o.title}</div>
            <div className="flex items-baseline pt-2" style={{ borderTop: `1px solid ${T.line}` }}><span className="flex-grow font-bold">Tổng thanh toán</span><span className="serif text-[24px] font-extrabold">{money(o.amountMinor)}</span></div>
            {o.expiresAt && o.status === 'pending' && <div className="muted text-[12px]">Đơn giữ chỗ đến {fmtDateTime(o.expiresAt)}</div>}
          </div>
        </div>
        <div className="w-full md:w-[520px] flex flex-col gap-3 md:pt-9">
          {o.status === 'paid' && (
            <div className="card p-6 flex flex-col items-center text-center gap-2" style={{ background: T.tealSoft, borderColor: T.tealSoft }}>
              <span className="w-12 h-12 rounded-full inline-flex items-center justify-center" style={{ background: T.teal, color: T.surface }}><Check size={24} /></span>
              <div className="serif text-[20px] font-extrabold">Đã nhận thanh toán</div>
              <div className="text-[13px]" style={{ color: T.tealText }}>Quyền truy cập đã mở{o.paidAt ? ` lúc ${fmtDateTime(o.paidAt)}` : ''}. Đang chuyển bạn về…</div>
              <Link to={o.nextUrl} className="btn btn-dark btn-sm mt-1">Đi ngay</Link>
            </div>
          )}
          {o.status === 'expired' && <ErrorBox message="Đơn đã hết hạn giữ chỗ. Tạo đơn mới để thanh toán." />}
          {o.status === 'pending' && (
            <>
              <span className="font-semibold">Cách thanh toán</span>
              <ProviderOption p={p} on />
              {o.instruction?.kind === 'bank_qr' && <BankQrCard i={o.instruction} />}
              {o.instruction?.kind === 'redirect' && (
                <a href={o.instruction.url} className="btn btn-dark" style={{ height: 48, fontSize: 15 }}><ExternalLink size={16} /> Mở trang {p.name} để thanh toán</a>
              )}
              {o.instruction?.kind === 'bank_qr' && (
                <Button variant="primary" size="lg" className="mt-1.5" loading={processing.isPending} disabled={o.paymentStatus === 'processing'} onClick={() => processing.mutate()}>{o.paymentStatus === 'processing' ? 'Đã ghi nhận, đang đối chiếu' : 'Tôi đã chuyển khoản'}</Button>
              )}
              <Waiting />
            </>
          )}
        </div>
      </div>
    </CheckoutFrame>
  );
}

export default function Page() {
  const { orderId, slug } = useParams<{ orderId?: string; slug?: string }>();
  const [sp] = useSearchParams();
  const { user, loading } = useAuth();
  const location = useLocation();
  const shell = useShellQuery(orderId ? null : slug);
  if (!user && !loading) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (loading) return <CheckoutFrame backTo="/kham-pha"><LoadingBlock /></CheckoutFrame>;
  if (orderId) return <OrderView orderId={orderId} />;
  if (shell.isLoading) return <CheckoutFrame backTo="/kham-pha"><LoadingBlock /></CheckoutFrame>;
  if (shell.isError || !shell.data) return <CheckoutFrame backTo="/kham-pha"><ErrorBox message={errorMessage(shell.error)} /></CheckoutFrame>;
  return <CheckoutConfigure shell={shell.data} tierKey={sp.get('tier')} productId={sp.get('product')} initialCycle={sp.get('cycle')} ref={sp.get('ref')} />;
}
