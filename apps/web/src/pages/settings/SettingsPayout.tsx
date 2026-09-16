// Cài đặt · Thanh toán (payoutMain): số dư có thể rút / đang giữ 14 ngày, tài khoản nhận tiền, cách khách thanh toán (bật/tắt), nhắc hoa hồng cộng sự.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { T, Toggle, money } from '@hoiminh/ui';
import { Check, Clock, ShieldCheck, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { shellKey, useShell } from '@/lib/community';

interface Payout { availableMinor: number; holdingMinor: number; withdrawnThisMonthMinor: number; affiliatePendingMinor: number; affiliatePendingCount: number; providers: Array<{ provider: 'sepay' | 'momo' | 'vnpay' | 'paypal'; enabled: boolean; platformEnabled: boolean }>; ownerName: string; enabledProviders: string[] }
const METHOD: Record<string, { name: string; desc: string; bg: string }> = {
  sepay: { name: 'Chuyển khoản QR', desc: 'Khách quét mã, tự kích hoạt khi tiền về qua SePay', bg: T.ink },
  momo: { name: 'MoMo', desc: 'Ví điện tử, xác nhận tức thì', bg: '#A50064' },
  vnpay: { name: 'VNPAY', desc: 'Thẻ nội địa, QR ngân hàng', bg: '#0A5EB0' },
  paypal: { name: 'PayPal', desc: 'Khách quốc tế trả bằng USD', bg: '#003087' },
};

export default function Page() {
  const shell = useShell();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['payout-settings', shell.community.id], queryFn: () => api.get<Payout>(`/v1/communities/${shell.community.id}/payout`) });
  const m = useMutation({ mutationFn: (enabledProviders: string[]) => api.put(`/v1/communities/${shell.community.id}/providers`, { enabledProviders }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ['payout-settings'] }); void qc.invalidateQueries({ queryKey: shellKey(shell.community.slug) }); } });
  return (
    <>
      <div><h1 className="serif m-0 text-[28px] font-extrabold">Thanh toán</h1><div className="muted text-[13px]">Nhận tiền, cách khách trả và rút về tài khoản</div></div>
      {m.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</div>}
      <QueryState q={q} rows={4}>
        {(d) => (
          <>
            <div className="card flex items-center gap-6 flex-wrap" style={{ padding: '20px 24px' }}>
              <div className="flex-grow flex gap-8 flex-wrap">
                <div><div className="muted text-[12px] font-semibold uppercase tracking-[0.06em]">Có thể rút</div><div className="serif text-[28px] font-extrabold">{money(d.availableMinor)}</div></div>
                <div><div className="muted text-[12px] font-semibold uppercase tracking-[0.06em]">Đang giữ</div><div className="serif text-[28px] font-extrabold" style={{ color: T.ink2 }}>{money(d.holdingMinor)}</div><div className="muted text-[12px]">giải phóng dần trong 14 ngày</div></div>
                <div><div className="muted text-[12px] font-semibold uppercase tracking-[0.06em]">Đã rút tháng này</div><div className="serif text-[28px] font-extrabold" style={{ color: T.ink2 }}>{money(d.withdrawnThisMonthMinor)}</div></div>
              </div>
              <a href="mailto:hotro@hoiminh.vn?subject=Rut%20tien%20chu%20hoi" className="btn btn-primary"><Wallet size={18} />Rút tiền</a>
            </div>
            <div className="card flex flex-col gap-3" style={{ padding: '20px 24px' }}>
              <div className="flex items-center"><span className="font-semibold">Tài khoản nhận tiền</span></div>
              <div className="flex items-center gap-3.5 px-4 py-3 rounded-xl" style={{ background: T.bg }}><span className="w-11 h-[30px] rounded-md inline-flex items-center justify-center text-[10px] font-extrabold" style={{ background: '#1B5E3B', color: T.invertInk }}>VCB</span><div className="flex-grow"><div className="font-semibold">Tài khoản Hội Mình</div><div className="muted text-[12px]">Tiền về tài khoản Hội Mình, chuyển cho {d.ownerName || 'chủ hội'} theo yêu cầu rút</div></div><span className="tag" style={{ background: T.tealSoft, color: T.tealText }}><ShieldCheck size={11} />Đã xác minh</span></div>
              <div className="muted text-[12px] flex items-center gap-1.5"><Clock size={14} />Rút tiền được xử lý trong 1 ngày làm việc, tối thiểu 500.000đ, miễn phí</div>
            </div>
            <div className="card flex flex-col" style={{ padding: '20px 24px' }}>
              <div className="pb-1.5"><span className="font-semibold">Cách khách thanh toán</span><div className="muted text-[13px]">Khách tự chọn ở bước thanh toán, tiền về tài khoản Hội Mình rồi bạn rút</div></div>
              {d.providers.map((p) => { const mt = METHOD[p.provider]!; const on = d.enabledProviders.includes(p.provider); return (
                <div key={p.provider} className="flex items-center gap-3.5 py-3.5" style={{ borderTop: `1px solid ${T.line}` }}>
                  <span className="w-10 h-10 rounded-[10px] inline-flex items-center justify-center font-extrabold text-[11px] serif flex-shrink-0" style={{ background: mt.bg, color: T.invertInk }}>{mt.name.slice(0, 2).toUpperCase()}</span>
                  <div className="flex-grow min-w-0"><div className="flex items-center gap-2 flex-wrap"><span className="font-semibold">{mt.name}</span>{p.platformEnabled ? <span className="tag" style={{ background: T.tealSoft, color: T.tealText }}><Check size={11} />Đã kết nối</span> : <span className="tag" style={{ background: T.bg, color: T.ink3 }}>Chưa kết nối</span>}</div><div className="muted text-[13px]">{mt.desc}</div></div>
                  <Toggle on={on} disabled={!p.platformEnabled || m.isPending} onChange={(v) => m.mutate(v ? [...d.enabledProviders, p.provider] : d.enabledProviders.filter((x) => x !== p.provider))} />
                </div>
              ); })}
            </div>
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-[13px] flex-wrap" style={{ background: T.goldSoft, color: T.goldDark }}><Users size={16} /><span className="flex-grow">Hoa hồng cộng sự không bị trừ ở đây. Bạn nhận đủ rồi tự chuyển cho cộng sự khi họ yêu cầu rút.</span>{d.affiliatePendingCount > 0 && <Link to={`/${shell.community.slug}/cai-dat/cong-su/rut-tien`} className="font-semibold whitespace-nowrap" style={{ color: T.goldText }}>{d.affiliatePendingCount} yêu cầu đang chờ · {money(d.affiliatePendingMinor)}</Link>}</div>
            <div className="muted text-[12px] flex items-center gap-1.5"><ShieldCheck size={14} />Hội Mình không thu phí giao dịch. Thành viên trả bao nhiêu, bạn nhận đủ bấy nhiêu.</div>
          </>
        )}
      </QueryState>
    </>
  );
}
