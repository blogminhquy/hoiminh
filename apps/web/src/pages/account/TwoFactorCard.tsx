// Xác thực hai lớp trong Tài khoản: bật (quét mã, nhập mã xác nhận, nhận mã dự phòng),
// sinh lại mã dự phòng, tắt (nhập lại mật khẩu).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input, T, Tag } from '@hoiminh/ui';
import { Check, Copy, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';

interface Status { enabled: boolean; confirmedAt: string | null; backupCodesLeft: number }
type Step = 'idle' | 'setup' | 'codes' | 'disable';

/** Bí mật chia nhóm 4 ký tự cho dễ gõ tay khi không quét được mã. */
function grouped(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim();
}

function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      setCopied(true);
    } catch { /* trình duyệt chặn clipboard: người dùng vẫn chép tay được */ }
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="text-[13px]">Lưu 10 mã dự phòng này ở nơi an toàn. Mỗi mã dùng được một lần khi bạn không mở được ứng dụng xác thực. <strong>Đóng rồi sẽ không xem lại được.</strong></div>
      <div className="grid grid-cols-2 gap-1.5 p-3 rounded-xl font-mono text-[13px]" style={{ background: T.bg }}>
        {codes.map((c) => <span key={c}>{c}</span>)}
      </div>
      <div className="flex gap-2">
        <Button size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copy()}>{copied ? 'Đã sao chép' : 'Sao chép'}</Button>
        <Button size="sm" variant="dark" onClick={onDone}>Tôi đã lưu</Button>
      </div>
    </div>
  );
}

export function TwoFactorCard() {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('idle');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [setup, setSetup] = useState<{ secret: string; uri: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);

  const q = useQuery({ queryKey: ['2fa'], queryFn: () => api.get<Status>('/v1/me/2fa') });
  const reset = () => { setStep('idle'); setCode(''); setPassword(''); setSetup(null); setCodes([]); };
  const refresh = () => qc.invalidateQueries({ queryKey: ['2fa'] });

  const start = useMutation({
    mutationFn: () => api.post<{ secret: string; uri: string }>('/v1/me/2fa/start'),
    onSuccess: (d) => { setSetup(d); setStep('setup'); },
  });
  const confirm = useMutation({
    mutationFn: () => api.post<{ backupCodes: string[] }>('/v1/me/2fa/confirm', { code: code.trim() }),
    onSuccess: (d) => { setCodes(d.backupCodes); setStep('codes'); setCode(''); void refresh(); },
  });
  const regen = useMutation({
    mutationFn: () => api.post<{ backupCodes: string[] }>('/v1/me/2fa/backup-codes', { code: code.trim() }),
    onSuccess: (d) => { setCodes(d.backupCodes); setStep('codes'); setCode(''); void refresh(); },
  });
  const disable = useMutation({
    mutationFn: () => api.post('/v1/me/2fa/disable', { password }),
    onSuccess: () => { reset(); void refresh(); },
  });

  const status = q.data;
  return (
    <div className="flex items-start gap-3 text-[14px] flex-wrap">
      <span className="muted" style={{ width: 130 }}>Xác thực hai lớp</span>
      <div className="flex flex-col gap-3 flex-grow" style={{ minWidth: 260 }}>
        {step === 'idle' && (
          <div className="flex items-center gap-2.5 flex-wrap">
            {status?.enabled
              ? <><Tag tone="teal"><ShieldCheck size={12} />Đang bật</Tag><span className="muted text-[13px]">còn {status.backupCodesLeft} mã dự phòng</span><button type="button" className="text-[13px] font-semibold" onClick={() => setStep('setup')}>Sinh lại mã dự phòng</button><button type="button" className="text-[13px] font-semibold" style={{ color: T.accentText }} onClick={() => setStep('disable')}>Tắt</button></>
              : <><span className="muted text-[13px]">Thêm một lớp bảo vệ: mỗi lần đăng nhập cần thêm mã 6 số từ ứng dụng.</span><Button size="sm" loading={start.isPending} onClick={() => start.mutate()}>Bật</Button></>}
          </div>
        )}

        {step === 'setup' && status?.enabled && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px]">Nhập mã hiện tại trong ứng dụng để nhận bộ mã dự phòng mới. Bộ mã cũ sẽ hết hiệu lực.</span>
            <div className="flex gap-2 flex-wrap"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" style={{ width: 140 }} /><Button size="sm" variant="dark" loading={regen.isPending} disabled={code.trim().length < 6} onClick={() => regen.mutate()}>Sinh lại</Button><Button size="sm" onClick={reset}>Hủy</Button></div>
            {regen.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(regen.error)}</span>}
          </div>
        )}

        {step === 'setup' && !status?.enabled && setup && (
          <div className="flex flex-col gap-2.5">
            <span className="text-[13px]">Mở ứng dụng xác thực (Google Authenticator, Microsoft Authenticator, 1Password…) và thêm tài khoản bằng khóa dưới đây.</span>
            <div className="p-3 rounded-xl flex flex-col gap-1" style={{ background: T.bg }}>
              <span className="muted text-[12px]">Khóa thiết lập</span>
              <code className="font-mono text-[15px] tracking-wide break-all">{grouped(setup.secret)}</code>
            </div>
            <span className="muted text-[12px]">Ứng dụng nào mở được link thì dán: <span className="break-all">{setup.uri}</span></span>
            <div className="flex gap-2 flex-wrap items-center">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Mã 6 số" style={{ width: 140 }} />
              <Button size="sm" variant="dark" loading={confirm.isPending} disabled={code.trim().length < 6} onClick={() => confirm.mutate()}>Xác nhận bật</Button>
              <Button size="sm" onClick={reset}>Hủy</Button>
            </div>
            {confirm.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(confirm.error)}</span>}
          </div>
        )}

        {step === 'codes' && <BackupCodes codes={codes} onDone={reset} />}

        {step === 'disable' && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px]">Nhập mật khẩu để tắt xác thực hai lớp.</span>
            <div className="flex gap-2 flex-wrap"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu hiện tại" style={{ width: 200 }} /><Button size="sm" loading={disable.isPending} disabled={!password} style={{ color: T.accentText }} onClick={() => disable.mutate()}>Tắt</Button><Button size="sm" onClick={reset}>Hủy</Button></div>
            {disable.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(disable.error)}</span>}
          </div>
        )}

        {start.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(start.error)}</span>}
      </div>
    </div>
  );
}
