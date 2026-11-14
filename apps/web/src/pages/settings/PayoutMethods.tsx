// Danh sách sáu cách nhận tiền ở Cài đặt, Nhận tiền: chuyển khoản QR (tự bấm xác nhận), QR tự động qua SePay, MoMo,
// VNPAY, PayPal, thẻ Visa và Mastercard qua Stripe. Mỗi hàng: trạng thái, bật tắt, đặt làm mặc định, và khung cài đặt mở
// ngay dưới hàng. Cài cách nào thì người mua thấy cách đó; cách mặc định được chọn sẵn ở bước thanh toán.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { OWNER_GATEWAY_FIELDS, type OwnerGateway, type PaymentProvider } from '@hoiminh/contracts';
import { Button, Field, Input, Select, T, Tag, Toggle } from '@hoiminh/ui';
import { Check, ChevronDown, ChevronUp, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { api, errorMessage } from '@/lib/api';
import { shellKey, useShell } from '@/lib/community';
import { fmtDateTime } from '@/lib/format';
import { OWNER_METHOD_META, ownerRows, type GatewayState, type OwnerMethodKey, type OwnerRow } from '@/lib/payment-methods';
import { webhookLink } from '@/lib/payout-webhook';
import { payoutSetupKey, type ConfirmMode, type PayoutAccount, type PayoutSetup } from './PayoutParts';

/** Làm mới mọi chỗ đọc trạng thái nhận tiền sau khi chủ hội đổi gì đó. */
function useRefresh() {
  const qc = useQueryClient();
  const shell = useShell();
  const cid = shell.community.id;
  return () => {
    void qc.invalidateQueries({ queryKey: payoutSetupKey(cid) });
    void qc.invalidateQueries({ queryKey: ['payout-settings', cid] });
    void qc.invalidateQueries({ queryKey: ['overview', cid] });
    void qc.invalidateQueries({ queryKey: shellKey(shell.community.slug) });
  };
}

export function MethodLogo({ k }: { k: OwnerMethodKey }) {
  const m = OWNER_METHOD_META[k];
  return <span className="w-12 h-9 rounded-lg inline-flex items-center justify-center text-[11px] font-extrabold serif flex-shrink-0" style={{ background: m.bg, color: T.invertInk }} aria-hidden>{m.logo}</span>;
}

function CopyBox({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { void navigator.clipboard.writeText(value).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 2000); }, () => undefined); };
  return (
    <div className="flex gap-2 items-center flex-wrap" aria-label={label}>
      <code className="flex-grow min-w-0 break-all rounded-[10px] px-3 py-2.5 text-[14px]" style={{ background: T.bg, flexBasis: 260 }}>{value}</code>
      <Button size="sm" onClick={copy} icon={copied ? <Check size={16} /> : <Copy size={16} />}>{copied ? 'Đã sao chép' : 'Sao chép'}</Button>
    </div>
  );
}

function Status({ ok, title, children }: { ok: boolean; title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-[12px] px-3.5 py-3" role="status" style={{ background: ok ? T.tealSoft : T.goldSoft, color: ok ? T.tealText : T.goldText }}>
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-[7px]" style={{ background: ok ? T.teal : T.gold }} />
      <div className="flex flex-col text-[15px]"><span className="font-bold">{title}</span><span>{children}</span></div>
    </div>
  );
}

/**
 * Nối SePay để đơn chuyển khoản tự xác nhận: hướng dẫn từng bước, địa chỉ báo có riêng của hội, và dòng trạng thái tự
 * chuyển sang "Đã nối" khi Hội Mình nhận được lần báo có đầu tiên (kể cả lần "Gửi thử" của SePay).
 */
function SepayBox({ account }: { account: PayoutAccount }) {
  const shell = useShell();
  const refresh = useRefresh();
  const rotate = useMutation({ mutationFn: () => api.post<PayoutAccount>(`/v1/communities/${shell.community.id}/payout-account/rotate-webhook`, {}), onSuccess: refresh });
  const connected = webhookLink(account) === 'connected';
  return (
    <section className="flex flex-col gap-3 rounded-[14px] p-4" style={{ border: `1px solid ${T.line2}` }} aria-label="Nối SePay để đơn tự xác nhận">
      <span className="font-bold text-[16px]">Nối SePay để đơn tự xác nhận</span>
      <p className="m-0 text-[15px]" style={{ color: T.ink2 }}>SePay là dịch vụ báo biến động số dư, có gói miễn phí với số giao dịch mỗi tháng có giới hạn. Bạn dùng tài khoản SePay của riêng bạn; Hội Mình không thu phí phần này.</p>
      <ol className="m-0 pl-5 flex flex-col gap-2 text-[15px] list-decimal" style={{ color: T.ink2 }}>
        <li>Mở tài khoản tại <a href="https://sepay.vn" target="_blank" rel="noreferrer" className="font-semibold underline">sepay.vn</a> rồi thêm tài khoản {account.bankName} {account.accountNumber} của bạn vào đó.</li>
        <li>Trong SePay, vào mục Webhooks và tạo một webhook mới. Chọn sự kiện <strong style={{ color: T.ink }}>Có tiền vào</strong>, rồi dán địa chỉ bên dưới vào ô URL.</li>
        <li>Ở phần bảo mật chọn <strong style={{ color: T.ink }}>không xác thực</strong>: địa chỉ này đã là mã bí mật riêng của hội. Nếu có mục bỏ qua giao dịch không có mã thanh toán thì để tắt.</li>
        <li>Lưu lại, rồi bấm <strong style={{ color: T.ink }}>Gửi thử</strong> trong SePay, hoặc chuyển thử một khoản nhỏ vào tài khoản. Dòng trạng thái bên dưới báo "Đã nối" là xong.</li>
      </ol>
      <CopyBox value={account.webhookUrl} label="Địa chỉ báo có của hội" />
      <Status ok={connected} title={connected ? 'Đã nối' : 'Đang chờ tín hiệu đầu tiên từ SePay'}>
        {connected ? `Lần báo có gần nhất: ${fmtDateTime(account.lastWebhookAt)}. Từ giờ đơn có đúng nội dung và đủ tiền sẽ tự chuyển sang đã trả.` : 'Trang này tự kiểm tra vài giây một lần, bạn không cần tải lại. Trong lúc chờ, bạn vẫn bấm "Đã nhận tiền" được cho từng đơn.'}
      </Status>
      <div className="flex items-center gap-3 flex-wrap text-[14px]" style={{ color: T.ink3 }}>
        <span className="flex-grow" style={{ flexBasis: 220 }}>Địa chỉ bị lộ? Đổi địa chỉ mới, địa chỉ cũ ngừng nhận ngay.</span>
        <Button size="sm" loading={rotate.isPending} onClick={() => { if (window.confirm('Đổi địa chỉ báo có? Địa chỉ cũ ngừng nhận ngay, bạn cần dán địa chỉ mới vào SePay.')) rotate.mutate(); }} icon={<RefreshCw size={16} />}>Đổi địa chỉ</Button>
      </div>
      {rotate.isError && <span className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(rotate.error)}</span>}
    </section>
  );
}

interface BankForm { bankCode: string; accountNumber: string; accountHolder: string }
const toBankForm = (a: PayoutAccount | null, banks: PayoutSetup['banks']): BankForm => ({ bankCode: a?.bankCode ?? banks[0]?.code ?? 'VCB', accountNumber: a?.accountNumber ?? '', accountHolder: a?.accountHolder ?? '' });

/** Khung cài chuyển khoản: tài khoản ngân hàng dùng chung cho hai cách, lưu kèm cách xác nhận của hàng đang mở. */
function BankPanel({ d, mode, on }: { d: PayoutSetup; mode: ConfirmMode; on: boolean }) {
  const shell = useShell();
  const refresh = useRefresh();
  const [f, setF] = useState<BankForm>(() => toBankForm(d.account, d.banks));
  const [saved, setSaved] = useState(false);
  // Tài khoản trên máy chủ đổi (lưu xong, người khác sửa) thì nạp lại ô nhập.
  useEffect(() => { setF(toBankForm(d.account, d.banks)); }, [d.account?.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const patch = (p: Partial<BankForm>) => { setF((prev) => ({ ...prev, ...p })); setSaved(false); };
  const save = useMutation({
    mutationFn: () => api.put<PayoutAccount>(`/v1/communities/${shell.community.id}/payout-account`, { ...f, accountNumber: f.accountNumber.replace(/\s/g, ''), confirmMode: mode, enabled: true }),
    onSuccess: () => { setSaved(true); refresh(); },
  });
  const dirty = JSON.stringify(f) !== JSON.stringify(toBankForm(d.account, d.banks));
  const valid = /^\d{6,20}$/.test(f.accountNumber.replace(/\s/g, '')) && f.accountHolder.trim().length >= 3;
  const label = on ? 'Lưu thay đổi' : !d.ready ? 'Lưu và mở thanh toán' : mode === 'auto' ? 'Lưu và bật QR tự động' : 'Lưu và bật chuyển khoản QR';
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid-2">
        <Field label="Ngân hàng"><Select aria-label="Ngân hàng" value={f.bankCode} onChange={(e) => patch({ bankCode: e.target.value })}>{d.banks.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}</Select></Field>
        <Field label="Số tài khoản"><Input inputMode="numeric" value={f.accountNumber} onChange={(e) => patch({ accountNumber: e.target.value.replace(/[^\d\s]/g, '').slice(0, 24) })} placeholder="Số tài khoản" /></Field>
      </div>
      <Field label="Tên chủ tài khoản"><Input value={f.accountHolder} onChange={(e) => patch({ accountHolder: e.target.value.toUpperCase().slice(0, 80) })} placeholder="Viết đúng như trên tài khoản ngân hàng" /></Field>
      <p className="m-0 text-[14px]" style={{ color: T.ink3 }}>Người mua thấy mã QR chuyển khoản tới đúng tài khoản này, kèm nội dung có mã đơn. Hai cách chuyển khoản dùng chung tài khoản này, mỗi lúc bật một cách: bật cách này thì cách kia tự tắt.</p>
      <div className="flex items-center gap-3 flex-wrap">
        {save.isError && <span className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</span>}
        {saved && !dirty && <span className="text-[14px] inline-flex items-center gap-1.5" style={{ color: T.tealText }}><Check size={16} />Đã lưu.</span>}
        <span className="flex-grow" />
        <Button variant="primary" disabled={!valid || (on && !dirty)} loading={save.isPending} onClick={() => save.mutate()}>{label}</Button>
      </div>
      {mode === 'auto' && d.account?.confirmMode === 'auto' && <SepayBox account={d.account} />}
    </div>
  );
}

/** Hướng dẫn lấy khóa của từng cổng, đúng tên mục trong trang quản lý của cổng đó. */
const GUIDE: Record<OwnerGateway, ReactNode[]> = {
  momo: [
    <>Đăng ký tài khoản doanh nghiệp tại <a href="https://business.momo.vn" target="_blank" rel="noreferrer" className="font-semibold underline">business.momo.vn</a> và mở cổng thanh toán cho website.</>,
    <>Vào mục <strong>Thông tin tích hợp</strong>, chép Partner Code, Access Key và Secret Key vào các ô bên dưới rồi bấm Lưu.</>,
    <>Xong. MoMo tự báo kết quả về địa chỉ riêng của hội cho từng đơn, bạn không phải dán địa chỉ ở đâu.</>,
  ],
  vnpay: [
    <>Đăng ký cổng thanh toán VNPAY cho website tại <a href="https://vnpay.vn" target="_blank" rel="noreferrer" className="font-semibold underline">vnpay.vn</a>. VNPAY gửi email có Mã website (vnp_TmnCode) và Chuỗi bí mật (vnp_HashSecret).</>,
    <>Chép hai mã vào các ô bên dưới rồi bấm Lưu.</>,
    <>Gửi <strong>địa chỉ IPN</strong> hiện ra sau khi lưu cho VNPAY (qua email hỗ trợ kỹ thuật hoặc trang quản lý merchant) để VNPAY báo kết quả về hội.</>,
  ],
  paypal: [
    <>Đăng nhập <a href="https://developer.paypal.com" target="_blank" rel="noreferrer" className="font-semibold underline">developer.paypal.com</a> bằng tài khoản PayPal Business, vào <strong>Apps &amp; Credentials</strong>, tạo một ứng dụng (chọn Live để nhận tiền thật).</>,
    <>Chép Client ID và Secret vào các ô bên dưới rồi bấm Lưu.</>,
    <>Trong ứng dụng đó, mục <strong>Webhooks</strong>, bấm Add Webhook: dán địa chỉ webhook của hội, chọn 4 sự kiện Checkout order approved, Payment capture completed, Payment capture denied, Payment capture refunded.</>,
    <>Chép <strong>Webhook ID</strong> vào ô Webhook ID rồi bấm Lưu. Xong bước này người mua mới thấy PayPal.</>,
  ],
  stripe: [
    <>Đăng nhập <a href="https://dashboard.stripe.com" target="_blank" rel="noreferrer" className="font-semibold underline">dashboard.stripe.com</a>, vào <strong>Developers, API keys</strong>, chép Secret key (sk_live_...) vào ô bên dưới rồi bấm Lưu.</>,
    <>Vào <strong>Developers, Webhooks</strong>, bấm Add endpoint: dán địa chỉ webhook của hội, chọn các sự kiện checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.async_payment_failed, checkout.session.expired, charge.refunded.</>,
    <>Chép <strong>Signing secret</strong> (whsec_...) vào ô Signing secret rồi bấm Lưu. Xong bước này người mua mới thấy thẻ Visa, Mastercard.</>,
  ],
};

/** Chữ hướng dẫn cạnh địa chỉ webhook của từng cổng. */
const WEBHOOK_HINT: Record<OwnerGateway, string> = {
  momo: 'Địa chỉ MoMo gọi về. Hội Mình tự gửi địa chỉ này cho MoMo với từng đơn.',
  vnpay: 'Địa chỉ IPN: gửi cho VNPAY để VNPAY báo kết quả thanh toán về hội.',
  paypal: 'Địa chỉ webhook: dán vào mục Webhooks của ứng dụng PayPal.',
  stripe: 'Địa chỉ webhook: dán vào Developers, Webhooks, Add endpoint của Stripe.',
};

/** Khung cài một cổng riêng của chủ hội: hướng dẫn, ô khóa, địa chỉ webhook, chế độ thử và thật, gỡ cổng. */
function GatewayPanel({ provider, g }: { provider: OwnerGateway; g: GatewayState }) {
  const shell = useShell();
  const refresh = useRefresh();
  const [cred, setCred] = useState<Record<string, string>>({});
  const [mode, setMode] = useState(g.mode);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setMode(g.mode); }, [g.mode]);
  const fields = OWNER_GATEWAY_FIELDS[provider];
  const url = `/v1/communities/${shell.community.id}/payment-gateways/${provider}`;
  const save = useMutation({
    mutationFn: () => api.put<GatewayState>(url, { ...(provider === 'stripe' ? {} : { mode }), ...(g.configured ? {} : { enabled: true }), credentials: cred }),
    onSuccess: () => { setCred({}); setSaved(true); refresh(); },
  });
  const remove = useMutation({ mutationFn: () => api.del<GatewayState>(url), onSuccess: refresh });
  const name = OWNER_METHOD_META[provider].name;
  const filled = (k: string) => Boolean(cred[k]?.trim()) || Boolean(g.summary[k]);
  const ready = fields.filter((f) => !f.webhookStep).every((f) => filled(f.key));
  const changed = Object.values(cred).some((v) => v.trim()) || (provider !== 'stripe' && g.configured && mode !== g.mode);
  const field = (f: (typeof fields)[number]) => (
    <Field key={f.key} label={f.label} hint={f.webhookStep && !g.configured ? 'Điền sau khi lưu lần đầu và thêm địa chỉ webhook của hội' : undefined}>
      <Input type={f.secret ? 'password' : 'text'} autoComplete="off" value={cred[f.key] ?? ''} onChange={(e) => { setCred({ ...cred, [f.key]: e.target.value }); setSaved(false); }} placeholder={g.summary[f.key] ? (f.secret ? `Đã lưu ${g.summary[f.key]}, để trống để giữ nguyên` : g.summary[f.key]) : f.placeholder} aria-label={f.label} />
    </Field>
  );
  return (
    <div className="flex flex-col gap-3.5">
      <ol className="m-0 pl-5 flex flex-col gap-2 text-[15px] list-decimal" style={{ color: T.ink2 }}>{GUIDE[provider].map((step, i) => <li key={i}>{step}</li>)}</ol>
      {fields.filter((f) => !f.webhookStep).map(field)}
      {provider !== 'stripe' && (
        <Field label="Chế độ"><Select aria-label={`Chế độ ${name}`} value={mode} onChange={(e) => { setMode(e.target.value as 'production'); setSaved(false); }}><option value="production">Chạy thật (nhận tiền thật)</option><option value="sandbox">Thử nghiệm (khóa sandbox của cổng)</option></Select></Field>
      )}
      {provider === 'stripe' && <p className="m-0 text-[14px]" style={{ color: T.ink3 }}>Khóa sk_live_ là chạy thật, sk_test_ là thử nghiệm. Stripe cần tài khoản doanh nghiệp ở quốc gia Stripe hỗ trợ.</p>}
      {provider === 'paypal' && <p className="m-0 text-[14px]" style={{ color: T.ink3 }}>PayPal thu bằng USD: giá của hội được quy đổi theo tỷ giá Hội Mình đang dùng, làm tròn lên tới cent.</p>}
      {g.webhookUrl && (
        <div className="flex flex-col gap-2">
          <span className="text-[14px] font-semibold">{WEBHOOK_HINT[provider]}</span>
          <CopyBox value={g.webhookUrl} label={`Địa chỉ webhook ${name}`} />
        </div>
      )}
      {g.configured && fields.filter((f) => f.webhookStep).map(field)}
      {g.configured && (
        g.complete
          ? <Status ok={Boolean(g.lastWebhookAt)} title={g.lastWebhookAt ? `Đã nhận tín hiệu từ ${name}` : `Chưa nhận tín hiệu nào từ ${name}`}>{g.lastWebhookAt ? `Lần gần nhất: ${fmtDateTime(g.lastWebhookAt)}.` : 'Có đơn đầu tiên trả xong là thấy ở đây. Đơn trả xong tự chuyển sang đã trả, người mua được mở quyền ngay.'}</Status>
          : <Status ok={false} title="Còn một bước nữa">Còn thiếu: {g.missing.join(', ')}. Người mua chưa thấy {name} cho tới khi bạn điền đủ.</Status>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        {(save.isError || remove.isError) && <span className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(save.error ?? remove.error)}</span>}
        {saved && !changed && <span className="text-[14px] inline-flex items-center gap-1.5" style={{ color: T.tealText }}><Check size={16} />Đã lưu.</span>}
        {g.configured && <Button size="sm" variant="ghost" loading={remove.isPending} icon={<Trash2 size={16} />} onClick={() => { if (window.confirm(`Gỡ ${name}? Khóa đã lưu bị xóa, người mua không thấy ${name} nữa.`)) remove.mutate(); }}>Gỡ cổng</Button>}
        <span className="flex-grow" />
        <Button variant="primary" disabled={!ready || (g.configured && !changed)} loading={save.isPending} onClick={() => save.mutate()}>{g.configured ? 'Lưu thay đổi' : `Lưu ${name}`}</Button>
      </div>
    </div>
  );
}

function StateTag({ r }: { r: OwnerRow }) {
  if (r.state === 'on') return <Tag tone="teal">Đang bật</Tag>;
  if (r.state === 'incomplete') return <Tag tone="gold">Còn một bước</Tag>;
  if (r.state === 'off') return <Tag tone="neutral">Đang tắt</Tag>;
  return <Tag tone="neutral">Chưa cài</Tag>;
}

/** Một hàng: logo, tên, trạng thái, nút bật tắt và đặt mặc định; bấm "Cài đặt" hoặc "Sửa" để mở khung ngay dưới. */
function MethodRow({ r, d, open, onToggleOpen, onOpen }: { r: OwnerRow; d: PayoutSetup; open: boolean; onToggleOpen: () => void; onOpen: () => void }) {
  const shell = useShell();
  const refresh = useRefresh();
  const cid = shell.community.id;
  const meta = OWNER_METHOD_META[r.key];
  const methods = useMutation({ mutationFn: (body: { defaultMethod?: PaymentProvider; bankEnabled?: boolean }) => api.patch(`/v1/communities/${cid}/payment-methods`, body), onSuccess: refresh });
  const bank = useMutation({ mutationFn: (mode: ConfirmMode) => api.put(`/v1/communities/${cid}/payout-account`, { bankCode: d.account!.bankCode, accountNumber: d.account!.accountNumber, accountHolder: d.account!.accountHolder, confirmMode: mode, enabled: true }), onSuccess: refresh });
  const gateway = useMutation({ mutationFn: (enabled: boolean) => api.put(`/v1/communities/${cid}/payment-gateways/${r.key}`, { enabled }), onSuccess: refresh });
  const busy = methods.isPending || bank.isPending || gateway.isPending;
  const err = methods.error ?? bank.error ?? gateway.error;
  const toggle = (on: boolean) => {
    if (r.key === 'bank' || r.key === 'sepay_auto') {
      if (!on) methods.mutate({ bankEnabled: false });
      else {
        bank.mutate(r.key === 'bank' ? 'manual' : 'auto');
        // Bật QR tự động thì mở luôn khung hướng dẫn nối SePay.
        if (r.key === 'sepay_auto') onOpen();
      }
    } else gateway.mutate(on);
  };
  const sub = r.key === 'sepay_auto' && r.state === 'on' && d.account
    ? (webhookLink(d.account) === 'connected' ? 'Đã nối SePay' : 'Đang chờ tín hiệu đầu tiên từ SePay')
    : r.state === 'incomplete' && r.gateway ? `Còn thiếu: ${r.gateway.missing.join(', ')}` : null;
  return (
    <div className="flex flex-col gap-3 py-4" style={{ borderTop: `1px solid ${T.line}` }} role="group" aria-label={meta.name}>
      <div className="flex items-start gap-3 flex-wrap">
        <MethodLogo k={r.key} />
        <div className="flex flex-col gap-0.5 min-w-0 flex-grow" style={{ flexBasis: 220 }}>
          <div className="flex items-center gap-2 flex-wrap"><span className="font-bold text-[16px]">{meta.name}</span><StateTag r={r} />{r.isDefault && <Tag tone="gold">Mặc định</Tag>}</div>
          <span className="text-[14px]" style={{ color: T.ink2 }}>{meta.desc}</span>
          {sub && <span className="text-[14px] font-semibold" style={{ color: T.goldText }}>{sub}</span>}
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {r.state === 'on' && !r.isDefault && d.methods.length > 1 && <Button size="sm" disabled={busy} onClick={() => methods.mutate({ defaultMethod: r.buyerKey })}>Đặt làm mặc định</Button>}
          {(r.state === 'on' || r.state === 'off') && <Toggle on={r.state === 'on'} disabled={busy} onChange={toggle} label={`Bật ${meta.name}`} />}
          <Button size="sm" variant={r.state === 'off_unset' ? 'primary' : 'ghost'} onClick={onToggleOpen} aria-expanded={open} icon={open ? <ChevronUp size={16} /> : r.state === 'off_unset' ? undefined : <ChevronDown size={16} />}>{r.state === 'off_unset' ? 'Cài đặt' : open ? 'Thu gọn' : 'Sửa'}</Button>
        </div>
      </div>
      {err && <span className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(err)}</span>}
      {open && (
        <div className="rounded-[14px] p-4" style={{ background: T.bg }} aria-label={`Cài ${meta.name}`} role="region">
          {r.key === 'bank' || r.key === 'sepay_auto'
            ? <BankPanel d={d} mode={r.key === 'bank' ? 'manual' : 'auto'} on={r.state === 'on'} />
            : <GatewayPanel provider={r.key} g={r.gateway!} />}
        </div>
      )}
    </div>
  );
}

/** Danh sách sáu cách nhận tiền. Hội chưa cài gì thì mở sẵn khung chuyển khoản QR, cách đơn giản nhất để bắt đầu. */
export function MethodList({ d }: { d: PayoutSetup }) {
  const rows = ownerRows(d);
  const [open, setOpen] = useState<OwnerMethodKey | null>(() => (d.ready ? null : 'bank'));
  return (
    <section className="card flex flex-col px-5 pt-5 pb-1" aria-label="Cách nhận tiền">
      <span className="font-bold text-[18px]">Cách nhận tiền</span>
      <span className="text-[15px] pb-3" style={{ color: T.ink2 }}>Cài cách nào thì người mua thấy cách đó. Tiền về thẳng tài khoản của bạn ở từng cổng. Cách đặt làm mặc định được chọn sẵn cho người mua.</span>
      {rows.map((r) => <MethodRow key={r.key} r={r} d={d} open={open === r.key} onToggleOpen={() => setOpen(open === r.key ? null : r.key)} onOpen={() => setOpen(r.key)} />)}
    </section>
  );
}
