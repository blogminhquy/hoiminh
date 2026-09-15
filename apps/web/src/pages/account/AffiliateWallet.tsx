// Tài khoản · Cộng sự (affiliateWalletMain): chọn chương trình, link + 3 số, 4 ô ví, tài khoản nhận tiền, rút tiền, lịch sử rút, hoa hồng gần đây.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Chip, T, WalletBox, money } from '@hoiminh/ui';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { CommissionsTable, PayoutProfileCard, WithdrawCard, WithdrawalsTable, type Commission, type Withdrawal } from './AffiliateWalletParts';

interface Program { id: string; name: string; scope: 'platform' | 'community'; community: { slug: string } | null; rateBps: number }
interface Wallet { programId: string; communityName: string; payerName: string; affiliateCode: string; link: string; commissionRateBps: number; holdDays: number; minWithdrawalMinor: number; pendingMinor: number; availableMinor: number; requestedMinor: number; paidMinor: number; clicks: number; signups: number; paid: number; maskedAccount: string | null; bankCode: string | null; recentCommissions: Commission[]; withdrawals: Withdrawal[] }

export default function Page() {
  const { programId } = useParams();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);
  const programs = useQuery({ queryKey: ['affiliate-programs'], queryFn: () => api.get<Program[]>('/v1/me/affiliate/programs') });
  const current = programId ?? programs.data?.find((p) => p.scope === 'community')?.id ?? programs.data?.[0]?.id ?? null;
  const q = useQuery({ queryKey: ['wallet', current], queryFn: () => api.get<Wallet>(`/v1/me/affiliate/${current}`), enabled: Boolean(current) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['wallet', current] });
  const copy = (link: string) => { void navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); };
  if (programs.data && programs.data.length === 0) return <div className="card p-8 text-center"><div className="font-semibold">Chưa có chương trình cộng sự</div><div className="muted text-[13px] mt-1">Tham gia một hội có bật cộng sự để nhận link giới thiệu.</div></div>;
  if (!programId && current) return <Navigate to={`/tai-khoan/cong-su/${current}`} replace />;
  return (
    <>
      <div><h1 className="serif m-0 text-[28px] font-extrabold">Cộng sự</h1><div className="muted text-[13px]">Giới thiệu một lần, nhận hoa hồng mỗi kỳ người đó trả phí.{q.data ? ` ${q.data.communityName} · hoa hồng ${q.data.commissionRateBps / 100}%` : ''}</div></div>
      {(programs.data?.length ?? 0) > 1 && <div className="flex gap-2 flex-wrap">{programs.data?.map((p) => <Chip key={p.id} on={p.id === current} onClick={() => { window.location.assign(`/tai-khoan/cong-su/${p.id}`); }}>{p.name} · {p.rateBps / 100}%</Chip>)}</div>}
      <QueryState q={q} rows={5}>
        {(w) => (
          <>
            <div className="card flex items-center gap-3 flex-wrap" style={{ padding: '18px 20px' }}>
              <div className="flex-grow flex flex-col gap-1.5 min-w-[240px]"><span className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.accent }}>Link của bạn</span><div className="input" style={{ color: T.ink }}><span className="flex-grow truncate">{w.link.replace(/^https?:\/\//, '')}</span><button type="button" aria-label="Sao chép" onClick={() => copy(w.link)} style={{ color: copied ? T.teal : T.ink3 }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div></div>
              <div className="flex gap-5 px-3">{[[w.clicks, 'Lượt bấm'], [w.signups, 'Đăng ký'], [w.paid, 'Trả phí']].map(([v, l]) => <div key={String(l)} className="text-center"><div className="font-bold text-[18px]">{v}</div><div className="muted text-[12px]">{l}</div></div>)}</div>
              <button type="button" className="btn btn-dark" onClick={() => copy(w.link)}>{copied ? 'Đã sao chép' : 'Sao chép'}</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <WalletBox label="Đang giữ" value={money(w.pendingMinor)} hint={`chờ hết ${w.holdDays} ngày đối soát`} />
              <WalletBox label="Có thể rút" value={money(w.availableMinor)} hint="đã trừ phần đang chờ duyệt" strong />
              <WalletBox label="Đang chờ duyệt" value={money(w.requestedMinor)} hint={`${w.payerName} chưa chuyển`} />
              <WalletBox label="Đã nhận" value={money(w.paidMinor)} hint="tổng đã về tài khoản của bạn" />
            </div>
            <div className="flex gap-4 flex-col md:flex-row">
              <PayoutProfileCard programId={w.programId} maskedAccount={w.maskedAccount} bankCode={w.bankCode} onSaved={() => void refresh()} />
              <WithdrawCard key={w.availableMinor} programId={w.programId} availableMinor={w.availableMinor} minWithdrawalMinor={w.minWithdrawalMinor} hasProfile={Boolean(w.maskedAccount)} payerName={w.payerName} onDone={() => void refresh()} />
            </div>
            <WithdrawalsTable rows={w.withdrawals} onChanged={() => void refresh()} />
            <CommissionsTable rows={w.recentCommissions} />
          </>
        )}
      </QueryState>
    </>
  );
}
