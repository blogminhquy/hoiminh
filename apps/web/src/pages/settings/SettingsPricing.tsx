// Cài đặt · Giá và gói (pricingMain): kiểu thu phí, 3 thẻ gói (mỗi gói nhiều kỳ hạn), khuyến mãi, cách thanh toán, xếp thành viên trả phí cũ; nút Đóng cổng / Xem trước / Lưu.
import { normalizeTerms, termLabel, type PricingPromo } from '@hoiminh/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Select, T } from '@hoiminh/ui';
import { Globe, Lock, QrCode, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { shellKey, useShell } from '@/lib/community';
import { DEFAULT_TIERS, ModePicker, PromoCard, TierCard, type Mode, type Tier } from './SettingsPricingParts';

interface Pricing { pricingMode: Mode; doorsOpen: boolean; enabledProviders: string[]; tiers: Tier[]; paidMembersCount: number; /** Khuyến mãi đã lưu (null là đang tắt). */ promo: PricingPromo | null }

export default function Page() {
  const shell = useShell();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['pricing', shell.community.id], queryFn: () => api.get<Pricing>(`/v1/communities/${shell.community.id}/pricing`) });
  const [f, setF] = useState<Pricing | null>(null);
  const [migrate, setMigrate] = useState<'standard' | 'premium' | 'vip'>('premium');
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data && !f) setF({ ...q.data, promo: q.data.promo ?? null, tiers: q.data.tiers.length ? q.data.tiers.map((t) => ({ ...t, terms: t.terms ?? [] })) : DEFAULT_TIERS }); }, [q.data, f]);
  const save = useMutation({
    mutationFn: (override?: Partial<Pricing>) => { const p = { ...f!, ...override }; return api.put<Pricing>(`/v1/communities/${shell.community.id}/pricing`, { pricingMode: p.pricingMode, doorsOpen: p.doorsOpen, tiers: p.tiers.map((t) => ({ ...t, terms: normalizeTerms(t.terms), benefits: t.benefits.filter((b) => b.trim()) })), promo: p.promo, enabledProviders: p.enabledProviders, migrateExistingPaidToTierKey: migrate }); },
    onSuccess: (d) => { setF({ ...d, promo: d.promo ?? null }); setSaved(true); setTimeout(() => setSaved(false), 2000); void qc.invalidateQueries({ queryKey: shellKey(shell.community.slug) }); void qc.invalidateQueries({ queryKey: ['pricing'] }); },
  });
  if (!f) return <LoadingBlock rows={4} />;
  const patch = (p: Partial<Pricing>) => setF({ ...f, ...p });
  const setTier = (t: Tier) => patch({ tiers: f.tiers.map((x) => (x.key === t.key ? t : x)) });
  const paid = f.pricingMode !== 'free';
  // Một giá đang bán của gói trả phí đầu tiên, để thẻ khuyến mãi ghi ví dụ bằng số thật.
  const sampleTier = f.tiers.find((t) => t.key !== 'standard' && t.isActive);
  const sampleTerm = sampleTier ? normalizeTerms(sampleTier.terms)[0] : undefined;
  const sample = !sampleTier ? null : f.pricingMode === 'one_time' ? (sampleTier.oneTimeMinor ? { label: `${sampleTier.name} trọn đời`, amountMinor: sampleTier.oneTimeMinor } : null) : sampleTerm ? { label: `${sampleTier.name} ${termLabel(sampleTerm.months)}`, amountMinor: sampleTerm.amountMinor } : null;
  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="serif m-0 text-[28px] font-bold">Giá và gói</h1>
        <span className="flex-grow" />
        <Button size="sm" loading={save.isPending && save.variables !== undefined} onClick={() => save.mutate({ doorsOpen: !f.doorsOpen })}><Lock size={14} />{f.doorsOpen ? 'Đóng cổng' : 'Mở cổng'}</Button>
        <Link to={`/${shell.community.slug}`} className="btn btn-ghost btn-sm"><Globe size={14} />Xem trước</Link>
        <Button size="sm" variant="dark" loading={save.isPending && save.variables === undefined} onClick={() => save.mutate(undefined)}>{saved ? 'Đã lưu' : 'Lưu thay đổi'}</Button>
      </div>
      {!f.doorsOpen && <div className="px-4 py-3 rounded-xl text-[13px]" style={{ background: T.goldSoft, color: T.goldDark }}>Cổng đang đóng: thành viên hiện tại vẫn vào bình thường, người mới không thể tham gia hay mua gói.</div>}
      {save.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</div>}
      <ModePicker value={f.pricingMode} onChange={(pricingMode) => patch({ pricingMode })} />
      {paid && <div className="flex gap-4 flex-wrap">{f.tiers.map((t) => <TierCard key={t.key} t={t} mode={f.pricingMode} onChange={setTier} />)}</div>}
      {paid && <PromoCard promo={f.promo} onChange={(promo) => patch({ promo })} sample={sample} />}
      {f.pricingMode === 'free' && <div className="muted text-[13px]">Hội miễn phí: mọi thành viên ở gói Tiêu chuẩn, vẫn có thể bán khóa học lẻ trong Cửa hàng.</div>}
      <div className="card flex flex-col gap-3.5" style={{ padding: '16px 20px' }}>
        <div className="flex items-center gap-2.5 flex-wrap">
          <QrCode size={18} className="flex-shrink-0" />
          <div className="flex flex-col flex-grow min-w-0" style={{ flexBasis: 240 }}>
            <span className="font-semibold">Cách thanh toán: chuyển khoản tới tài khoản của bạn</span>
            <span className="muted text-[14px]">{shell.community.paymentsReady ? 'Người mua quét mã QR, tiền về thẳng tài khoản bạn đã cài.' : 'Hội chưa cài nhận tiền nên các nút mua đang khóa.'}</span>
          </div>
          <Link to={`/${shell.community.slug}/cai-dat/nhan-tien`} className={`btn btn-sm ${shell.community.paymentsReady ? 'btn-ghost' : 'btn-primary'}`}>{shell.community.paymentsReady ? 'Tài khoản nhận tiền' : 'Cài nhận tiền'}</Link>
        </div>
        {f.paidMembersCount > 0 && (
          <div className="flex items-center gap-2.5 text-[13px] pt-3 flex-wrap" style={{ color: T.ink2, borderTop: `1px solid ${T.line}` }}><Users size={16} />{f.paidMembersCount} thành viên trả phí từ trước sẽ được xếp vào gói <Select aria-label="Gói cho thành viên trả phí từ trước" value={migrate} onChange={(e) => setMigrate(e.target.value as typeof migrate)} style={{ width: 'fit-content', minWidth: 150 }}>{f.tiers.map((t) => <option key={t.key} value={t.key}>{t.name}</option>)}</Select></div>
        )}
      </div>
    </>
  );
}
