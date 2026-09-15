// Bước chọn: /:slug/thanh-toan?tier=premium&cycle=yearly hoặc ?product=<id> → chọn chu kỳ, mã giảm giá, cổng → POST /v1/checkout.
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, CommunityMark, Radio, T, money } from '@hoiminh/ui';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import type { Shell } from '@/lib/community';
import { CheckoutFrame, PROVIDERS, ProviderOption, Totals, type Provider } from './CheckoutParts';

type Cycle = 'monthly' | 'yearly' | 'one_time';
interface ProductLite { id: string; name: string; priceMinor: number; compareAtMinor: number | null; kind: string; slug: string }
interface ProductList { items: ProductLite[] }

function CycleCard({ on, title, sub, badge, onClick }: { on: boolean; title: string; sub: string; badge?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex-1 p-3.5 rounded-xl text-left relative" style={{ border: `1.5px solid ${on ? T.accent : T.line2}`, background: on ? T.accentSoft : T.surface }}>
      {badge && <span className="tag absolute -top-2.5 right-3" style={{ background: T.ink, color: T.surface }}>{badge}</span>}
      <span className="flex items-center gap-2"><Radio on={on} /><span className="font-semibold">{title}</span></span>
      <span className="block pl-[26px] text-[13px]" style={{ color: T.ink2 }}>{sub}</span>
    </button>
  );
}

export function CheckoutConfigure({ shell, tierKey, productId, initialCycle, ref }: { shell: Shell; tierKey: string | null; productId: string | null; initialCycle: string | null; ref: string | null }) {
  const navigate = useNavigate();
  const c = shell.community;
  const premium = shell.premium;
  const [cycle, setCycle] = useState<Cycle>(initialCycle === 'monthly' || initialCycle === 'one_time' ? initialCycle : premium?.yearlyMinor ? 'yearly' : premium?.monthlyMinor ? 'monthly' : 'one_time');
  const [provider, setProvider] = useState<Provider>('sepay');
  const [coupon, setCoupon] = useState('');
  const [applied, setApplied] = useState<string | null>(null);
  const products = useQuery({ queryKey: ['products', c.id], queryFn: () => api.get<ProductList>(`/v1/communities/${c.id}/products`), enabled: Boolean(productId) });
  const product = productId ? products.data?.items.find((p) => p.id === productId || p.slug === productId) ?? null : null;
  const enabled = c.enabledProviders.length ? c.enabledProviders : ['sepay', 'momo', 'vnpay'];

  const m = useMutation({
    mutationFn: () => api.post<{ orderId: string }>('/v1/checkout', {
      target: product ? { type: 'product', productId: product.id } : { type: 'tier', communityId: c.id, tierKey: tierKey ?? 'premium', cycle },
      provider, couponCode: applied ?? undefined, ref: ref ?? undefined, returnUrl: `${window.location.origin}/thanh-toan/`,
    }),
    onSuccess: (r) => navigate(`/thanh-toan/${r.orderId}`),
  });

  if (productId && products.isLoading) return <CheckoutFrame backTo={`/${c.slug}/cua-hang`}><LoadingBlock /></CheckoutFrame>;
  const amount = product ? product.priceMinor : cycle === 'monthly' ? premium?.monthlyMinor ?? 0 : cycle === 'yearly' ? premium?.yearlyMinor ?? 0 : premium?.oneTimeMinor ?? 0;
  const title = product ? product.name : 'Gói Premium';
  const line = product ? product.name : `Premium · ${cycle === 'monthly' ? '1 tháng' : cycle === 'yearly' ? '12 tháng' : 'trọn đời'}`;
  const savePct = premium?.monthlyMinor && premium.yearlyMinor ? Math.round((1 - premium.yearlyMinor / (premium.monthlyMinor * 12)) * 100) : 0;
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
            {!product && premium && (
              <div className="flex gap-2.5 flex-col sm:flex-row">
                {premium.monthlyMinor ? <CycleCard on={cycle === 'monthly'} title="Theo tháng" sub={`${money(premium.monthlyMinor)} / tháng`} onClick={() => setCycle('monthly')} /> : null}
                {premium.yearlyMinor ? <CycleCard on={cycle === 'yearly'} title="Theo năm" sub={`${money(premium.yearlyMinor)} / năm · ${money(Math.round(premium.yearlyMinor / 12))} mỗi tháng`} badge={savePct > 0 ? `Tiết kiệm ${savePct}%` : undefined} onClick={() => setCycle('yearly')} /> : null}
                {premium.oneTimeMinor ? <CycleCard on={cycle === 'one_time'} title="Trọn đời" sub={`${money(premium.oneTimeMinor)} một lần`} onClick={() => setCycle('one_time')} /> : null}
              </div>
            )}
            <div className="flex flex-col gap-2 text-[13px] pt-1" style={{ color: T.ink2 }}>
              {benefits.map((b) => <div key={b} className="flex items-center gap-2"><span style={{ color: T.teal }}><Check size={14} /></span>{b}</div>)}
            </div>
            <div className="flex gap-2 pt-2" style={{ borderTop: `1px solid ${T.line}` }}>
              <div className="input flex-grow" style={{ height: 40 }}><input value={coupon} onChange={(e) => setCoupon(e.target.value.toUpperCase())} placeholder="Mã giảm giá" className="flex-grow" /></div>
              <Button onClick={() => setApplied(coupon.trim() || null)}>{applied ? 'Đã áp dụng' : 'Áp dụng'}</Button>
            </div>
            <Totals lines={[{ label: line, amountMinor: amount }, { label: 'Giảm giá', amountMinor: 0 }]} total={amount} referredBy={null} />
            {applied && <div className="muted text-[12px]">Mã {applied} sẽ được kiểm tra khi tạo đơn.</div>}
          </div>
        </div>
        <div className="w-full md:w-[520px] flex flex-col gap-3 md:pt-9">
          <span className="font-semibold">Chọn cách thanh toán</span>
          {PROVIDERS.map((p) => <ProviderOption key={p.key} p={p} on={provider === p.key} disabled={!enabled.includes(p.key)} onClick={() => setProvider(p.key)} />)}
          {m.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
          <Button variant="primary" size="lg" loading={m.isPending} disabled={!amount} onClick={() => m.mutate()} className="mt-1.5">{provider === 'sepay' ? 'Lấy mã QR chuyển khoản' : `Thanh toán qua ${PROVIDERS.find((p) => p.key === provider)?.name}`}</Button>
          <div className="muted text-[12px] text-center">Không thu phí giao dịch · hóa đơn gửi về email của bạn</div>
        </div>
      </div>
    </CheckoutFrame>
  );
}
