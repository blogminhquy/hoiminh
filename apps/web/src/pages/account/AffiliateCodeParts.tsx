// Mảnh trang Affiliate: đặt mã giới thiệu chung. Một người có một mã dùng cho link của mọi chương trình (nền tảng và
// từng hội), không trùng với ai, và chỉ đặt được MỘT lần, nên bảng này bắt xác nhận trước khi lưu.
import { REFERRAL_CODE_PATTERN } from '@hoiminh/contracts';
import { useMutation } from '@tanstack/react-query';
import { Button, Modal, T } from '@hoiminh/ui';
import { useState } from 'react';
import { cleanCodeInput } from '@/lib/affiliate-link';
import { api, errorMessage } from '@/lib/api';
import { SITE_HOST } from '@/lib/site';

export function ReferralCodeModal({ open, currentCode, onClose, onSaved }: { open: boolean; currentCode: string; onClose: () => void; onSaved: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [sure, setSure] = useState(false);
  const save = useMutation({
    mutationFn: () => api.put<{ code: string }>('/v1/me/referral-code', { code }),
    onSuccess: (r) => onSaved(r.code),
  });
  const valid = REFERRAL_CODE_PATTERN.test(code);
  const close = () => { save.reset(); onClose(); };
  return (
    <Modal open={open} onClose={close} title="Đổi mã giới thiệu" width={520} footer={(
      <div className="flex gap-2 px-5 py-4 justify-end" style={{ borderTop: `1px solid ${T.line}` }}>
        <Button onClick={close}>Hủy</Button>
        <Button variant="primary" loading={save.isPending} disabled={!valid || !sure || code === currentCode} onClick={() => save.mutate()}>Lưu mã</Button>
      </div>
    )}>
      <div className="p-5 flex flex-col gap-4">
        <div className="text-[15px] leading-[1.55]" style={{ color: T.ink2 }}>Bạn chọn <b style={{ color: T.ink }}>một mã</b> dùng cho mọi link giới thiệu của mình: link Hội Mình và link của mọi hội bạn làm affiliate.</div>
        <label className="flex flex-col gap-1.5">
          <span className="font-semibold text-[15px]">Mã mới</span>
          <span className="input" style={{ height: 50 }}>
            <input value={code} onChange={(e) => { setCode(cleanCodeInput(e.target.value)); save.reset(); }} placeholder="ví dụ: minhquy" aria-label="Mã giới thiệu mới" autoCapitalize="none" autoCorrect="off" spellCheck={false} maxLength={40} className="text-[16px] font-semibold" />
          </span>
          <span className="text-[14px]" style={{ color: code && !valid ? T.accentText : T.ink3 }}>3 đến 20 ký tự, chỉ dùng chữ không dấu và số. Không trùng với mã của người khác.</span>
        </label>
        {valid && <div className="text-[14px]" style={{ color: T.ink2, wordBreak: 'break-all' }}>Link của bạn sẽ có dạng <b style={{ color: T.primaryText }}>{SITE_HOST}/?ref={code}</b></div>}
        <div className="rounded-[12px] flex flex-col gap-1.5 text-[14px] leading-[1.5]" style={{ padding: '12px 14px', background: T.goldSoft, color: T.ink }}>
          <div><b>Chỉ đổi được một lần.</b> Lưu xong thì mã không sửa lại được nữa, bạn kiểm tra kỹ trước khi lưu.</div>
          <div>Link cũ với mã <b>{currentCode}</b> vẫn chạy và vẫn tính hoa hồng cho bạn.</div>
        </div>
        <label className="flex items-start gap-2.5 text-[15px] cursor-pointer" style={{ minHeight: 44 }}>
          <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-1" style={{ width: 18, height: 18 }} />
          <span>Tôi hiểu mã này chỉ đổi được một lần.</span>
        </label>
        {save.isError && <div role="alert" className="text-[14px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</div>}
      </div>
    </Modal>
  );
}
