// Tài khoản · Affiliate (affiliateWalletMain): bước 1 chọn chương trình (nền tảng, từng hội), bước 2 chọn trang muốn
// chia sẻ, bước 3 sao chép link; rồi tới ví của chương trình đó: 4 ô ví, tài khoản nhận tiền, rút tiền, lịch sử.
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { WalletBox, money } from '@hoiminh/ui';
import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { defaultProgramId, readRememberedProgram, rememberProgram, type AffiliateProgram, type LinkTarget } from '@/lib/affiliate-link';
import { api } from '@/lib/api';
import { LinkCard, ProgramOffNotice, ProgramPicker } from './AffiliateLinkParts';
import { CommissionsTable, PayoutProfileCard, WithdrawCard, WithdrawalsTable, type Commission, type Withdrawal } from './AffiliateWalletParts';

interface Wallet { programId: string; scope: 'platform' | 'community'; enabled: boolean; commissionDurationMonths: number | null; targets: LinkTarget[]; communityName: string; payerName: string; affiliateCode: string; link: string; commissionRateBps: number; holdDays: number; minWithdrawalMinor: number; pendingMinor: number; availableMinor: number; requestedMinor: number; paidMinor: number; clicks: number; signups: number; paid: number; maskedAccount: string | null; bankCode: string | null; recentCommissions: Commission[]; withdrawals: Withdrawal[] }

export default function Page() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const programs = useQuery({ queryKey: ['affiliate-programs'], queryFn: () => api.get<AffiliateProgram[]>('/v1/me/affiliate/programs') });
  const list = programs.data ?? [];
  const current = programId ?? defaultProgramId(list, readRememberedProgram());
  const selected = list.find((p) => p.id === current) ?? null;
  // Mở ví là mở tài khoản affiliate. Chương trình đang tắt mà tôi chưa có ví thì không mở, chỉ báo vì sao chưa có link.
  const openWallet = programs.isSuccess && Boolean(current) && (!selected || selected.enabled || selected.hasAccount);
  const q = useQuery({ queryKey: ['wallet', current], queryFn: () => api.get<Wallet>(`/v1/me/affiliate/${current}`), enabled: openWallet });
  const refresh = () => qc.invalidateQueries({ queryKey: ['wallet', current] });
  useEffect(() => { if (programId) rememberProgram(programId); }, [programId]);
  if (!programId && current) return <Navigate to={`/tai-khoan/cong-su/${current}`} replace />;
  return (
    <>
      <div><h1 className="serif m-0 text-[28px] font-extrabold">Affiliate</h1><div className="muted text-[14px]">Giới thiệu một lần, nhận hoa hồng mỗi lần người đó trả phí. Làm theo 3 bước để lấy link.</div></div>
      <QueryState q={programs} rows={2}>
        {(all) => <ProgramPicker programs={all} current={current} onPick={(id) => navigate(`/tai-khoan/cong-su/${id}`)} />}
      </QueryState>
      {selected && !selected.enabled && <ProgramOffNotice p={selected} hasWallet={selected.hasAccount} />}
      {openWallet && (
        <QueryState q={q} rows={3}>
          {(w) => (
            <>
              {w.enabled && <LinkCard key={w.programId} program={{ scope: w.scope, rateBps: w.commissionRateBps, durationMonths: w.commissionDurationMonths, name: w.communityName }} targets={w.targets} code={w.affiliateCode} stats={{ clicks: w.clicks, signups: w.signups, paid: w.paid }} />}
              <div><h2 className="m-0 text-[18px] font-bold">Ví hoa hồng · {w.communityName}</h2><div className="muted text-[14px]">Mỗi chương trình có một ví riêng. {w.payerName} là người chuyển khoản hoa hồng của ví này.</div></div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <WalletBox label="Đang giữ" value={money(w.pendingMinor)} hint={`chờ hết ${w.holdDays} ngày đối soát`} />
                <WalletBox label="Có thể rút" value={money(w.availableMinor)} hint="đã trừ phần đang chờ duyệt" strong />
                <WalletBox label="Đang chờ duyệt" value={money(w.requestedMinor)} hint={`${w.payerName} chưa chuyển`} />
                <WalletBox label="Đã nhận" value={money(w.paidMinor)} hint="tổng đã về tài khoản của bạn" />
              </div>
              <div className="flex gap-4 flex-col md:flex-row">
                <PayoutProfileCard key={w.programId} programId={w.programId} maskedAccount={w.maskedAccount} bankCode={w.bankCode} onSaved={() => void refresh()} />
                <WithdrawCard key={`${w.programId}:${w.availableMinor}`} programId={w.programId} availableMinor={w.availableMinor} minWithdrawalMinor={w.minWithdrawalMinor} hasProfile={Boolean(w.maskedAccount)} payerName={w.payerName} onDone={() => void refresh()} />
              </div>
              <WithdrawalsTable rows={w.withdrawals} onChanged={() => void refresh()} />
              <CommissionsTable rows={w.recentCommissions} />
            </>
          )}
        </QueryState>
      )}
    </>
  );
}
