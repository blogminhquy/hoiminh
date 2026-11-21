// Cài đặt · Chung: chọn hội kín hay hội mở. Hai thẻ lớn đặt cạnh nhau (điện thoại: xếp chồng), chạm một lần là chọn;
// lựa chọn được lưu cùng nút Lưu của trang như các ô khác.
import type { CommunityVisibility } from '@hoiminh/contracts';
import { Radio, T } from '@hoiminh/ui';
import { Globe, Lock } from 'lucide-react';

const OPTIONS: Array<{ key: CommunityVisibility; icon: typeof Lock; title: string; desc: string }> = [
  { key: 'private', icon: Lock, title: 'Hội kín', desc: 'Chỉ thành viên xem được bên trong hội.' },
  { key: 'public', icon: Globe, title: 'Hội mở', desc: 'Ai cũng xem được bên trong. Chỉ thành viên mới đăng bài, bình luận và học.' },
];

export function VisibilityPicker({ value, onChange }: { value: CommunityVisibility; onChange: (v: CommunityVisibility) => void }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div role="radiogroup" aria-label="Ai xem được bên trong hội" className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        {OPTIONS.map(({ key, icon: Icon, title, desc }) => {
          const on = value === key;
          return (
            <button key={key} type="button" role="radio" aria-checked={on} onClick={() => onChange(key)} className="flex items-start gap-3 text-left rounded-[12px] p-4 min-h-[76px]" style={{ border: `1.5px solid ${on ? T.primary : T.line2}`, background: on ? T.primarySoft : T.surface }}>
              <span className="pt-0.5 flex-shrink-0"><Radio on={on} /></span>
              <span className="flex flex-col gap-1 min-w-0">
                <span className="flex items-center gap-2 font-semibold text-[16px]" style={{ color: T.ink }}><Icon size={18} />{title}</span>
                <span className="text-[14px] leading-[1.5]" style={{ color: T.ink2 }}>{desc}</span>
              </span>
            </button>
          );
        })}
      </div>
      <span className="muted text-[13px] leading-[1.5]">
        {value === 'public'
          ? 'Người chưa vào hội (kể cả chưa đăng nhập) xem được bảng tin, bình luận, danh sách khóa học, sự kiện và danh sách thành viên. Bài học, bản ghi sự kiện và bảng xếp hạng vẫn chỉ dành cho thành viên.'
          : 'Người chưa vào hội chỉ thấy trang giới thiệu. Muốn xem bài viết, khóa học, sự kiện, thành viên thì phải tham gia hội.'}
      </span>
    </div>
  );
}
