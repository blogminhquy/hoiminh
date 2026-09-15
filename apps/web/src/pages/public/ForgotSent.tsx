// Đã gửi link đặt lại (forgotSentBody trong build.mjs): hộp thư minh họa, gửi lại sau 60 giây.
import { useMutation } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { MailOpen } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/layouts/AuthShell';
import { api, errorMessage } from '@/lib/api';
import { fmtCountdown, useCountdown } from './AuthParts';

export default function Page() {
  const [params] = useSearchParams();
  const email = params.get('email') ?? '';
  const { left, restart } = useCountdown(60);
  const resend = useMutation({ mutationFn: () => api.post<{ ok: boolean }>('/v1/auth/forgot-password', { email }), onSuccess: restart });

  return (
    <AuthShell>
      <div className="flex flex-col gap-5 items-center text-center">
        <span className="inline-flex items-center justify-center rounded-full" style={{ width: 72, height: 72, background: T.tealSoft, color: T.tealText }}><MailOpen size={32} /></span>
        <div>
          <h2 className="serif m-0 mb-2 text-[30px] font-extrabold">Kiểm tra hộp thư</h2>
          <div className="muted leading-[1.6]">Chúng tôi đã gửi link đặt lại mật khẩu tới<br /><strong style={{ color: T.ink }}>{email || 'email của bạn'}</strong></div>
        </div>
        <div className="w-full rounded-[14px] flex flex-col gap-2.5 text-left" style={{ padding: '16px 18px', border: `1px solid ${T.line}`, background: T.surface }}>
          <div className="flex items-center gap-2.5">
            <span className="serif inline-flex items-center justify-center font-extrabold text-[12px] rounded-lg" style={{ width: 32, height: 32, background: T.accent, color: T.surface }}>HM</span>
            <div><div className="font-semibold text-[13px]">Hội Mình</div><div className="muted text-[12px]">Đặt lại mật khẩu cho tài khoản của bạn</div></div>
            <span className="muted text-[12px] ml-auto">vừa xong</span>
          </div>
          <div className="text-[13px]" style={{ color: T.ink2 }}>Bấm nút trong email để đặt mật khẩu mới. Link hết hạn sau 30 phút.</div>
          <span className="btn btn-dark btn-sm self-start" aria-hidden="true">Đặt mật khẩu mới</span>
        </div>
        <div className="muted text-[13px]">
          Không thấy email? Kiểm tra mục Spam hoặc{' '}
          {left > 0 ? (
            <>gửi lại sau <strong style={{ color: T.ink }}>{fmtCountdown(left)}</strong></>
          ) : (
            <button type="button" className="font-semibold" style={{ color: T.teal }} disabled={resend.isPending || !email} onClick={() => resend.mutate()}>{resend.isPending ? 'đang gửi…' : 'gửi lại'}</button>
          )}
          {resend.isError && <div style={{ color: T.accentText }}>{errorMessage(resend.error)}</div>}
        </div>
        <Link to="/dang-nhap" className="text-[13px] font-semibold" style={{ color: T.teal }}>Về đăng nhập</Link>
      </div>
    </AuthShell>
  );
}
