// Hệ thống · Hạ tầng và khóa: đổi key Resend, token Cloudflare và key GIPHY (GIF, nhãn dán động) ngay trên web (lưu mã hóa, chỉ hiện 4 ký tự
// cuối, ưu tiên hơn secret của Worker); xem R2 và bí mật hệ thống. Chữ tối thiểu 16px để đọc tốt trên điện thoại.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, T } from '@hoiminh/ui';
import { ArrowRight, CheckCircle2, Cloud, HardDrive, Mail, PlugZap, Send, ShieldCheck, Sticker, Wallet } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { ApiError, api, errorMessage } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { CheckLine, ExtLink, Guide, Panel, Row, SecretInput, SourceTag, StatusPill, TextInput, type Infra, type InfraSection } from './AdminInfraParts';

const KEY = ['admin', 'infra'];

type Section = 'email' | 'release' | 'gif';
interface FieldSpec { name: string; label: string; secret?: boolean; placeholder: string; hint: string; mono?: boolean }

/**
 * Form của một phần: ô bí mật để trống là giữ nguyên, ô thường điền sẵn giá trị đang dùng.
 * Chỉ gửi những ô đã đổi; lưu xong làm mới cả trang Tổng quan (khối cảnh báo hạ tầng).
 */
function useSectionForm(section: Section, data: InfraSection, specs: FieldSpec[]) {
  const qc = useQueryClient();
  const initial = () => Object.fromEntries(specs.map((s) => [s.name, s.secret ? '' : (data.fields[s.name]?.value ?? '')]));
  const [draft, setDraft] = useState<Record<string, string>>(initial);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  // Dữ liệu mới từ máy chủ (sau khi lưu hoặc làm mới) thì đặt lại form.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setDraft(initial()), [data]);
  const changed = specs.filter((s) => (s.secret ? draft[s.name]!.trim() !== '' : draft[s.name]!.trim() !== (data.fields[s.name]?.value ?? '')));
  const save = useMutation({
    mutationFn: (body: { values?: Record<string, string>; clear?: string[] }) => api.put<Infra>(`/v1/admin/infra/${section}`, body),
    onSuccess: (next) => {
      qc.setQueryData(KEY, next);
      void qc.invalidateQueries({ queryKey: ['admin', 'overview'] });
      setSavedAt(new Date());
    },
  });
  const err = save.error instanceof ApiError ? save.error : null;
  const fieldError = (name: string) => ((err?.details as { field?: string } | undefined)?.field === name ? err!.message : null);
  const generalError = save.isError && !(err?.details as { field?: string } | undefined)?.field ? errorMessage(save.error) : null;
  return {
    draft,
    set: (name: string, v: string) => { setDraft((d) => ({ ...d, [name]: v })); setSavedAt(null); },
    dirty: changed.length > 0,
    submit: () => save.mutate({ values: Object.fromEntries(changed.map((s) => [s.name, draft[s.name]!.trim()])) }),
    clear: (name: string) => save.mutate({ clear: [name] }),
    reset: () => { setDraft(initial()); save.reset(); },
    saving: save.isPending,
    savedAt,
    fieldError,
    generalError,
  };
}

function Fields({ section, specs, data, form }: { section: Section; specs: FieldSpec[]; data: InfraSection; form: ReturnType<typeof useSectionForm> }) {
  return (
    <div className="flex flex-col gap-5">
      {specs.map((s) => {
        const cur = data.fields[s.name]!;
        const id = `infra-${section}-${s.name}`;
        return (
          <Row
            key={s.name}
            id={id}
            label={s.label}
            right={<>
              <SourceTag source={cur.source} />
              {cur.source === 'saved' && <button type="button" className="text-[16px] font-semibold underline" style={{ color: T.accentText }} disabled={form.saving} onClick={() => form.clear(s.name)}>Bỏ giá trị đã lưu</button>}
            </>}
            hint={s.hint}
            error={form.fieldError(s.name)}
          >
            {s.secret
              ? <SecretInput id={id} value={form.draft[s.name]!} onChange={(v) => form.set(s.name, v)} current={cur} placeholder={s.placeholder} />
              : <TextInput id={id} value={form.draft[s.name]!} onChange={(v) => form.set(s.name, v)} placeholder={s.placeholder} mono={s.mono} />}
          </Row>
        );
      })}
    </div>
  );
}

function SaveRow({ form, updatedAt, children }: { form: ReturnType<typeof useSectionForm>; updatedAt: string | null; children?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap pt-1">
      <Button variant="primary" loading={form.saving} disabled={!form.dirty} onClick={form.submit} style={{ fontSize: 16, minHeight: 48 }}>Lưu thay đổi</Button>
      {form.dirty && <Button onClick={form.reset} style={{ fontSize: 16, minHeight: 48 }}>Hủy</Button>}
      {children}
      <span className="flex-grow" />
      {form.savedAt
        ? <span className="inline-flex items-center gap-1.5 text-[16px] font-semibold" style={{ color: T.tealText }}><CheckCircle2 size={20} /> Đã lưu, có hiệu lực ngay</span>
        : updatedAt && <span className="muted text-[16px]">Sửa lần cuối {fmtDateTime(updatedAt)}</span>}
      {form.generalError && <span className="w-full text-[16px]" style={{ color: T.accentText }}>{form.generalError}</span>}
    </div>
  );
}

// Email (Resend)

const EMAIL_FIELDS: FieldSpec[] = [
  { name: 'apiKey', label: 'API key', secret: true, placeholder: 're_xxxxxxxx', hint: 'Dán key mới để thay. Để trống là giữ nguyên key đang dùng.' },
  { name: 'from', label: 'Địa chỉ gửi', placeholder: 'Hội Mình <no-reply@hoiminh.com>', hint: 'Tên miền sau dấu @ phải được xác minh ở Resend, nếu không email sẽ bị từ chối.' },
];

interface TestEmailResult { to: string; provider: string; from: string; status: 'sent' | 'failed' | 'logged'; error?: string }

function EmailPanel({ d }: { d: Infra }) {
  const form = useSectionForm('email', d.email, EMAIL_FIELDS);
  const test = useMutation({ mutationFn: () => api.post<TestEmailResult>('/v1/admin/email/test') });
  // Đổi key hoặc địa chỉ gửi thì kết quả thử cũ không còn đúng nữa.
  const resetTest = test.reset;
  useEffect(() => resetTest(), [d.email, resetTest]);
  const r = test.data;
  const on = d.email.provider === 'Resend';
  return (
    <Panel icon={<Mail size={22} />} title="Email (Resend)" sub="Email xác minh tài khoản, mời thành viên, nhắc sự kiện, hóa đơn." status={<StatusPill ok={on}>{on ? 'Đang gửi qua Resend' : 'Chỉ ghi vào nhật ký'}</StatusPill>}>
      {!on && <div className="rounded-xl px-4 py-3 text-[16px]" style={{ background: T.goldSoft, color: T.goldText }}>Chưa có API key nên chưa ai nhận được email. Dán key vào ô bên dưới rồi bấm Lưu.</div>}
      <Fields section="email" specs={EMAIL_FIELDS} data={d.email} form={form} />
      <SaveRow form={form} updatedAt={d.email.updatedAt}>
        <Button icon={<Send size={18} />} loading={test.isPending} disabled={form.dirty} onClick={() => test.mutate()} style={{ fontSize: 16, minHeight: 48 }}>Gửi email thử</Button>
      </SaveRow>
      {(r || test.isError) && (
        <div className="rounded-xl px-4 py-3 text-[16px]" style={{ background: r?.status === 'sent' ? T.tealSoft : r?.status === 'logged' ? T.goldSoft : T.accentSoft, color: r?.status === 'sent' ? T.tealText : r?.status === 'logged' ? T.goldText : T.accentText }}>
          {test.isError && errorMessage(test.error)}
          {r?.status === 'sent' && <>Đã gửi tới <strong>{r.to}</strong>. Mở hộp thư để xem, nhớ kiểm tra cả mục Spam.</>}
          {r?.status === 'logged' && <>Chưa có API key nên email thử chỉ được ghi vào nhật ký.</>}
          {r?.status === 'failed' && <>Resend từ chối: {r.error}. Thường do tên miền trong "{r.from}" chưa xác minh, hoặc key đã bị xóa ở Resend.</>}
        </div>
      )}
      <Guide
        title="Cách lấy API key và xác minh tên miền"
        steps={[
          <>Đăng nhập <ExtLink href="https://resend.com/domains">resend.com, mục Domains</ExtLink>, bấm Add Domain, nhập <strong>hoiminh.com</strong>.</>,
          <>Resend đưa ra 3 đến 4 bản ghi DNS. Vào Cloudflare, chọn hoiminh.com, mục DNS, thêm đúng từng bản ghi (để chế độ DNS only, đám mây màu xám).</>,
          <>Quay lại Resend bấm Verify. Thường mất vài phút, có khi tới vài giờ.</>,
          <>Vào <ExtLink href="https://resend.com/api-keys">mục API Keys</ExtLink>, tạo key quyền <strong>Sending access</strong>, sao chép và dán vào ô API key ở trên.</>,
          <>Bấm Lưu thay đổi, rồi Gửi email thử để kiểm tra.</>,
        ]}
      />
    </Panel>
  );
}

// Phát hành web (Cloudflare)

const RELEASE_FIELDS: FieldSpec[] = [
  { name: 'apiToken', label: 'API token', secret: true, placeholder: 'Token có quyền Workers Scripts: Edit', hint: 'Dán token mới để thay. Để trống là giữ nguyên.' },
  { name: 'accountId', label: 'Account ID', placeholder: '32 ký tự, xem ở trang Overview của Cloudflare', hint: 'Trên Cloudflare Dashboard, mở một tên miền bất kỳ, Account ID nằm ở cột bên phải.', mono: true },
  { name: 'webScript', label: 'Tên Worker phát hành', placeholder: 'hoiminh-api', hint: 'Worker phục vụ cả web lẫn API. Thường giữ nguyên hoiminh-api.', mono: true },
];

function ReleasePanel({ d }: { d: Infra }) {
  const form = useSectionForm('release', d.release, RELEASE_FIELDS);
  const test = useMutation({ mutationFn: () => api.post<{ ok: boolean; message: string }>('/v1/admin/infra/release/test') });
  const resetTest = test.reset;
  useEffect(() => resetTest(), [d.release, resetTest]);
  return (
    <Panel icon={<Cloud size={22} />} title="Phát hành web (Cloudflare)" sub="Cho nút Cập nhật và Quay lui ở trang Phiên bản." status={<StatusPill ok={d.release.configured}>{d.release.configured ? 'Đã nối' : 'Chưa nối'}</StatusPill>}>
      <Fields section="release" specs={RELEASE_FIELDS} data={d.release} form={form} />
      <SaveRow form={form} updatedAt={d.release.updatedAt}>
        <Button icon={<PlugZap size={18} />} loading={test.isPending} disabled={form.dirty || !d.release.configured} onClick={() => test.mutate()} style={{ fontSize: 16, minHeight: 48 }}>Kiểm tra kết nối</Button>
      </SaveRow>
      {(test.data || test.isError) && (
        <div className="rounded-xl px-4 py-3 text-[16px]" style={{ background: test.data?.ok ? T.tealSoft : T.accentSoft, color: test.data?.ok ? T.tealText : T.accentText }}>
          {test.isError ? errorMessage(test.error) : test.data!.message}
        </div>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/he-thong/phien-ban" className="inline-flex items-center gap-1.5 text-[16px] font-semibold" style={{ color: T.tealText }}>Mở trang Phiên bản <ArrowRight size={18} /></Link>
      </div>
      <Guide
        title="Cách tạo token Cloudflare"
        steps={[
          <>Vào <ExtLink href="https://dash.cloudflare.com/profile/api-tokens">Cloudflare, My Profile, API Tokens</ExtLink>, bấm Create Token.</>,
          <>Chọn Create Custom Token, thêm quyền <strong>Account, Workers Scripts, Edit</strong>, chọn đúng tài khoản.</>,
          <>Tạo xong, sao chép token (chỉ hiện một lần) và dán vào ô API token ở trên, kèm Account ID.</>,
          <>Bấm Lưu thay đổi, rồi Kiểm tra kết nối.</>,
        ]}
      />
    </Panel>
  );
}

// GIF và nhãn dán động (GIPHY)

const GIF_FIELDS: FieldSpec[] = [
  { name: 'apiKey', label: 'API key GIPHY', secret: true, placeholder: 'Chuỗi 32 ký tự chữ và số', hint: 'Dán key mới để thay. Để trống là giữ nguyên.', mono: true },
];

function GifPanel({ d }: { d: Infra }) {
  const form = useSectionForm('gif', d.gif, GIF_FIELDS);
  return (
    <Panel icon={<Sticker size={22} />} title="GIF và nhãn dán động (GIPHY)" sub="Tab GIF và ô tìm nhãn dán GIPHY trong ô bình luận, ô chat." status={<StatusPill ok={d.gif.configured}>{d.gif.configured ? 'Đang bật' : 'Chưa bật'}</StatusPill>}>
      {!d.gif.configured && <div className="rounded-xl px-4 py-3 text-[16px]" style={{ background: T.goldSoft, color: T.goldText }}>Chưa có key nên tab GIF đang ẩn. Bộ nhãn dán của Hội Mình (Hệ thống · Nhãn dán) vẫn dùng bình thường.</div>}
      <Fields section="gif" specs={GIF_FIELDS} data={d.gif} form={form} />
      <SaveRow form={form} updatedAt={d.gif.updatedAt} />
      <div className="flex items-center gap-3 flex-wrap">
        <Link to="/he-thong/nhan-dan" className="inline-flex items-center gap-1.5 text-[16px] font-semibold" style={{ color: T.tealText }}>Quản lý bộ nhãn dán <ArrowRight size={18} /></Link>
      </div>
      <Guide
        title="Cách lấy API key GIPHY"
        steps={[
          <>Vào <ExtLink href="https://developers.giphy.com/dashboard/">developers.giphy.com</ExtLink>, đăng nhập (tạo tài khoản miễn phí nếu chưa có).</>,
          <>Bấm Create an API Key, chọn <strong>API</strong> (không chọn SDK), đặt tên ứng dụng là Hội Mình.</>,
          <>Sao chép key và dán vào ô ở trên, bấm Lưu thay đổi. Mở một bài viết, bấm nút GIF ở ô bình luận để thử.</>,
          <>Key mới tạo là key thử, giới hạn số lần gọi mỗi giờ. Khi nhiều người dùng, vào lại trang Dashboard bấm <strong>Upgrade to Production</strong> (miễn phí, GIPHY duyệt trong vài ngày).</>,
        ]}
      />
    </Panel>
  );
}

// Chỉ xem: R2, bí mật hệ thống, cổng thanh toán

/** Thiếu ở production là lỗi; ở máy dev thì chỉ lưu ý. */
const toneOf = (ok: boolean, env: string) => (ok ? 'ok' : env === 'production' ? 'error' : 'warn');

function StoragePanel({ d }: { d: Infra }) {
  const ok = d.storage.kind === 'r2';
  return (
    <Panel icon={<HardDrive size={22} />} title="Lưu trữ tệp (R2)" sub="Ảnh, tài liệu khóa học, tệp sản phẩm số." status={<StatusPill ok={ok}>{ok ? d.storage.label : 'Đĩa local'}</StatusPill>}>
      <div className="flex flex-col">
        <CheckLine tone={toneOf(ok, d.env)} title={`Bucket ${d.storage.bucket}`} detail={ok ? 'Nối qua binding FILES của Worker API nên không cần key. Không có gì để đổi ở đây.' : d.env === 'production' ? 'Worker API chưa có binding FILES, tải tệp sẽ lỗi. Kiểm tra [[r2_buckets]] trong apps/api/wrangler.toml.' : 'Máy dev lưu tệp trên đĩa, lên production sẽ tự dùng R2.'} />
        <CheckLine tone="ok" title="Đường dẫn ảnh công khai" detail={d.storage.publicBaseUrl ? d.storage.publicBaseUrl : 'Phát ảnh qua api.hoiminh.com. Muốn phát thẳng từ CDN thì gắn tên miền cho bucket rồi đặt R2_PUBLIC_BASE_URL.'} />
      </div>
    </Panel>
  );
}

function SecretsPanel({ d }: { d: Infra }) {
  const s = d.secrets;
  return (
    <Panel icon={<ShieldCheck size={22} />} title="Bí mật hệ thống" sub="Chỉ xem. Sai một trong các khóa này thì chính trang này cũng không mở được, nên không cho sửa trên web.">
      <div className="flex flex-col">
        <CheckLine tone={toneOf(s.database === 'postgres', d.env)} title="Kết nối database" detail={s.database === 'postgres' ? 'PostgreSQL (Supabase qua Hyperdrive).' : 'PGlite trên máy này (chỉ dùng khi phát triển).'} />
        <CheckLine tone={toneOf(s.authJwtSecret, d.env)} title="AUTH_JWT_SECRET (ký phiên đăng nhập)" detail={s.authJwtSecret ? 'Đã đặt chuỗi riêng.' : 'Đang dùng giá trị mặc định công khai: ai đọc mã nguồn cũng giả được phiên đăng nhập.'} />
        <CheckLine tone={toneOf(s.encryptionKey, d.env)} title="ENCRYPTION_KEY (mã hóa các khóa trên trang này)" detail={s.encryptionKey ? 'Đã đặt. Đổi khóa này thì các key đã lưu ở đây phải nhập lại.' : 'Chưa đặt: các key lưu ở trang này chưa được mã hóa an toàn.'} />
      </div>
      <div className="muted text-[16px]">Đổi bằng lệnh <code>wrangler secret put TÊN</code> trong thư mục apps/api, hoặc Cloudflare Dashboard, Workers, hoiminh-api, Settings, Variables and Secrets.</div>
    </Panel>
  );
}

export default function Page() {
  const q = useQuery({ queryKey: KEY, queryFn: () => api.get<Infra>('/v1/admin/infra') });
  return (
    <div className="flex flex-col gap-5 max-w-[880px]">
      <div className="flex flex-col gap-1.5">
        <h1 className="serif m-0 text-[28px] font-extrabold">Hạ tầng và khóa</h1>
        <p className="m-0 muted text-[16px] leading-relaxed">Đổi khóa dịch vụ ngay tại đây, không cần vào Cloudflare. Khóa được mã hóa khi lưu, chỉ hiện 4 ký tự cuối, và được ưu tiên hơn secret đặt trên Worker. Lưu xong là có hiệu lực, chậm nhất khoảng 30 giây.</p>
      </div>
      <QueryState q={q} rows={6}>
        {(d) => (
          <>
            <EmailPanel d={d} />
            <ReleasePanel d={d} />
            <GifPanel d={d} />
            <StoragePanel d={d} />
            <SecretsPanel d={d} />
            <Link to="/he-thong/thanh-toan" className="card flex items-center gap-3 p-5 md:p-6" style={{ color: T.ink }}>
              <span className="w-11 h-11 rounded-xl inline-flex items-center justify-center flex-shrink-0" style={{ background: T.bg }}><Wallet size={22} /></span>
              <span className="flex-grow"><span className="block text-[20px] font-bold">Khóa cổng thanh toán</span><span className="muted text-[16px]">SePay, MoMo, VNPAY, PayPal: nhập ở trang Thanh toán, bấm Cấu hình ở từng cổng.</span></span>
              <ArrowRight size={22} />
            </Link>
          </>
        )}
      </QueryState>
    </div>
  );
}
