// Menu ba chấm ở góc trên bên phải thẻ khóa học (chỉ người quản lý khóa thấy): cài đặt, soạn nội dung, xem trang khóa,
// đăng / gỡ về nháp, chuyển lên trước / ra sau, giới thiệu khóa học (khi hội bật affiliate), nhân bản, chép link, xóa. Máy tính: bảng thả dưới nút. Điện thoại: bảng trượt từ đáy.
import { T } from '@hoiminh/ui';
import { ArrowLeft, ArrowRight, Check, Copy, Eye, EyeOff, Gift, Link2, ListVideo, MoreHorizontal, Settings, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export interface CourseMenuActions {
  /** dir -1: lên trước (sang trái), 1: ra sau (sang phải). */
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onPublish: (status: 'published' | 'draft') => void;
  onCopyLink: () => void;
  /** Mở bảng chia sẻ khóa học. Không có khi khóa không chia sẻ được (nháp, hội chưa bật affiliate). */
  onShare?: () => void;
  onDelete: () => void;
}

export function CourseMenu({ title, status, to, canMovePrev, canMoveNext, busy, actions }: { title: string; status: 'draft' | 'published' | 'archived'; to: string; canMovePrev: boolean; canMoveNext: boolean; busy: boolean; actions: CourseMenuActions }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  return (
    <>
      <button type="button" className={`course-more${open ? ' on' : ''}`} aria-label={`Quản lý khóa ${title}`} aria-haspopup="menu" aria-expanded={open} title="Quản lý khóa học" onClick={() => setOpen((v) => !v)}><MoreHorizontal size={22} /></button>
      {open && (
        <>
          <button type="button" className="course-menu-backdrop" aria-label="Đóng menu" onClick={() => setOpen(false)} />
          <div role="menu" className="course-menu" aria-label={`Quản lý khóa ${title}`}>
            <div className="course-menu-title">{title}</div>
            <Link role="menuitem" to={`${to}/sua`}><Settings size={18} />Cài đặt khóa học</Link>
            <Link role="menuitem" to={`${to}/soan`}><ListVideo size={18} />Soạn bài học</Link>
            <Link role="menuitem" to={to}><Eye size={18} />Xem trang khóa học</Link>
            {status === 'published'
              ? <button type="button" role="menuitem" disabled={busy} onClick={pick(() => actions.onPublish('draft'))}><EyeOff size={18} />Gỡ về nháp</button>
              : <button type="button" role="menuitem" disabled={busy} onClick={pick(() => actions.onPublish('published'))}><Check size={18} />Đăng khóa học</button>}
            {actions.onShare && (
              <>
                <div className="course-menu-sep" />
                <button type="button" role="menuitem" onClick={pick(actions.onShare)}><Gift size={18} style={{ color: T.moneyText }} />Giới thiệu khóa học</button>
              </>
            )}
            <div className="course-menu-sep" />
            <button type="button" role="menuitem" disabled={busy || !canMovePrev} onClick={pick(() => actions.onMove(-1))}><ArrowLeft size={18} />Chuyển lên trước</button>
            <button type="button" role="menuitem" disabled={busy || !canMoveNext} onClick={pick(() => actions.onMove(1))}><ArrowRight size={18} />Chuyển ra sau</button>
            <div className="course-menu-sep" />
            <button type="button" role="menuitem" disabled={busy} onClick={pick(actions.onDuplicate)}><Copy size={18} />Nhân bản khóa học</button>
            <button type="button" role="menuitem" onClick={pick(actions.onCopyLink)}><Link2 size={18} />Chép link khóa học</button>
            <div className="course-menu-sep" />
            <button type="button" role="menuitem" disabled={busy} style={{ color: T.accentText }} onClick={pick(actions.onDelete)}><Trash2 size={18} />Xóa khóa học</button>
          </div>
        </>
      )}
    </>
  );
}
