// Mảnh màn Thanh toán (checkoutBody): header, thẻ tóm tắt, lựa chọn cổng, khối QR chuyển khoản, trạng thái chờ tiền.
import { Radio, T, money } from '@hoiminh/ui';
import { Check, Clock, Copy, ShieldCheck, Users } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@hoiminh/ui';

export type Provider = 'sepay' | 'momo' | 'vnpay' | 'paypal';
export const PROVIDERS: Array<{ key: Provider; name: string; desc: string; logo: string; bg: string }> = [
  { key: 'sepay', name: 'Chuyển khoản QR', desc: 'Quét bằng app ngân hàng, kích hoạt tự động dưới 1 phút', logo: 'QR', bg: T.ink },
  { key: 'momo', name: 'MoMo', desc: 'Xác nhận ngay trong ví, có thể bật tự gia hạn', logo: 'MoMo', bg: '#A50064' },
  { key: 'vnpay', name: 'VNPAY', desc: 'Thẻ nội địa hoặc QR ngân hàng', logo: 'VNPAY', bg: '#0A5EB0' },
  { key: 'paypal', name: 'PayPal', desc: 'Thanh toán bằng USD cho khách quốc tế', logo: 'PayPal', bg: '#003087' },
];
export interface BankQr { kind: 'bank_qr'; qrImageUrl: string; bankName: string; bankCode: string; accountNumber: string; accountHolder: string; amountMinor: number; transferContent: string }
export interface Redirect { kind: 'redirect'; url: string; deeplink?: string }
export type Instruction = BankQr | Redirect;

export function CheckoutFrame({ backTo, children }: { backTo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg }}>
      <header className="flex items-center gap-4 px-4 md:px-16" style={{ height: 64, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
        <Link to="/kham-pha"><Logo size={26} /></Link>
        <span className="flex-grow" />
        <span className="muted text-[13px] inline-flex items-center gap-1.5"><ShieldCheck size={16} />Thanh toán được bảo vệ · hủy bất cứ lúc nào</span>
      </header>
      <div className="flex-grow flex justify-center gap-8 px-4 py-6 md:px-16 md:py-10 flex-col md:flex-row">
        <div className="w-full md:w-[520px] flex flex-col gap-4">
          <Link to={backTo} className="inline-flex items-center gap-1.5 text-[13px]" style={{ color: T.ink3 }}>‹ Quay lại</Link>
          {children}
        </div>
      </div>
    </div>
  );
}

export function ProviderOption({ p, on, onClick, disabled }: { p: (typeof PROVIDERS)[number]; on: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className="flex items-center gap-3 px-4 py-3.5 rounded-xl text-left w-full" style={{ border: `1.5px solid ${on ? T.accent : T.line2}`, background: on ? T.accentSoft : T.surface, opacity: disabled ? 0.5 : 1 }}>
      <Radio on={on} />
      <span className="w-9 h-[26px] rounded-md inline-flex items-center justify-center text-[9px] font-extrabold serif flex-shrink-0" style={{ background: p.bg, color: T.surface }}>{p.logo}</span>
      <span className="flex-grow"><span className="block font-semibold text-[14px]">{p.name}</span><span className="block muted text-[12px]">{p.desc}</span></span>
    </button>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  const copy = () => { void navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }); };
  return <button type="button" onClick={copy} aria-label="Sao chép" style={{ color: ok ? T.teal : T.ink3 }}>{ok ? <Check size={14} /> : <Copy size={14} />}</button>;
}

export function BankQrCard({ i }: { i: BankQr }) {
  return (
    <div className="card p-5 flex gap-5 items-center flex-col sm:flex-row">
      <img src={i.qrImageUrl} alt="Mã QR chuyển khoản" width={160} height={160} className="rounded-xl flex-shrink-0" style={{ background: T.surface, border: `1px solid ${T.line2}` }} />
      <div className="flex-grow flex flex-col gap-2 text-[13px] w-full">
        <div><div className="muted text-[12px]">Ngân hàng</div><div className="font-semibold">{i.bankName} · {i.accountHolder}</div></div>
        <div><div className="muted text-[12px]">Số tài khoản</div><div className="font-semibold flex items-center gap-1.5">{i.accountNumber} <CopyBtn text={i.accountNumber} /></div></div>
        <div><div className="muted text-[12px]">Số tiền</div><div className="font-semibold flex items-center gap-1.5">{money(i.amountMinor)} <CopyBtn text={String(i.amountMinor)} /></div></div>
        <div><div className="muted text-[12px]">Nội dung chuyển khoản</div><div className="font-bold flex items-center gap-1.5" style={{ color: T.accent }}>{i.transferContent} <CopyBtn text={i.transferContent} /></div></div>
        <div className="muted text-[12px]">Giữ đúng nội dung để hệ thống nhận diện</div>
      </div>
    </div>
  );
}

export function Waiting({ text = 'Đang chờ tiền về… trang sẽ tự chuyển khi nhận được' }: { text?: string }) {
  return <div className="muted text-[12px] text-center flex items-center justify-center gap-1.5"><Clock size={14} />{text}</div>;
}

export function Totals({ lines, total, referredBy }: { lines: Array<{ label: string; amountMinor: number }>; total: number; referredBy: string | null }) {
  return (
    <>
      <div className="flex flex-col gap-1.5 text-[14px] pt-2" style={{ borderTop: `1px solid ${T.line}` }}>
        {lines.map((l) => <div key={l.label} className="flex"><span className="flex-grow" style={{ color: T.ink2 }}>{l.label}</span><span>{money(l.amountMinor)}</span></div>)}
        <div className="flex items-baseline pt-1.5"><span className="flex-grow font-bold">Tổng thanh toán</span><span className="serif text-[24px] font-extrabold">{money(total)}</span></div>
      </div>
      {referredBy && <div className="muted text-[12px] flex items-center gap-1.5"><Users size={14} />Bạn được giới thiệu bởi {referredBy}</div>}
    </>
  );
}
