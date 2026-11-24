// Hệ thống · Đối tác (/he-thong/doi-tac): đối tác chính thức của affiliate nền tảng (chủ dự án chốt ngày 24/11/2026).
// Quản trị thêm đối tác bằng email, đặt % hoa hồng riêng và thời hạn nhận hoa hồng riêng, ghi chú thỏa thuận, kết thúc
// hợp tác; mỗi đối tác có số liệu: lượt bấm link, chủ hội đăng ký, chủ hội đã trả tiền, doanh thu mang về, hoa hồng.
// Tiền hoa hồng vẫn đi qua ví affiliate nền tảng như mọi affiliate (trả ở Hệ thống · Affiliate nền tảng).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Field, Input, Select, T, Tag, Textarea, money } from '@hoiminh/ui';
import { ChevronDown, Handshake, Plus } from 'lucide-react';
import { useState } from 'react';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { DURATION_CHOICES, choiceOf, durationChoiceLabel, parseRatePercent, partnerTermsText, programTermsText, ratePercentText, termsOfChoice, type PartnerItem, type PartnerList } from '@/lib/partners';

const KEY = ['admin', 'partners'];

interface TermsDraft { rate: string; duration: string; note: string }

/** Ba ô điều khoản dùng chung cho form thêm và form sửa. */
function TermsFields({ d, onChange, programMonths, programRateBps, rateError }: { d: TermsDraft; onChange: (d: TermsDraft) => void; programMonths: number | null; programRateBps: number; rateError: string | null }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Hoa hồng riêng" hint={rateError ?? `Để trống là theo mức chung ${programRateBps / 100}%.`}>
          <Input inputMode="decimal" value={d.rate} onChange={(e) => onChange({ ...d, rate: e.target.value })} placeholder={String(programRateBps / 100)} right={<span className="muted text-[15px]">%</span>} aria-label="Hoa hồng riêng (%)" aria-invalid={rateError ? true : undefined} />
        </Field>
        <Field label="Thời hạn nhận hoa hồng" hint="Tính từ lần đầu chủ hội được giới thiệu trả tiền.">
          <Select value={d.duration} onChange={(e) => onChange({ ...d, duration: e.target.value })} aria-label="Thời hạn nhận hoa hồng">
            {DURATION_CHOICES.map((c) => <option key={c} value={c}>{durationChoiceLabel(c, programMonths)}</option>)}
          </Select>
        </Field>
      </div>
      <Field label="Ghi chú" hint="Thỏa thuận, kênh của đối tác, người phụ trách. Chỉ quản trị thấy.">
        <Textarea value={d.note} rows={2} maxLength={1000} onChange={(e) => onChange({ ...d, note: e.target.value })} aria-label="Ghi chú" />
      </Field>
    </>
  );
}

function AddPartner({ program, onDone }: { program: PartnerList['program']; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [d, setD] = useState<TermsDraft>({ rate: '', duration: 'program', note: '' });
  const rate = parseRatePercent(d.rate);
  const m = useMutation({
    mutationFn: () => api.post('/v1/admin/partners', { email, commissionRateBps: rate.ok ? rate.bps : null, ...termsOfChoice(d.duration), note: d.note }),
    onSuccess: () => { setEmail(''); setD({ rate: '', duration: 'program', note: '' }); onDone(); },
  });
  return (
    <section className="card flex flex-col gap-3.5 p-5" aria-labelledby="add-partner">
      <h2 id="add-partner" className="m-0 text-[18px] font-bold flex items-center gap-2"><Plus size={20} aria-hidden="true" />Thêm đối tác</h2>
      <Field label="Email tài khoản Hội Mình của đối tác" hint="Người đó cần đăng ký tài khoản trước. Chưa làm affiliate nền tảng thì hệ thống mở ví cho họ luôn.">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="doitac@email.com" aria-label="Email đối tác" />
      </Field>
      <TermsFields d={d} onChange={setD} programMonths={program.commissionDurationMonths} programRateBps={program.commissionRateBps} rateError={rate.ok ? null : rate.error} />
      {m.isError && <span className="text-[15px]" style={{ color: T.accentText }} role="alert">{errorMessage(m.error)}</span>}
      <Button variant="primary" className="self-start" style={{ minHeight: 48, fontSize: 16 }} loading={m.isPending} disabled={!email.trim() || !rate.ok} onClick={() => m.mutate()}>Thêm đối tác</Button>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[12px] px-3 py-2.5" style={{ background: T.bg }}>
      <span className="text-[13px]" style={{ color: T.ink3 }}>{label}</span>
      <span className="text-[18px] font-extrabold" style={{ color: T.ink }}>{value}</span>
    </div>
  );
}

function PartnerCard({ p, program, onChanged }: { p: PartnerItem; program: PartnerList['program']; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [d, setD] = useState<TermsDraft>({ rate: ratePercentText(p.commissionRateBps), duration: choiceOf(p.durationMode, p.commissionDurationMonths), note: p.note ?? '' });
  const rate = parseRatePercent(d.rate);
  const save = useMutation({ mutationFn: () => api.patch(`/v1/admin/partners/${p.id}`, { commissionRateBps: rate.ok ? rate.bps : null, ...termsOfChoice(d.duration), note: d.note }), onSuccess: () => { setEditing(false); onChanged(); } });
  const end = useMutation({ mutationFn: () => api.post(`/v1/admin/partners/${p.id}/end`, {}), onSuccess: onChanged });
  const active = p.status === 'active';
  return (
    <article className="card flex flex-col gap-3.5 p-5" data-testid="partner-card" aria-label={p.user.name}>
      <div className="flex items-start gap-3">
        <Avatar name={p.user.name} src={p.user.avatarUrl} color={p.user.coverColor ?? T.side} size={48} />
        <div className="flex flex-col gap-1 min-w-0 flex-grow">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[18px] font-bold" style={{ color: T.ink }}>{p.user.name}</span>
            {active ? <Tag tone="teal">{partnerTermsText(p)}</Tag> : <Tag tone="neutral">Đã kết thúc</Tag>}
          </div>
          <span className="text-[15px] truncate" style={{ color: T.ink3 }}>{p.user.email} · mã {p.code}</span>
          <span className="text-[14px]" style={{ color: T.ink3 }}>Từ {new Date(p.startedAt).toLocaleDateString('vi-VN')}{p.endedAt ? ` đến ${new Date(p.endedAt).toLocaleDateString('vi-VN')}` : ''}</span>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Stat label="Lượt bấm link" value={p.stats.clicks.toLocaleString('vi-VN')} />
        <Stat label="Chủ hội đăng ký" value={p.stats.signups.toLocaleString('vi-VN')} />
        <Stat label="Chủ hội đã trả" value={p.stats.paidCustomers.toLocaleString('vi-VN')} />
        <Stat label="Doanh thu mang về" value={money(p.stats.grossMinor)} />
        <Stat label="Hoa hồng" value={money(p.stats.commissionMinor)} />
      </div>
      {p.note && !editing && <p className="m-0 text-[15px] leading-[1.55] rounded-[12px] px-3.5 py-2.5" style={{ background: T.bg, color: T.ink2 }}>{p.note}</p>}
      {editing && (
        <div className="flex flex-col gap-3.5 pt-1">
          <TermsFields d={d} onChange={setD} programMonths={program.commissionDurationMonths} programRateBps={program.commissionRateBps} rateError={rate.ok ? null : rate.error} />
          <span className="text-[14px]" style={{ color: T.ink3 }}>Điều khoản mới áp dụng cho những lần trả tiền từ giờ. Hoa hồng đã ghi không đổi.</span>
          {save.isError && <span className="text-[15px]" style={{ color: T.accentText }} role="alert">{errorMessage(save.error)}</span>}
        </div>
      )}
      {active && (
        <div className="flex gap-2 flex-wrap">
          {editing ? (
            <>
              <Button variant="primary" loading={save.isPending} disabled={!rate.ok} onClick={() => save.mutate()} style={{ minHeight: 44 }}>Lưu điều khoản</Button>
              <Button onClick={() => setEditing(false)} style={{ minHeight: 44 }}>Hủy</Button>
            </>
          ) : (
            <>
              <Button variant="dark" onClick={() => setEditing(true)} style={{ minHeight: 44 }}>Sửa điều khoản</Button>
              <Button loading={end.isPending} style={{ minHeight: 44, color: T.accentText }} onClick={() => { if (window.confirm(`Kết thúc hợp tác với ${p.user.name}? Hoa hồng và thời hạn trở về mức chung cho những lần trả tiền sau này. Hoa hồng đã ghi giữ nguyên.`)) end.mutate(); }}>Kết thúc hợp tác</Button>
            </>
          )}
        </div>
      )}
      {end.isError && <span className="text-[15px]" style={{ color: T.accentText }} role="alert">{errorMessage(end.error)}</span>}
    </article>
  );
}

export default function Page() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: () => api.get<PartnerList>('/v1/admin/partners') });
  const refresh = () => { void qc.invalidateQueries({ queryKey: KEY }); void qc.invalidateQueries({ queryKey: ['admin', 'affiliate'] }); };
  const [showEnded, setShowEnded] = useState(false);
  return (
    <div className="flex flex-col gap-4 w-full" style={{ maxWidth: 960 }}>
      <div className="flex flex-col gap-1">
        <h1 className="serif m-0 text-[28px] font-extrabold flex items-center gap-2"><Handshake size={26} aria-hidden="true" />Đối tác chính thức</h1>
        <p className="m-0 text-[16px] leading-[1.55]" style={{ color: T.ink2 }}>Người dạy kinh doanh, coach, trưởng nhóm được Hội Mình chọn để giới thiệu chủ hội mới. Mỗi đối tác có hoa hồng và thời hạn riêng; tiền hoa hồng vẫn trả ở trang Affiliate nền tảng.</p>
      </div>
      <QueryState q={q} rows={4}>
        {(d) => {
          const active = d.items.filter((p) => p.status === 'active');
          const ended = d.items.filter((p) => p.status === 'ended');
          return (
            <>
              <div className="rounded-[12px] px-4 py-3 text-[15px]" style={{ background: T.tealSoft, color: T.tealText }}>Mức chung của affiliate nền tảng: <strong>{programTermsText(d.program)}</strong>. Đối tác để trống ô nào thì theo mức chung ở ô đó.</div>
              <AddPartner program={d.program} onDone={refresh} />
              <h2 className="m-0 text-[20px] font-bold pt-2">Đang hợp tác ({active.length})</h2>
              {active.length === 0 && <div className="card text-[15px] p-5" style={{ color: T.ink3 }}>Chưa có đối tác nào. Thêm đối tác đầu tiên ở khung phía trên.</div>}
              {active.map((p) => <PartnerCard key={`${p.id}:${p.status}:${p.commissionRateBps}:${p.durationMode}:${p.commissionDurationMonths}:${p.note}`} p={p} program={d.program} onChanged={refresh} />)}
              {ended.length > 0 && (
                <>
                  <button type="button" className="flex items-center gap-2 text-[16px] font-semibold self-start" style={{ color: T.ink2, minHeight: 44 }} aria-expanded={showEnded} onClick={() => setShowEnded((v) => !v)}>
                    <ChevronDown size={18} style={{ transform: showEnded ? 'rotate(180deg)' : undefined }} aria-hidden="true" />Đã kết thúc ({ended.length})
                  </button>
                  {showEnded && ended.map((p) => <PartnerCard key={`${p.id}:${p.status}`} p={p} program={d.program} onChanged={refresh} />)}
                </>
              )}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
