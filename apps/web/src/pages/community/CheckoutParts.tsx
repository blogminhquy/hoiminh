// Mảnh dùng chung của luồng Thanh toán: khung một cột, tiêu đề từng phần, hàng lựa chọn (thời hạn, cách thanh toán),
// bảng tiền, khối mã QR chuyển khoản kèm các hàng sao chép, dòng chờ. Cả ba màn (chọn gói, mã QR, chờ xác nhận) xếp
// từ trên xuống trong một cột rộng khoảng 660px, trên điện thoại chiếm hết bề ngang.
import { Logo, Radio, T, money } from '@hoiminh/ui';
import { Check, ChevronLeft, Copy, Download, Info, ShieldCheck, Users } from 'lucide-react';
import { useEffect, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { PaymentProvider } from '@hoiminh/contracts';
import { saveBlob } from '@/lib/download';
import { fmtTime } from '@/lib/format';

export type Provider = PaymentProvider;
export const PROVIDERS: Array<{ key: Provider; name: string; desc: string; logo: string; bg: string }> = [
  { key: 'sepay', name: 'Chuyển khoản QR', desc: 'Quét bằng app ngân hàng, kích hoạt tự động dưới 1 phút', logo: 'QR', bg: T.ink },
  { key: 'momo', name: 'MoMo', desc: 'Xác nhận ngay trong ví MoMo', logo: 'MoMo', bg: '#A50064' },
  { key: 'vnpay', name: 'VNPAY', desc: 'Thẻ nội địa hoặc QR ngân hàng', logo: 'VNPAY', bg: '#0A5EB0' },
  { key: 'paypal', name: 'PayPal', desc: 'Thanh toán bằng USD cho khách quốc tế', logo: 'PayPal', bg: '#003087' },
  { key: 'stripe', name: 'Thẻ Visa, Mastercard', desc: 'Thẻ quốc tế, thanh toán an toàn qua Stripe', logo: 'Thẻ', bg: '#635BFF' },
];
export const providerMeta = (key: string | null | undefined) => PROVIDERS.find((x) => x.key === key) ?? PROVIDERS[0]!;
export interface BankQr { kind: 'bank_qr'; qrImageUrl: string; bankName: string; bankCode: string; accountNumber: string; accountHolder: string; amountMinor: number; transferContent: string; /** 'owner' = tiền về thẳng tài khoản chủ hội. */ payee?: 'owner'; confirmMode?: 'manual' | 'auto' }
export interface Redirect { kind: 'redirect'; url: string; deeplink?: string; /** 'owner' = trả qua cổng của chính chủ hội. */ payee?: 'owner' }
export type Instruction = BankQr | Redirect;

/** Giờ trước, ngày sau, kiểu người Việt đọc: "01:42 ngày 23/11" (theo múi giờ của máy người xem). */
export function fmtClockDay(input: string | Date | null | undefined): string {
  if (!input) return '';
  const v = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(v.getTime())) return '';
  const two = (n: number) => String(n).padStart(2, '0');
  return `${fmtTime(v)} ngày ${two(v.getDate())}/${two(v.getMonth() + 1)}`;
}

/** Khung trang thanh toán: thanh trên cùng, rồi MỘT cột căn giữa. Mọi phần của trang xếp từ trên xuống trong cột này. */
export function CheckoutFrame({ backTo, children }: { backTo: string; children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg }}>
      <header className="flex items-center gap-4 px-4 md:px-16" style={{ height: 64, borderBottom: `1px solid ${T.line}`, background: T.surface }}>
        <Link to="/"><Logo size={26} /></Link>
        <span className="flex-grow" />
        <span className="muted inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0" style={{ fontSize: 15 }}><ShieldCheck size={18} /><span className="sm:hidden">Thanh toán an toàn</span><span className="hidden sm:inline">Thanh toán được bảo vệ · hủy bất cứ lúc nào</span></span>
      </header>
      <main className="flex-grow w-full mx-auto flex flex-col gap-5 px-4 pt-3 pb-8 md:pt-6 md:pb-14" style={{ maxWidth: 692 }}>
        <Link to={backTo} className="inline-flex items-center gap-1 self-start text-[15px] font-semibold -ml-1.5 pr-3" style={{ color: T.ink2, minHeight: 48 }}><ChevronLeft size={20} />Quay lại</Link>
        {children}
      </main>
    </div>
  );
}

/** Một phần của trang, có tiêu đề ngắn. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-[17px] font-bold leading-snug">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Nhóm lựa chọn một trong nhiều: mỗi hàng là một `RadioRow`. Bàn phím đi như nhóm radio chuẩn: Tab vào hàng đang chọn,
 * phím mũi tên chuyển sang hàng kế và chọn luôn hàng đó.
 */
export function RadioRows({ label, children }: { label: string; children: ReactNode }) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    const rows = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
    const at = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0 || rows.length < 2) return;
    e.preventDefault();
    const next = rows[(at + step + rows.length) % rows.length]!;
    next.focus();
    next.click();
  };
  return <div role="radiogroup" aria-label={label} className="flex flex-col gap-2.5" onKeyDown={onKeyDown}>{children}</div>;
}

/** Một hàng lựa chọn rộng hết bề ngang: nút tròn bên trái, nội dung bên phải. Hàng đang chọn có viền và nền nhấn. */
export function RadioRow({ on, onClick, disabled, children }: { on: boolean; onClick?: () => void; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={on} tabIndex={on ? 0 : -1} disabled={disabled} onClick={onClick} className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left" style={{ minHeight: 64, border: `1.5px solid ${on ? T.primary : T.line2}`, background: on ? T.primarySoft : T.surface, opacity: disabled ? 0.5 : 1 }}>
      <Radio on={on} />
      {children}
    </button>
  );
}

function ProviderLogo({ p }: { p: (typeof PROVIDERS)[number] }) {
  return <span className="w-11 h-8 rounded-md inline-flex items-center justify-center font-extrabold serif flex-shrink-0" style={{ background: p.bg, color: T.invertInk, fontSize: 11 }}>{p.logo}</span>;
}

/** Một cách thanh toán để chọn: biểu tượng, tên, một dòng mô tả. */
export function ProviderOption({ p, on, onClick, disabled }: { p: (typeof PROVIDERS)[number]; on: boolean; onClick?: () => void; disabled?: boolean }) {
  return (
    <RadioRow on={on} onClick={onClick} disabled={disabled}>
      <ProviderLogo p={p} />
      <span className="flex-grow min-w-0"><span className="block font-semibold text-[16px]">{p.name}</span><span className="block text-[14px] leading-snug" style={{ color: T.ink2 }}>{p.desc}</span></span>
    </RadioRow>
  );
}

/** Cách thanh toán đã chọn của một đơn (chỉ để đọc, không bấm được). */
export function ProviderLine({ p }: { p: (typeof PROVIDERS)[number] }) {
  return <span className="inline-flex items-center gap-2.5 font-semibold text-[15px]"><ProviderLogo p={p} />{p.name}</span>;
}

/**
 * Bảng tiền: từng dòng rồi "Tổng thanh toán" số lớn. `totalOnDesktopOnly` dùng ở màn chọn gói: trên điện thoại tổng tiền
 * nằm trong thanh ghim dưới đáy cùng nút thanh toán, nên bảng không lặp lại.
 */
export function Totals({ lines, total, referredBy, totalOnDesktopOnly }: { lines: Array<{ label: string; amountMinor: number }>; total: number; referredBy: string | null; totalOnDesktopOnly?: boolean }) {
  return (
    <div className="card px-4 py-3.5 md:px-5 flex flex-col gap-2">
      {lines.map((l) => <div key={l.label} className="flex gap-3 text-[15px]"><span className="flex-grow min-w-0" style={{ color: T.ink2 }}>{l.label}</span><span className="whitespace-nowrap">{money(l.amountMinor)}</span></div>)}
      <div className={`${totalOnDesktopOnly ? 'hidden md:flex' : 'flex'} items-center gap-3 pt-2.5 mt-0.5`} style={{ borderTop: `1px solid ${T.line}` }}><span className="flex-grow font-bold text-[16px]">Tổng thanh toán</span><span className="serif text-[28px] leading-none font-extrabold whitespace-nowrap">{money(total)}</span></div>
      {referredBy && <div className="text-[14px] flex items-center gap-1.5" style={{ color: T.ink2 }}><Users size={16} />Bạn được giới thiệu bởi {referredBy}</div>}
    </div>
  );
}

/** Sao chép vào bộ nhớ tạm; trình duyệt chặn Clipboard API (trang không bảo mật, webview cũ) thì dùng cách cũ. */
async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    el.remove();
    return ok;
  }
}

/** Một hàng thông tin chuyển khoản: nhãn nhỏ ở trên, giá trị chữ lớn ở dưới, nút "Sao chép" bên phải nếu có `copy`. */
function InfoRow({ label, value, copy, strong }: { label: string; value: string; /** Chuỗi đưa vào bộ nhớ tạm khi bấm nút. */ copy?: string; /** Hàng quan trọng nhất (nội dung chuyển khoản): nền và chữ nhấn. */ strong?: boolean }) {
  const [ok, setOk] = useState(false);
  const onCopy = () => { void copyText(copy ?? value).then((done) => { if (!done) return; setOk(true); setTimeout(() => setOk(false), 1800); }); };
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 md:px-5" style={{ minHeight: 68, background: strong ? T.accentSoft : undefined }}>
      <div className="flex-grow min-w-0">
        <div style={{ color: strong ? T.accentText : T.ink3, fontSize: 15 }}>{label}</div>
        <div className="text-[17px] font-bold break-words leading-snug" style={{ color: strong ? T.accentText : T.ink }}>{value}</div>
      </div>
      {copy !== undefined && (
        <button type="button" onClick={onCopy} aria-label={`${ok ? 'Đã sao chép' : 'Sao chép'} ${label.toLowerCase()}`} className="btn btn-ghost flex-shrink-0" style={{ height: 48, width: 138, padding: 0, fontSize: 15, color: ok ? T.tealText : T.ink, borderColor: ok ? T.teal : T.line2 }}>
          {ok ? <Check size={18} /> : <Copy size={18} />}<span aria-live="polite">{ok ? 'Đã sao chép' : 'Sao chép'}</span>
        </button>
      )}
    </div>
  );
}

/**
 * Ảnh mã QR to, nền trắng, đủ lớn để quét từ màn hình máy tính. Người dùng điện thoại không tự quét được màn hình của
 * mình, nên có nút "Lưu ảnh mã QR" để mở ảnh trong app ngân hàng (quét từ ảnh). Nút chỉ hiện khi trình duyệt tải được
 * ảnh về thật (máy chủ ảnh cho phép tải từ tên miền khác); không tải được thì không có nút, không làm nút giả.
 */
function QrImage({ url, fileName }: { url: string; fileName: string }) {
  const [blob, setBlob] = useState<Blob | null>(null);
  useEffect(() => {
    let alive = true;
    setBlob(null);
    fetch(url, { mode: 'cors', credentials: 'omit' })
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (alive && b && b.type.startsWith('image/')) setBlob(b); })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [url]);
  const save = () => {
    if (!blob) return;
    const name = `${fileName}.${blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/svg+xml' ? 'svg' : 'png'}`;
    // Điện thoại: mở bảng chia sẻ của máy, ở đó có "Lưu hình ảnh" vào thư viện ảnh (app ngân hàng đọc ảnh từ thư viện).
    // Máy tính, hoặc máy không chia sẻ được tệp: tải về như một tệp thường.
    const file = new File([blob], name, { type: blob.type });
    const touch = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (touch && typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
      navigator.share({ files: [file] }).catch((err: unknown) => { if ((err as { name?: string } | null)?.name !== 'AbortError') saveBlob(blob, name); });
      return;
    }
    saveBlob(blob, name);
  };
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-5">
      <img src={url} alt="Mã QR chuyển khoản" width={264} height={264} className="rounded-2xl" style={{ width: 264, height: 264, maxWidth: '100%', objectFit: 'contain', background: '#FFFFFF', border: `1px solid ${T.line2}`, padding: 10 }} />
      {blob && <button type="button" onClick={save} className="btn btn-ghost" style={{ height: 48 }}><Download size={18} />Lưu ảnh mã QR</button>}
    </div>
  );
}

/** Ba bước chuyển khoản, ngắn gọn. */
export function TransferSteps() {
  const steps = ['Mở app ngân hàng, chọn quét mã QR.', 'Quét mã bên dưới. Đang dùng điện thoại thì lưu ảnh mã rồi chọn ảnh đó trong app ngân hàng, hoặc sao chép từng dòng.', 'Kiểm tra đúng số tiền và nội dung chuyển khoản rồi mới xác nhận chuyển.'];
  return (
    <ol className="card px-4 py-3.5 md:px-5 flex flex-col gap-2.5">
      {steps.map((s, i) => (
        <li key={s} className="flex gap-3 text-[15px] leading-snug"><span className="w-7 h-7 rounded-full inline-flex items-center justify-center flex-shrink-0 font-bold text-[14px]" style={{ background: T.primarySoft, color: T.primaryText }}>{i + 1}</span><span className="pt-0.5">{s}</span></li>
      ))}
    </ol>
  );
}

/** Khối chuyển khoản: mã QR to ở trên, rồi từng hàng thông tin rộng hết bề ngang có nút sao chép, cuối là câu lưu ý. */
export function BankQrCard({ i, flat }: { i: BankQr; /** Nằm sẵn trong một thẻ khác: không vẽ thêm khung, để các hàng vẫn rộng hết bề ngang. */ flat?: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <div className={flat ? '' : 'card overflow-hidden'} style={flat ? { borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` } : undefined}>
        <QrImage url={i.qrImageUrl} fileName={`ma-qr-${i.transferContent.replace(/\s+/g, '-').toLowerCase()}`} />
        <div className="flex flex-col" style={{ borderTop: `1px solid ${T.line}` }}>
          <InfoRow label="Ngân hàng" value={i.bankName} />
          <div style={{ borderTop: `1px solid ${T.line}` }}><InfoRow label="Chủ tài khoản" value={i.accountHolder} /></div>
          <div style={{ borderTop: `1px solid ${T.line}` }}><InfoRow label="Số tài khoản" value={i.accountNumber} copy={i.accountNumber} /></div>
          <div style={{ borderTop: `1px solid ${T.line}` }}><InfoRow label="Số tiền" value={money(i.amountMinor)} copy={String(i.amountMinor)} /></div>
          <div style={{ borderTop: `1px solid ${T.line}` }}><InfoRow label="Nội dung chuyển khoản" value={i.transferContent} copy={i.transferContent} strong /></div>
        </div>
      </div>
      <div className={flat ? 'px-4 pb-4 md:px-5' : ''}><Notice>{i.payee === 'owner' ? 'Tiền chuyển thẳng tới chủ hội. Giữ đúng nội dung để đơn được xác nhận.' : 'Giữ đúng nội dung để hệ thống nhận diện.'}</Notice></div>
    </div>
  );
}

/** Khối nhắc: một câu cần đọc trước khi làm tiếp. */
export function Notice({ children }: { children: ReactNode }) {
  return <div className="flex gap-2.5 px-4 py-3 rounded-xl text-[15px] leading-snug font-semibold" style={{ background: T.goldSoft, color: T.goldDark }}><Info size={20} className="flex-shrink-0 mt-px" /><span>{children}</span></div>;
}

/** Vòng xoay nhỏ: đang chờ một việc tự diễn ra (tiền về, chủ hội xác nhận). */
export function Spinner({ size = 18 }: { size?: number }) {
  return <span className="inline-block rounded-full animate-spin flex-shrink-0" style={{ width: size, height: size, border: `${Math.max(2, Math.round(size / 9))}px solid ${T.primarySoft}`, borderTopColor: T.primary }} aria-hidden />;
}

export function Waiting({ text = 'Đang chờ tiền về… trang sẽ tự chuyển khi nhận được' }: { text?: string }) {
  return <div className="text-[14px] leading-snug flex items-center justify-center gap-2 text-center" style={{ color: T.ink2 }}><Spinner size={16} /><span>{text}</span></div>;
}
