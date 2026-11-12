// Hệ thống · Gói nền tảng và Tính năng (hai tab của nhóm "Gói và tính năng").
// Tab Gói: bảng bốn gói (Miễn phí, Khởi đầu, Chuyên nghiệp, Không giới hạn), mỗi gói cho một hội. Quản trị chỉ nhập
// giá mỗi tháng và trần thành viên, bật tắt bốn tính năng trả phí; giá 3 tháng (bằng 3 lần) và 1 năm (bằng 10 lần) tự tính.
// Lưu cả bảng một lần (PUT /v1/admin/plans). Tab Tính năng bật tắt các cờ có tác dụng thật.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PLAN_FEATURES, PLAN_FEATURE_LABEL, planPrice, type PlanDef, type PlanFeature, type PlanKey } from '@hoiminh/contracts';
import { Button, T, Toggle, money } from '@hoiminh/ui';
import { Lock } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { fmtShortMoney } from '@/lib/format';
import { num as fmtCount } from '@/lib/platform-plan';

interface PlanRow extends PlanDef { communities: number; quarterlyCount: number; yearlyCount: number; mrrMinor: number }
interface Stats { plans: PlanRow[]; paidCommunities: number; totalCommunities: number; mrrMinor: number }
interface Flag { key: string; description: string; enabled: boolean; rules: Record<string, unknown> }
interface AffiliateInfo { program: { commissionRateBps: number; commissionDurationMonths: number | null }; stats: { paidThisMonthMinor: number } }
// Khóa phải khớp `featureFlags` trong seed và hằng FLAG ở packages/core.
const FLAG_LABEL: Record<string, string> = { realtime_chat: 'Tin nhắn thời gian thực', go_live: 'Phát trực tiếp trong hội', affiliate_leaderboard: 'Bảng xếp hạng cộng sự', store: 'Cửa hàng trong hội', mcp: 'MCP cho AI', gamification: 'Điểm và cấp độ hoạt động', paypal: 'Cổng PayPal' };
/** Cờ đang chặn đường chạy thật (không chỉ hiển thị): ghi rõ tắt thì mất gì. */
const FLAG_EFFECT: Record<string, string> = { store: 'tắt: ẩn tab Cửa hàng ở mọi hội và chặn mua sản phẩm', affiliate_leaderboard: 'tắt: ẩn tab Xếp hạng cộng sự ở mọi hội', mcp: 'tắt: MCP server không khởi động được', paypal: 'tắt: không chọn được PayPal khi thanh toán' };
/** Cờ của tính năng chưa xây (thuộc V2): bật hay tắt chưa đổi gì, nên không hiện để khỏi gây hiểu nhầm. */
const NO_EFFECT = new Set(['realtime_chat', 'go_live', 'gamification']);
/** Công tắc toàn hệ thống (không phải tính năng của hội): có thẻ riêng ở trang Gói nền tảng, không nằm trong danh sách tính năng. */
const INSTALL_GATE = 'install_gate';
const isFeature = (f: { key: string }) => !NO_EFFECT.has(f.key) && f.key !== INSTALL_GATE;

/** Luật đã chốt trong kế hoạch 11/11/2026: nằm trong mã, không sửa ở màn này. */
const FIXED_RULES = [
  'Không thu phí trên doanh thu ở mọi gói.',
  'Chỉ bán hai chu kỳ: 3 tháng (bằng 3 lần giá tháng) và 1 năm (bằng 10 lần giá tháng).',
  'Không có dùng thử. Mỗi tài khoản một hội miễn phí, hội thứ hai trở đi trả ngay khi tạo.',
  'Mọi gói đều bán hàng và thu tiền được.',
  'Chạm trần thành viên thì không nhận thêm người mới, không xóa ai.',
  'Nâng gói thì số ngày còn lại của gói cũ được tặng sang gói mới.',
];

interface Draft { key: PlanKey; name: string; price: string; cap: string; features: PlanFeature[] }
const digits = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);
const toDraft = (p: PlanDef): Draft => ({ key: p.key, name: p.name, price: String(p.monthlyMinor), cap: p.memberCap === null ? '' : String(p.memberCap), features: [...p.features] });
const sameDraft = (a: Draft[], b: Draft[]) => JSON.stringify(a) === JSON.stringify(b);
const inputStyle = { height: 48, border: `1px solid ${T.line2}`, background: T.surface, borderRadius: 10, fontSize: 17, fontWeight: 700, textAlign: 'right' as const, padding: '0 14px', width: '100%' };

/** Bảng bốn gói: sửa giá mỗi tháng, trần thành viên và tính năng của từng gói, lưu cả bảng một lần. */
function PlanTable({ stats }: { stats: Stats }) {
  const qc = useQueryClient();
  const saved = stats.plans.map(toDraft);
  const [rows, setRows] = useState<Draft[]>(saved);
  const patch = (key: PlanKey, change: Partial<Draft>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...change } : r)));
  const m = useMutation({
    mutationFn: () => api.put<PlanDef[]>('/v1/admin/plans', { plans: rows.map((r) => ({ key: r.key, monthlyMinor: Number(r.price || 0), memberCap: r.cap ? Number(r.cap) : null, features: r.features })) }),
    onSuccess: (list) => { setRows(list.map(toDraft)); void qc.invalidateQueries({ queryKey: ['admin', 'plans'] }); void qc.invalidateQueries({ queryKey: ['plans'] }); },
  });
  const dirty = !sameDraft(rows, saved);
  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 items-start">
        {rows.map((r) => {
          const stat = stats.plans.find((p) => p.key === r.key);
          const free = r.key === 'free';
          const price = Number(r.price || 0);
          return (
            <div key={r.key} className="card flex flex-col gap-3.5 p-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-[19px] font-extrabold">{r.name}</span>
                <span className="text-[13px]" style={{ color: T.ink3 }}>{fmtCount(stat?.communities ?? 0)} hội{stat && !free ? ` · ${fmtShortMoney(stat.mrrMinor)}/tháng` : ''}</span>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold">Giá mỗi tháng (đồng)</span>
                <input type="text" inputMode="numeric" aria-label={`Giá mỗi tháng, gói ${r.name}`} value={free ? '0' : r.price} disabled={free} onChange={(e) => patch(r.key, { price: digits(e.target.value, 9) })} style={{ ...inputStyle, opacity: free ? 0.6 : 1 }} />
              </label>
              <div className="flex flex-col text-[14px]" style={{ borderTop: `1px solid ${T.line}` }}>
                <div className="flex items-baseline gap-2 py-2.5" style={{ borderBottom: `1px solid ${T.line}` }}><span style={{ color: T.ink2 }}>3 tháng</span><span className="flex-grow" /><span className="font-bold text-[15px]">{money(planPrice(price, 'quarterly'))}</span></div>
                <div className="flex items-baseline gap-2 py-2.5" style={{ borderBottom: `1px solid ${T.line}` }}><span style={{ color: T.ink2 }}>1 năm</span><span className="flex-grow" /><span className="font-bold text-[15px]">{money(planPrice(price, 'yearly'))}</span></div>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="text-[14px] font-semibold">Trần thành viên</span>
                <input type="text" inputMode="numeric" aria-label={`Trần thành viên, gói ${r.name}`} value={r.cap} placeholder="Không giới hạn" onChange={(e) => patch(r.key, { cap: digits(e.target.value, 7) })} style={inputStyle} />
              </label>
              <div className="flex flex-col gap-1">
                {PLAN_FEATURES.map((f) => {
                  const on = r.features.includes(f);
                  return (
                    <div key={f} className="flex items-center gap-2.5" style={{ minHeight: 44 }}>
                      <Toggle on={on} label={`${PLAN_FEATURE_LABEL[f]}, gói ${r.name}`} onChange={(v) => patch(r.key, { features: v ? PLAN_FEATURES.filter((x) => x === f || r.features.includes(x)) : r.features.filter((x) => x !== f) })} />
                      <span className="text-[14px]">{PLAN_FEATURE_LABEL[f]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 flex-wrap">
        {m.isError && <span className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}
        {m.isSuccess && !dirty && <span className="text-[14px]" style={{ color: T.tealText }}>Đã lưu bảng gói.</span>}
        <span className="flex-grow" />
        {dirty && <Button onClick={() => { setRows(saved); m.reset(); }}>Bỏ thay đổi</Button>}
        <Button variant="primary" size="lg" disabled={!dirty} loading={m.isPending} onClick={() => m.mutate()}>Lưu bảng gói</Button>
      </div>
    </div>
  );
}

export default function Page() {
  const qc = useQueryClient();
  // Cùng một trang phục vụ hai tab: /he-thong/goi (gói, cộng sự nền tảng) và /he-thong/tinh-nang (cờ tính năng).
  const featuresView = useLocation().pathname.endsWith('/tinh-nang');
  const stats = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api.get<Stats>('/v1/admin/plans') });
  const flags = useQuery({ queryKey: ['admin', 'flags'], queryFn: () => api.get<Flag[]>('/v1/admin/flags') });
  const aff = useQuery({ queryKey: ['admin', 'affiliate'], queryFn: () => api.get<AffiliateInfo>('/v1/admin/affiliate') });
  const setFlag = useMutation({ mutationFn: (p: { key: string; enabled: boolean }) => api.put(`/v1/admin/flags/${p.key}`, { enabled: p.enabled }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'flags'] }) });
  const gate = flags.data?.find((f) => f.key === INSTALL_GATE);
  const box = (label: string, value: string, sub: string) => <div className="flex-1 px-4 py-3.5 rounded-xl" style={{ background: 'rgba(255,253,249,0.08)' }}><div className="text-[12px]" style={{ color: T.sideText }}>{label}</div><div className="serif text-[26px] font-extrabold">{value}</div><div className="text-[12px]" style={{ color: T.sideText }}>{sub}</div></div>;
  if (featuresView) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap"><div><h1 className="serif m-0 text-[28px] font-extrabold">Tính năng</h1><div className="muted text-[13px]">Bật tắt tính năng cho toàn nền tảng. Mỗi dòng ghi rõ tắt thì mất gì.</div></div></div>
        <div className="card flex flex-col gap-2.5" style={{ padding: '18px 20px', maxWidth: 720 }}>
          <span className="font-semibold">Tính năng đang bật theo giai đoạn</span>
          <QueryState q={flags} rows={3} isEmpty={(d) => d.length === 0} empty={{ title: 'Chưa có cờ tính năng' }}>
            {(list) => <>{list.filter(isFeature).map((f) => <div key={f.key} className="flex items-start gap-2.5 text-[13px]"><span className="flex-grow flex flex-col"><span>{FLAG_LABEL[f.key] ?? f.key}</span>{FLAG_EFFECT[f.key] && <span className="muted text-[11px]">{FLAG_EFFECT[f.key]}</span>}</span><span className="muted text-[12px]">{f.enabled ? 'Bật cho mọi hội' : `Tắt${f.description ? ` · ${f.description}` : ''}`}</span><Toggle on={f.enabled} disabled={setFlag.isPending} onChange={(v) => setFlag.mutate({ key: f.key, enabled: v })} /></div>)}</>}
          </QueryState>
          <div className="muted text-[13px] pt-2" style={{ borderTop: `1px solid ${T.line}` }}>Không hiện 3 cờ của tính năng chưa xây (tin nhắn thời gian thực, phát trực tiếp, điểm và cấp độ): bật hay tắt chưa đổi gì.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap"><div><h1 className="serif m-0 text-[28px] font-extrabold">Gói nền tảng</h1><div className="muted text-[14px]">Bốn gói, mỗi gói cho một hội. Bạn chỉ nhập giá mỗi tháng và trần thành viên, giá 3 tháng và 1 năm tự tính.</div></div></div>
      <QueryState q={stats} rows={4}>
        {(s) => (
          <>
            <div className="card card-invert flex gap-3 flex-col sm:flex-row p-5">
              {box('Hội đang trả phí', fmtCount(s.paidCommunities), `trên ${fmtCount(s.totalCommunities)} hội`)}
              {box('Doanh thu gói quy ra tháng', fmtShortMoney(s.mrrMinor), 'tính trên các gói còn hạn')}
              {box('Hội gói Miễn phí', fmtCount(s.plans.find((p) => p.key === 'free')?.communities ?? 0), 'dùng vĩnh viễn')}
            </div>
            <PlanTable stats={s} />
          </>
        )}
      </QueryState>
      <div className="card flex flex-col gap-3" style={{ padding: '18px 20px' }}>
        <span className="font-semibold text-[16px]">Công tắc toàn hệ thống</span>
        <div className="flex items-start gap-3">
          <span className="flex-shrink-0 pt-1"><Toggle on={gate?.enabled === true} disabled={!gate || setFlag.isPending} label="Bắt cài ra màn hình chính trên điện thoại" onChange={(v) => setFlag.mutate({ key: INSTALL_GATE, enabled: v })} /></span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[16px] font-semibold">Bắt cài ra màn hình chính trên điện thoại</span>
            <span className="text-[14px]" style={{ color: T.ink2 }}>Thành viên đã đăng nhập, từ lần vào thứ hai, phải thêm Hội Mình vào màn hình chính mới dùng tiếp. Tắt ngay nếu số người quay lại hội tụt.</span>
            <span className="text-[14px] font-semibold" role="status" style={{ color: gate?.enabled ? T.tealText : T.ink3 }}>{!gate ? 'Đang tải...' : gate.enabled ? 'Đang bật' : 'Đang tắt'}</span>
          </div>
        </div>
      </div>
      <div className="card flex flex-col gap-2.5" style={{ padding: '18px 20px' }}>
        <span className="font-semibold text-[16px]">Luật cố định, không sửa ở đây</span>
        {FIXED_RULES.map((r) => (
          <div key={r} className="flex items-start gap-2.5 text-[14px]" style={{ color: T.ink2 }}><Lock size={16} className="flex-shrink-0 mt-[3px]" style={{ color: T.teal }} /><span>{r}</span></div>
        ))}
      </div>
      <div className="flex gap-4 flex-col md:flex-row">
        <div className="card flex-1 flex flex-col gap-2.5" style={{ padding: '18px 20px' }}>
          <span className="font-semibold">Chương trình cộng sự nền tảng</span>
          <div className="flex items-center gap-2.5 text-[13px]"><span className="flex-grow">Hoa hồng khi giới thiệu chủ hội mới</span><Link to="/he-thong/cong-su" className="chip" style={{ height: 28, fontSize: 12 }}>{aff.data ? `${aff.data.program.commissionRateBps / 100}%${aff.data.program.commissionDurationMonths ? ` · ${aff.data.program.commissionDurationMonths} tháng` : ''}` : '…'}</Link></div>
          <div className="flex items-center gap-2.5 text-[13px]"><span className="flex-grow">Hoa hồng khi giới thiệu thành viên vào hội</span><span className="muted text-[12px]">do chủ hội tự đặt</span></div>
          <div className="flex items-center gap-2.5 text-[13px]"><span className="flex-grow">Đã trả cho cộng sự nền tảng tháng này</span><span className="font-semibold">{money(aff.data?.stats.paidThisMonthMinor ?? 0)}</span></div>
        </div>
        <div className="card flex-1 flex flex-col gap-2.5" style={{ padding: '18px 20px' }}>
          <span className="font-semibold">Tính năng</span>
          <QueryState q={flags} rows={1}>
            {(list) => { const real = list.filter(isFeature); return <div className="text-[13px]">{real.filter((f) => f.enabled).length} trên {real.length} tính năng đang bật cho mọi hội.</div>; }}
          </QueryState>
          <Link to="/he-thong/tinh-nang" className="btn btn-ghost btn-sm self-start">Bật tắt tính năng</Link>
        </div>
      </div>
    </div>
  );
}
