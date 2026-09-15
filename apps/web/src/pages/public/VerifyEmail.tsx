// Xác minh email (verifyBody trong build.mjs): 6 ô OTP tự nhảy, dán được; gửi lại mã sau 60 giây; vào hội ngay.
import type { AuthUser } from '@hoiminh/contracts';
import { useMutation } from '@tanstack/react-query';
import { Button, T } from '@hoiminh/ui';
import { Clock, Mail } from 'lucide-react';
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/layouts/AuthShell';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { FormError, fmtCountdown, useCountdown } from './AuthParts';

const LEN = 6;

function OtpInput({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: LEN }, (_, i) => value[i] ?? '');
  const focus = (i: number) => refs.current[Math.max(0, Math.min(LEN - 1, i))]?.focus();
  const setAt = (i: number, d: string) => {
    const next = digits.slice();
    next[i] = d;
    onChange(next.join(''));
  };
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      if (digits[i]) setAt(i, '');
      else { setAt(i - 1, ''); focus(i - 1); }
    } else if (e.key === 'ArrowLeft') focus(i - 1);
    else if (e.key === 'ArrowRight') focus(i + 1);
  };
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LEN);
    if (!text) return;
    e.preventDefault();
    onChange(text);
    focus(text.length);
  };
  return (
    <div className="flex gap-2.5 justify-center">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric"
          pattern="\d*"
          maxLength={1}
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`Số thứ ${i + 1}`}
          value={d}
          disabled={disabled}
          onPaste={onPaste}
          onKeyDown={(e) => onKey(i, e)}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (!v) { setAt(i, ''); return; }
            if (v.length > 1) { onChange((value.slice(0, i) + v).slice(0, LEN)); focus(i + v.length); return; }
            setAt(i, v);
            focus(i + 1);
          }}
          className="serif text-center font-extrabold outline-none"
          style={{ width: 48, height: 60, borderRadius: 12, border: `1.5px solid ${d ? T.ink : T.line2}`, background: T.surface, fontSize: 24, color: T.ink }}
        />
      ))}
    </div>
  );
}

export default function Page() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading, refresh } = useAuth();
  const next = params.get('next');
  const target = next && next.startsWith('/') ? next : '/admin/tao-hoi';
  const [code, setCode] = useState('');
  const { left, restart } = useCountdown(60);

  const verify = useMutation({
    mutationFn: () => api.post<AuthUser>('/v1/auth/verify-email', { code }),
    onSuccess: async () => {
      await refresh();
      navigate(target, { replace: true });
    },
  });
  const resend = useMutation({ mutationFn: () => api.post<{ ok: boolean }>('/v1/auth/resend-verification'), onSuccess: restart });

  useEffect(() => {
    if (code.length === LEN && !verify.isPending) verify.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!loading && !user) {
    return (
      <AuthShell>
        <div className="flex flex-col gap-4 items-center text-center">
          <h2 className="serif m-0 text-[30px] font-extrabold">Xác minh email</h2>
          <div className="muted">Bạn cần đăng nhập trước khi xác minh email.</div>
          <Link to={`/dang-nhap?next=${encodeURIComponent(`/xac-minh-email${next ? `?next=${next}` : ''}`)}`} className="btn btn-primary">Đăng nhập</Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="flex flex-col gap-5 items-center text-center">
        <span className="inline-flex items-center justify-center rounded-full" style={{ width: 72, height: 72, background: T.goldSoft, color: T.goldText }}><Mail size={32} /></span>
        <div>
          <h2 className="serif m-0 mb-2 text-[30px] font-extrabold">Xác minh email</h2>
          <div className="muted leading-[1.6]">Nhập mã 6 số vừa gửi tới<br /><strong style={{ color: T.ink }}>{user?.email ?? '…'}</strong> <Link to="/tai-khoan/ho-so" className="font-semibold">(đổi)</Link></div>
        </div>
        <OtpInput value={code} onChange={(v) => { setCode(v); verify.reset(); }} disabled={verify.isPending} />
        <FormError error={verify.error} />
        <Button variant="primary" block loading={verify.isPending} disabled={code.length !== LEN} onClick={() => verify.mutate()} style={{ height: 48, fontSize: 15, borderRadius: 12 }}>Xác minh</Button>
        <div className="muted text-[13px]">
          Chưa nhận được?{' '}
          {left > 0 ? (
            <>Gửi lại mã sau <strong style={{ color: T.ink }}>{fmtCountdown(left)}</strong></>
          ) : (
            <button type="button" className="font-semibold" style={{ color: T.teal }} disabled={resend.isPending} onClick={() => resend.mutate()}>{resend.isPending ? 'Đang gửi…' : 'Gửi lại mã'}</button>
          )}
          {' '}· hoặc bấm link trong email
          {resend.isError && <div style={{ color: T.accentText }}>{errorMessage(resend.error)}</div>}
          {resend.isSuccess && left > 0 && <div style={{ color: T.tealText }}>Đã gửi mã mới</div>}
        </div>
        <div className="w-full rounded-[12px] text-[13px] flex gap-2.5 items-start text-left" style={{ padding: '14px 16px', background: T.bg, color: T.ink2 }}>
          <span className="flex-shrink-0" style={{ color: T.ink3 }}><Clock size={16} /></span>
          <span>Bạn có thể <Link to={target} className="font-semibold">vào hội ngay</Link> và xác minh sau. Sau 7 ngày chưa xác minh, tài khoản sẽ bị giới hạn đăng bài và thanh toán.</span>
        </div>
      </div>
    </AuthShell>
  );
}
