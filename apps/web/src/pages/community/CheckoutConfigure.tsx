// Bước chọn: /:slug/thanh-toan?tier=premium&months=3 hoặc ?product=<id> → chọn kỳ hạn, mã giảm giá, cổng → POST /v1/checkout.
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, CommunityMark, Radio, T, money } from '@hoiminh/ui';
import { Check, Lock, Tag } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import type { Shell } from '@/lib/community';
import { modeChoices, promoEndLabel, type TermChoice } from '@/lib/membership';
import { BUYER_METHOD_NAME, initialMethod } from '@/lib/payment-methods';
import { CheckoutFrame, ProviderOption, Totals, providerMeta, type Provider } from './CheckoutParts';

/** Lời giới thiệu từng cách ở bước thanh toán của hội: nói rõ tiền về thẳng chủ hội. */
function buyerDesc(k: Provider, community: string, bankMode: 'manual' | 'auto' | null): string {
  if (k === 'sepay') return bankMode === 'auto' ? `Quét bằng app ngân hàng, tiền chuyển thẳng tới chủ hội ${community}, mở quyền ngay khi tiền về` : `Quét bằng app ngân hàng, tiền chuyển thẳng tới chủ hội ${community}`;
  if (k === 'momo') return 'Xác nhận ngay trong ví MoMo, tiền về thẳng chủ hội';
  if (k === 'vnpay') return 'Thẻ ATM nội địa, thẻ quốc tế hoặc QR ngân hàng';
  if (k === 'paypal') return 'Trả bằng USD qua PayPal, hợp với khách ở nước ngoài';
  return 'Thẻ quốc tế, thanh toán an toàn qua Stripe';
}

interface ProductLite { id: string; name: string; priceMinor: number; compareAtMinor: number | null; kind: string; slug: string }
interface ProductList { items: ProductLite[] }

function CycleCard({ on, title, sub, badge, onClick }: { on: boolean; title: string; sub: ReactNode; badge?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex-1 min-w-[150px] p-3.5 rounded-xl text-left relative" style={{ border: `1.5px solid ${on ? T.primary : T.line2}`, background: on ? T.primarySoft : T.surface }}>
      {badge && <span className="tag absolute -top-2.5 right-3" style={{ background: T.ink, color: T.surface }}>{badge}</span>}
      <span className="flex items-center gap-2"><Radio on={on} /><span className="font-semibold">{title}</span></span>
      <span className="block pl-[26px] text-[13px]" style={{ color: T.ink2 }}>{sub}</span>
    </button>
  );
}

/** Lựa chọn mở sẵn: đúng số tháng trên đường dẫn nếu có, không thì theo `cycle` kiểu cũ, không thì kỳ ngắn nhất. */
function initialChoice(list: TermChoice[], cycle: string | null, months: string | null): number | null {
  const want = cycle === 'one_time' ? null : Number(months) || (cycle === 'yearly' ? 12 : cycle === 'monthly' ? 1 : 0);
  return (list.find((x) => x.months === want) ?? list[0])?.months ?? null;
}

export function CheckoutConfigure({ shell, tierKey, productId, initialCycle, initialMonths, ref }: { shell: Shell; tierKey: string | null; productId: string | null; initialCycle: string | null; initialMonths: string | null; ref: string | null }) {
  const navigate = useNavigate();
  const c = shell.community;
  const premium = shell.premium;
  const choices = modeChoices(premium, c.pricingMode);
  const [months, setMonths] = useState<number | null>(() => initialChoice(choices, initialCycle, initialMonths));
  const choice = choices.find((x) => x.months === months) ?? choices[0] ?? null;
  // Đơn của hội: tiền về thẳng chủ hội, bằng chuyển khoản QR hoặc qua cổng riêng của chủ hội. Người mua chỉ thấy cách
  // chủ hội đã cài và đang bật; cách chủ hội đặt làm mặc định được chọn sẵn.
  const methods = c.paymentMethods ?? [];
  const [picked, setPicked] = useState<Provider | null>(null);
  const provider: Provider | null = picked && methods.includes(picked) ? picked : initialMethod(methods, c.defaultPaymentMethod);
  const ready = c.paymentsReady && provider !== null;
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const products = useQuery({ queryKey: ['products', c.id], queryFn: () => api.get<ProductList>(`/v1/communities/${c.id}/products`), enabled: Boolean(productId) });
  const product = productId ? products.data?.items.find((p) => p.id === productId || p.slug === productId) ?? null : null;

  const m = useMutation({
    mutationFn: () => api.post<{ orderId: string }>('/v1/checkout', {
      target: product ? { type: 'product', productId: product.id } : { type: 'tier', communityId: c.id, tierKey: tierKey ?? 'premium', ...(choice?.months ? { cycle: choice.months === 12 ? 'yearly' : 'monthly', months: choice.months } : { cycle: 'one_time' }) },
      provider: provider ?? undefined, couponCode: applied ?? undefined, ref: ref ?? undefined,
    }),
    onSuccess: (r) => navigate(`/thanh-toan/${r.orderId}`),
  });

  if (productId && products.isLoading) return <CheckoutFrame backTo={`/${c.slug}/cua-hang`}><LoadingBlock /></CheckoutFrame>;
  const listAmount = product ? product.priceMinor : choice?.listMinor ?? 0;
  const amount = product ? product.priceMinor : choice?.payMinor ?? 0;
  const promo = !product && choice && choice.percentOff > 0 ? premium?.promo ?? null : null;
  const promoEnd = promoEndLabel(promo);
  const title = product ? product.name : 'Gói Premium';
  const line = product ? product.name : `Premium · ${choice?.months ? `${choice.months} tháng` : 'trọn đời'}`;
  const benefits = product ? ['Truy cập trọn đời', 'Cập nhật miễn phí', 'Hoàn tiền 7 ngày nếu xem chưa quá 20%'] : premium?.benefits ?? [];

  return (
    <CheckoutFrame backTo={product ? `/${c.slug}/cua-hang` : `/${c.slug}/bang-tin`}>
      <div className="flex flex-col md:flex-row gap-8">
        <div className="w-full md:w-[520px]">
          <div className="card p-6 flex flex-col gap-4">
            <div className="flex gap-3.5 items-center">
              <CommunityMark mark={c.logoMark} color={c.logoColor} url={c.logoUrl} size={56} radius={14} />
              <div><div className="muted text-[12px]">{product ? 'Mua tại' : 'Nâng cấp tại'} {c.name}</div><div className="serif text-[22px] font-extrabold">{title}</div></div>
            </div>
            {!product && promo && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-[14px] font-semibold" style={{ background: T.goldSoft, color: T.goldDark }}><Tag size={16} />Đang giảm {promo.percentOff}%{promoEnd ? ` đến hết ngày ${promoEnd}` : ''}</div>
            )}
            {!product && choices.length > 0 && (
              <div className="flex gap-2.5 flex-col sm:flex-row sm:flex-wrap">
                {choices.map((x) => (
                  <CycleCard
                    key={x.months ?? 'once'}
                    on={choice?.months === x.months}
                    title={x.months ? `${x.months} tháng` : 'Trọn đời'}
                    badge={x.savingPercent > 0 ? `Rẻ hơn ${x.savingPercent}%` : undefined}
                    sub={<>{x.percentOff > 0 && <span className="line-through muted mr-1.5">{money(x.listMinor)}</span>}<strong style={{ color: T.ink }}>{money(x.payMinor)}</strong>{x.months && x.months > 1 ? ` · ${money(Math.round(x.payMinor / x.months))} mỗi tháng` : x.months ? '' : ' một lần'}</>}
                    onClick={() => setMonths(x.months)}
                  />
                ))}
              </div>
            )}
            <div className="flex flex-col gap-2 text-[13px] pt-1" style={{ color: T.ink2 }}>
              {benefits.map((b) => <div key={b} className="flex items-center gap-2"><span style={{ color: T.teal }}><Check size={14} /></span>{b}</div>)}
            </div>
            <div className="flex gap-2 pt-2" style={{ borderTop: `1px solid ${T.line}` }}>
              <div className="input flex-1 min-w-0" style={{ width: 'auto' }}><input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Mã giảm giá" className="flex-grow" /></div>
              <Button className="flex-shrink-0" onClick={() => setApplied(coupon.trim() || null)}>{applied ? 'Đã áp dụng' : 'Áp dụng'}</Button>
            </div>
            <Totals lines={[{ label: line, amountMinor: listAmount }, { label: promo ? `Khuyến mãi ${promo.percentOff}%` : 'Giảm giá', amountMinor: amount - listAmount }]} total={amount} referredBy={null} />
            {applied && <div className="muted text-[12px]">Mã {applied} sẽ được kiểm tra khi tạo đơn.</div>}
          </div>
        </div>
        <div className="w-full md:w-[520px] flex flex-col gap-3 md:pt-9">
          <span className="font-semibold">Cách thanh toán</span>
          {ready && (
            <div className="flex flex-col gap-2.5" role="radiogroup" aria-label="Cách thanh toán">
              {methods.map((k) => <ProviderOption key={k} p={{ ...providerMeta(k), desc: buyerDesc(k, c.name, c.bankConfirmMode) }} on={provider === k} onClick={() => setPicked(k)} />)}
            </div>
          )}
          {m.isError && <div className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
          {ready ? (
            <Button variant="primary" size="lg" loading={m.isPending} disabled={!amount} onClick={() => m.mutate()} className="mt-1.5">{provider === 'sepay' ? 'Lấy mã QR chuyển khoản' : `Thanh toán ${money(amount)} bằng ${BUYER_METHOD_NAME[provider!]}`}</Button>
          ) : (
            <>
              <Button size="lg" disabled className="mt-1.5" icon={<Lock size={18} />}>Hội chưa mở thanh toán</Button>
              <div className="text-[14px] text-center" style={{ color: T.goldText }}>{shell.viewer.permissions.includes('billing.manage')
                ? <>Bạn chưa cài cách nhận tiền nào. <Link to={`/${c.slug}/cai-dat/nhan-tien`} className="font-semibold underline">Cài nhận tiền</Link> để mở nút mua.</>
                : 'Chủ hội chưa cài cách nhận tiền nên chưa mua được. Bạn quay lại sau nhé.'}</div>
            </>
          )}
          <div className="muted text-[13px] text-center">Hội Mình không thu phí giao dịch và không giữ tiền của bạn</div>
        </div>
      </div>
    </CheckoutFrame>
  );
}
