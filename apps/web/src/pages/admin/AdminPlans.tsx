// Hệ thống · Gói nền tảng (saPlansMain) và Tính năng: thẻ gói duy nhất với 3 ô tháng/năm/dùng thử (sửa giá), cộng sự nền tảng, feature flags.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Field, Input, T, Toggle, money } from '@hoiminh/ui';
import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { fmtShortMoney } from '@/lib/format';

interface Plan { key: string; name: string; description: string; monthlyMinor: number; yearlyMinor: number; trialDays: number; features: string[] }
interface Stats { plan: Plan | null; monthlyCount: number; yearlyCount: number; trialCount: number; expiredCount: number; mrrMonthlyMinor: number; mrrYearlyMinor: number; conversionRate: number }
interface Flag { key: string; description: string; enabled: boolean; rules: Record<string, unknown> }
interface AffiliateInfo { program: { commissionRateBps: number; commissionDurationMonths: number | null }; stats: { paidThisMonthMinor: number } }
const FEATURES = ['Không giới hạn hội, thành viên, khóa học, video, sự kiện', 'Không thu phí giao dịch', 'Cộng sự và bảng xếp hạng cộng sự', 'Cửa hàng bán khóa học, combo, tài liệu', 'Tên miền riêng', 'Tin nhắn chào tự động và tiện ích', 'Nhận tiền qua chuyển khoản QR, MoMo, VNPAY, PayPal', 'API, webhook và MCP'];
// Khóa phải khớp `featureFlags` trong seed và hằng FLAG ở packages/core.
const FLAG_LABEL: Record<string, string> = { realtime_chat: 'Tin nhắn thời gian thực', go_live: 'Phát trực tiếp trong hội', affiliate_leaderboard: 'Bảng xếp hạng cộng sự', store: 'Cửa hàng trong hội', mcp: 'MCP cho AI', gamification: 'Điểm và cấp độ hoạt động', paypal: 'Cổng PayPal' };
/** Cờ đang chặn đường chạy thật (không chỉ hiển thị): ghi rõ tắt thì mất gì. */
const FLAG_EFFECT: Record<string, string> = { store: 'tắt: ẩn tab Cửa hàng ở mọi hội và chặn mua sản phẩm', affiliate_leaderboard: 'tắt: ẩn tab Xếp hạng cộng sự ở mọi hội', mcp: 'tắt: MCP server không khởi động được', paypal: 'tắt: không chọn được PayPal khi thanh toán' };

function PlanEditor({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: plan.name, monthlyMinor: plan.monthlyMinor, yearlyMinor: plan.yearlyMinor, trialDays: plan.trialDays });
  const m = useMutation({ mutationFn: () => api.patch(`/v1/admin/plans/${plan.key}`, f), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['admin', 'plans'] }); onClose(); } });
  return (
    <div className="card p-5 flex flex-col gap-3">
      <span className="font-semibold">Sửa gói {plan.key}</span>
      <div className="grid-2"><Field label="Tên gói"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field><Field label="Ngày dùng thử"><Input type="number" min={0} value={f.trialDays} onChange={(e) => setF({ ...f, trialDays: Number(e.target.value) })} /></Field><Field label="Giá tháng (đ)"><Input type="number" min={0} step={1000} value={f.monthlyMinor} onChange={(e) => setF({ ...f, monthlyMinor: Number(e.target.value) })} /></Field><Field label="Giá năm (đ)" hint="Gợi ý = 10 tháng"><Input type="number" min={0} step={1000} value={f.yearlyMinor} onChange={(e) => setF({ ...f, yearlyMinor: Number(e.target.value) })} /></Field></div>
      {m.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}
      <div className="flex gap-2 justify-end"><Button size="sm" onClick={onClose}>Hủy</Button><Button size="sm" variant="dark" loading={m.isPending} onClick={() => m.mutate()}>Lưu gói</Button></div>
    </div>
  );
}

export default function Page() {
  const qc = useQueryClient();
  const [edit, setEdit] = useState(false);
  const stats = useQuery({ queryKey: ['admin', 'plans'], queryFn: () => api.get<Stats>('/v1/admin/plans') });
  const flags = useQuery({ queryKey: ['admin', 'flags'], queryFn: () => api.get<Flag[]>('/v1/admin/flags') });
  const aff = useQuery({ queryKey: ['admin', 'affiliate'], queryFn: () => api.get<AffiliateInfo>('/v1/admin/affiliate') });
  const setFlag = useMutation({ mutationFn: (p: { key: string; enabled: boolean }) => api.put(`/v1/admin/flags/${p.key}`, { enabled: p.enabled }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'flags'] }) });
  const box = (label: string, value: string, sub: string) => <div className="flex-1 px-4 py-3.5 rounded-xl" style={{ background: 'rgba(255,253,249,0.08)' }}><div className="text-[12px]" style={{ color: T.sideText }}>{label}</div><div className="serif text-[26px] font-extrabold">{value}</div><div className="text-[12px]" style={{ color: T.sideText }}>{sub}</div></div>;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 flex-wrap"><div><h1 className="serif m-0 text-[28px] font-extrabold">Gói nền tảng</h1><div className="muted text-[13px]">Hiện chỉ có một gói đầy đủ tính năng, trả theo tháng hoặc năm. Không thu phí giao dịch.</div></div></div>
      <QueryState q={stats} rows={4}>
        {(s) => (
          <div className="flex gap-4 flex-col md:flex-row">
            <div className="card card-invert flex-[1.3_1_0] p-6 flex flex-col gap-4">
              <div className="flex items-center gap-2.5 flex-wrap"><span className="font-bold text-[18px]">{s.plan?.name ?? 'Hội Mình'}</span><span className="tag" style={{ background: T.gold, color: T.invertBg }}>Gói duy nhất</span><span className="flex-grow" /><button type="button" className="btn btn-ghost btn-sm" style={{ background: 'transparent', color: T.invertInk, borderColor: 'rgba(255,253,249,0.3)' }} onClick={() => setEdit((e) => !e)}>{edit ? 'Đóng' : 'Sửa gói'}</button></div>
              <div className="flex gap-3 flex-col sm:flex-row">
                {box('Theo tháng', money(s.plan?.monthlyMinor ?? 0), `${s.monthlyCount} chủ hội · ${fmtShortMoney(s.mrrMonthlyMinor)} MRR`)}
                {box('Theo năm · 2 tháng miễn phí', money(s.plan?.yearlyMinor ?? 0), `${s.yearlyCount} chủ hội · ${fmtShortMoney(s.mrrYearlyMinor)} MRR quy đổi`)}
                {box('Dùng thử', `${s.plan?.trialDays ?? 14} ngày`, `${s.trialCount} đang thử · ${s.conversionRate}% chuyển trả phí`)}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 text-[13px] pt-3" style={{ gap: '8px 24px', color: T.sideText, borderTop: '1px solid rgba(255,253,249,0.15)' }}>{FEATURES.map((f) => <div key={f} className="flex items-center gap-2"><span style={{ color: T.teal }}><Check size={14} /></span>{f}</div>)}</div>
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
          <span className="font-semibold">Tính năng đang bật theo giai đoạn</span>
          <QueryState q={flags} rows={3} isEmpty={(d) => d.length === 0} empty={{ title: 'Chưa có cờ tính năng' }}>
            {(list) => <>{list.map((f) => <div key={f.key} className="flex items-start gap-2.5 text-[13px]"><span className="flex-grow flex flex-col"><span>{FLAG_LABEL[f.key] ?? f.key}</span>{FLAG_EFFECT[f.key] && <span className="muted text-[11px]">{FLAG_EFFECT[f.key]}</span>}</span><span className="muted text-[12px]">{f.enabled ? 'Bật cho mọi hội' : `Tắt${f.description ? ` · ${f.description}` : ''}`}</span><Toggle on={f.enabled} disabled={setFlag.isPending} onChange={(v) => setFlag.mutate({ key: f.key, enabled: v })} /></div>)}</>}
          </QueryState>
        </div>
      </div>
    </div>
  );
}
