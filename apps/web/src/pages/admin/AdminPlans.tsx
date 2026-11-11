// Hệ thống · Gói nền tảng và Tính năng (hai tab của nhóm "Gói và tính năng"): thẻ gói duy nhất với 3 ô tháng/năm/dùng thử
// (sửa giá, chọn cách thu tiền: thanh toán trong Hội Mình hoặc link ngoài; chưa có gói nào thì tạo gói ngay tại đây),
// cộng sự nền tảng; tab Tính năng bật tắt các cờ có tác dụng thật.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, OptionCard, T, Toggle, money } from '@hoiminh/ui';
import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { fmtShortMoney } from '@/lib/format';

interface Plan { key: string; name: string; description: string; monthlyMinor: number; yearlyMinor: number; trialDays: number; features: string[]; paymentMode: 'gateway' | 'link'; monthlyPayUrl: string | null; yearlyPayUrl: string | null }
interface Stats { plan?: Plan | null; monthlyCount: number; yearlyCount: number; trialCount: number; expiredCount: number; mrrMonthlyMinor: number; mrrYearlyMinor: number; conversionRate: number }
interface Flag { key: string; description: string; enabled: boolean; rules: Record<string, unknown> }
interface AffiliateInfo { program: { commissionRateBps: number; commissionDurationMonths: number | null }; stats: { paidThisMonthMinor: number } }
const FEATURES = ['Không giới hạn hội, thành viên, khóa học, video, sự kiện', 'Không thu phí giao dịch', 'Cộng sự và bảng xếp hạng cộng sự', 'Cửa hàng bán khóa học, combo, tài liệu', 'Tên miền riêng', 'Tin nhắn chào tự động và tiện ích', 'Nhận tiền qua chuyển khoản QR, MoMo, VNPAY, PayPal', 'API, webhook và MCP'];
// Khóa phải khớp `featureFlags` trong seed và hằng FLAG ở packages/core.
const FLAG_LABEL: Record<string, string> = { realtime_chat: 'Tin nhắn thời gian thực', go_live: 'Phát trực tiếp trong hội', affiliate_leaderboard: 'Bảng xếp hạng cộng sự', store: 'Cửa hàng trong hội', mcp: 'MCP cho AI', gamification: 'Điểm và cấp độ hoạt động', paypal: 'Cổng PayPal' };
/** Cờ đang chặn đường chạy thật (không chỉ hiển thị): ghi rõ tắt thì mất gì. */
const FLAG_EFFECT: Record<string, string> = { store: 'tắt: ẩn tab Cửa hàng ở mọi hội và chặn mua sản phẩm', affiliate_leaderboard: 'tắt: ẩn tab Xếp hạng cộng sự ở mọi hội', mcp: 'tắt: MCP server không khởi động được', paypal: 'tắt: không chọn được PayPal khi thanh toán' };
/** Cờ của tính năng chưa xây (thuộc V2): bật hay tắt chưa đổi gì, nên không hiện để khỏi gây hiểu nhầm. */
const NO_EFFECT = new Set(['realtime_chat', 'go_live', 'gamification']);

/** Khóa của gói duy nhất (khớp PLATFORM_PLAN_KEY ở packages/core) và giá điền sẵn khi database chưa có gói nào. */
const PLAN_KEY = 'hoiminh';
const NEW_PLAN = { name: 'Hội Mình', monthlyMinor: 499_000, yearlyMinor: 4_990_000, trialDays: 14 };

/** Sửa gói đã có, hoặc tạo gói khi chưa có gói nào (plan = null): cùng một ô, cùng một lệnh lưu. */
function PlanEditor({ plan, onClose }: { plan: Plan | null; onClose?: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: plan?.name ?? NEW_PLAN.name, monthlyMinor: plan?.monthlyMinor ?? NEW_PLAN.monthlyMinor, yearlyMinor: plan?.yearlyMinor ?? NEW_PLAN.yearlyMinor, trialDays: plan?.trialDays ?? NEW_PLAN.trialDays, paymentMode: plan?.paymentMode ?? 'gateway', monthlyPayUrl: plan?.monthlyPayUrl ?? '', yearlyPayUrl: plan?.yearlyPayUrl ?? '' });
  const link = f.paymentMode === 'link';
  const m = useMutation({ mutationFn: () => api.patch(`/v1/admin/plans/${plan?.key ?? PLAN_KEY}`, f), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'plans'] }); void qc.invalidateQueries({ queryKey: ['plans'] }); onClose?.(); } });
  return (
    <div className="card p-5 flex flex-col gap-3">
      <span className="font-semibold">{plan ? `Sửa gói ${plan.key}` : 'Tạo gói Hội Mình'}</span>
      {!plan && <span className="muted text-[13px]">Giá dưới đây là giá điền sẵn, kiểm tra lại trước khi tạo. Tạo xong vẫn sửa được.</span>}
      <div className="grid-2"><Field label="Tên gói"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Ngày dùng thử"><Input type="number" min={0} value={f.trialDays} onChange={(e) => setF({ ...f, trialDays: Number(e.target.value) })} /></Field><Field label="Giá tháng (đ)"><Input type="number" min={0} step={1000} value={f.monthlyMinor} onChange={(e) => setF({ ...f, monthlyMinor: Number(e.target.value) })} /></Field><Field label="Giá năm (đ)" hint="Gợi ý = 10 tháng"><Input type="number" min={0} step={1000} value={f.yearlyMinor} onChange={(e) => setF({ ...f, yearlyMinor: Number(e.target.value) })} /></Field></div>
      <div className="flex flex-col gap-2 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
        <span className="text-[13px] font-semibold">Cách thu tiền gói</span>
        <OptionCard on={!link} onClick={() => setF({ ...f, paymentMode: 'gateway' })} title="Thanh toán trong Hội Mình" sub="Chuyển khoản QR, MoMo, VNPAY, PayPal. Gói tự kích hoạt khi tiền về." />
        <OptionCard on={link} onClick={() => setF({ ...f, paymentMode: 'link' })} title="Link thanh toán ngoài" sub="Chủ hội bấm thanh toán thì được dẫn sang trang của hệ thống khác." />
      </div>
      {link && (
        <div className="flex flex-col gap-3">
          <Field label="Link gói tháng"><Input type="url" inputMode="url" placeholder="https://..." value={f.monthlyPayUrl} onChange={(e) => setF({ ...f, monthlyPayUrl: e.target.value })} /></Field>
          <Field label="Link gói năm" hint="Để trống chu kỳ nào thì chu kỳ đó không bán."><Input type="url" inputMode="url" placeholder="https://..." value={f.yearlyPayUrl} onChange={(e) => setF({ ...f, yearlyPayUrl: e.target.value })} /></Field>
          <div className="muted text-[13px]">Viết {'{workspace_id}'}, {'{email}'}, {'{cycle}'} vào link để hệ thống ngoài biết ai trả và trả gói nào. Link không có {'{workspace_id}'} thì Hội Mình tự thêm hm_ws và hm_cycle vào cuối.</div>
          <div className="text-[13px] rounded-[10px] px-3 py-2.5" style={{ background: T.goldSoft, color: T.goldText }}>Hội Mình chưa tự kích hoạt gói khi khách trả qua link ngoài: phần nhận webhook từ hệ thống đó chưa có.</div>
        </div>
      )}
      {m.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}
      <div className="flex gap-2 justify-end">{onClose && <Button size="sm" onClick={onClose}>Hủy</Button>}<Button size="sm" variant="dark" loading={m.isPending} onClick={() => m.mutate()}>{plan ? 'Lưu gói' : 'Tạo gói'}</Button></div>
    </div>
  );
}

export default function Page() {
  const qc = useQueryClient();
  // Cùng một trang phục vụ hai tab: /he-thong/goi (gói, cộng sự nền tảng) và /he-thong/tinh-nang (cờ tính năng).
  const featuresView = useLocation().pathname.endsWith('/tinh-nang');
  const [edit, setEdit] = useState(false);
  const stats = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api.get<Stats>('/v1/admin/plans') });
  const flags = useQuery({ queryKey: ['admin', 'flags'], queryFn: () => api.get<Flag[]>('/v1/admin/flags') });
  const aff = useQuery({ queryKey: ['admin', 'affiliate'], queryFn: () => api.get<AffiliateInfo>('/v1/admin/affiliate') });
  const setFlag = useMutation({ mutationFn: (p: { key: string; enabled: boolean }) => api.put(`/v1/admin/flags/${p.key}`, { enabled: p.enabled }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'flags'] }) });
  const box = (label: string, value: string, sub: string) => <div className="flex-1 px-4 py-3.5 rounded-xl" style={{ background: 'rgba(255,253,249,0.08)' }}><div className="text-[12px]" style={{ color: T.sideText }}>{label}</div><div className="serif text-[26px] font-extrabold">{value}</div><div className="text-[12px]" style={{ color: T.sideText }}>{sub}</div></div>;
  if (featuresView) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3 flex-wrap"><div><h1 className="serif m-0 text-[28px] font-extrabold">Tính năng</h1><div className="muted text-[13px]">Bật tắt tính năng cho toàn nền tảng. Mỗi dòng ghi rõ tắt thì mất gì.</div></div></div>
        <div className="card flex flex-col gap-2.5" style={{ padding: '18px 20px', maxWidth: 720 }}>
          <span className="font-semibold">Tính năng đang bật theo giai đoạn</span>
          <QueryState q={flags} rows={3} isEmpty={(d) => d.length === 0} empty={{ title: 'Chưa có cờ tính năng' }}>
            {(list) => <>{list.filter((f) => !NO_EFFECT.has(f.key)).map((f) => <div key={f.key} className="flex items-start gap-2.5 text-[13px]"><span className="flex-grow flex flex-col"><span>{FLAG_LABEL[f.key] ?? f.key}</span>{FLAG_EFFECT[f.key] && <span className="muted text-[11px]">{FLAG_EFFECT[f.key]}</span>}</span><span className="muted text-[12px]">{f.enabled ? 'Bật cho mọi hội' : `Tắt${f.description ? ` · ${f.description}` : ''}`}</span><Toggle on={f.enabled} disabled={setFlag.isPending} onChange={(v) => setFlag.mutate({ key: f.key, enabled: v })} /></div>)}</>}
          </QueryState>
          <div className="muted text-[13px] pt-2" style={{ borderTop: `1px solid ${T.line}` }}>Không hiện 3 cờ của tính năng chưa xây (tin nhắn thời gian thực, phát trực tiếp, điểm và cấp độ): bật hay tắt chưa đổi gì.</div>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap"><div><h1 className="serif m-0 text-[28px] font-extrabold">Gói nền tảng</h1><div className="muted text-[13px]">Hiện chỉ có một gói đầy đủ tính năng, trả theo tháng hoặc năm. Không thu phí giao dịch.</div></div></div>
      <QueryState q={stats} rows={4}>
        {(s) => !s.plan ? (
          // Database chưa có gói nào: không có gì để sửa, nên mở sẵn ô tạo gói.
          <div className="flex flex-col gap-3" style={{ maxWidth: 560 }}>
            <div className="rounded-[12px] px-4 py-3 text-[14px]" style={{ background: T.goldSoft, color: T.goldText }}>
              <div className="font-semibold">Chưa có gói nào</div>
              <div className="text-[13px]">Chủ hội chưa thấy giá, chưa thanh toán được và người mới chưa bắt đầu dùng thử được cho tới khi bạn tạo gói.</div>
            </div>
            <PlanEditor plan={null} />
          </div>
        ) : (
          <div className="flex gap-4 flex-col md:flex-row">
            <div className="card card-invert flex-[1.3_1_0] p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2.5 flex-wrap"><span className="font-bold text-[18px]">{s.plan?.name ?? 'Hội Mình'}</span><span className="tag" style={{ background: T.gold, color: T.invertBg }}>Gói duy nhất</span><span className="flex-grow" /><button type="button" className="btn btn-ghost btn-sm" style={{ background: 'transparent', color: T.invertInk, borderColor: 'rgba(255,253,249,0.3)' }} onClick={() => setEdit((e) => !e)}>{edit ? 'Đóng' : 'Sửa gói'}</button></div>
              <div className="flex gap-3 flex-col sm:flex-row">
                {box('Theo tháng', money(s.plan?.monthlyMinor ?? 0), `${s.monthlyCount} chủ hội · ${fmtShortMoney(s.mrrMonthlyMinor)} MRR`)}
                {box('Theo năm · 2 tháng miễn phí', money(s.plan?.yearlyMinor ?? 0), `${s.yearlyCount} chủ hội · ${fmtShortMoney(s.mrrYearlyMinor)} MRR quy đổi`)}
                {box('Dùng thử', `${s.plan?.trialDays ?? 14} ngày`, `${s.trialCount} đang thử · ${s.conversionRate}% chuyển trả phí`)}
              </div>
              <div className="text-[13px]" style={{ color: T.sideText }}>Thu tiền: {s.plan?.paymentMode === 'link' ? `link thanh toán ngoài (${[s.plan.monthlyPayUrl && 'tháng', s.plan.yearlyPayUrl && 'năm'].filter(Boolean).join(', ')})` : 'thanh toán trong Hội Mình'}</div>
              <div className="grid grid-cols-1 md:grid-cols-2 text-[13px] pt-3" style={{ gap: '8px 24px', color: T.sideText, borderTop: '1px solid rgba(255,253,249,0.15)' }}>{(s.plan?.features?.length ? s.plan.features : FEATURES).map((f) => <div key={f} className="flex items-center gap-2"><span style={{ color: T.teal }}><Check size={14} /></span>{f}</div>)}</div>
            </div>
            <div className="flex-1 flex flex-col gap-3">
              {edit && s.plan ? <PlanEditor plan={s.plan} onClose={() => setEdit(false)} /> : (
                <div className="flex-grow p-6 rounded-2xl flex flex-col items-center justify-center gap-2 text-center" style={{ border: `1.5px dashed ${T.line2}`, color: T.ink3, minHeight: 200 }}><Plus size={28} /><div className="font-semibold" style={{ color: T.ink2 }}>Gói thấp hơn</div><div className="text-[13px] max-w-[220px]">Bổ sung sau khi có nhu cầu. Kiến trúc đã sẵn giới hạn theo gói.</div></div>
              )}
            </div>
          </div>
        )}
      </QueryState>
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
            {(list) => { const real = list.filter((f) => !NO_EFFECT.has(f.key)); return <div className="text-[13px]">{real.filter((f) => f.enabled).length} trên {real.length} tính năng đang bật cho mọi hội.</div>; }}
          </QueryState>
          <Link to="/he-thong/tinh-nang" className="btn btn-ghost btn-sm self-start">Bật tắt tính năng</Link>
        </div>
      </div>
    </div>
  );
}
