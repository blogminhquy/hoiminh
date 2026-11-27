// Menu ba chấm cạnh mỗi bình luận. Ai cũng thấy: Chép nội dung. Người viết thấy thêm: Sửa bình luận.
// Quản trị viên thấy thêm: Ghim / Bỏ ghim (chỉ bình luận gốc). Người viết và quản trị viên thấy thêm: Xóa bình luận.
// Máy tính: nút chỉ hiện khi rê chuột vào bình luận, bảng thả ngay dưới nút (định vị theo màn hình để không bị khung
// cuộn của khung bật lên cắt mất). Điện thoại: nút luôn hiện, bảng trượt từ đáy (dùng chung kiểu menu khóa học).
import { T } from '@hoiminh/ui';
import { Copy, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

export interface CommentMenuActions {
  onCopy: () => void;
  onEdit?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
}

const MENU_WIDTH = 248;

export function CommentMenu({ authorName, pinned, actions }: { authorName: string; pinned: boolean; actions: CommentMenuActions }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<CSSProperties | undefined>();
  const btn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    // Bắt Esc ở pha capture và chặn lại: trong khung bật lên của bài viết, Esc chỉ đóng menu, không đóng luôn khung.
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    // Máy tính: bảng định vị theo vị trí nút, nên cuộn trang, cuộn khung bật lên hay đổi cỡ cửa sổ thì đóng, khỏi lơ lửng sai chỗ.
    // Điện thoại: bảng nằm ở đáy màn hình, không cần đóng; bàn phím ảo hay thanh địa chỉ ẩn hiện cũng làm đổi cỡ màn hình,
    // đóng theo thì menu vừa mở đã tắt.
    const pinned = Boolean(pos);
    if (pinned) { window.addEventListener('scroll', close, true); window.addEventListener('resize', close); }
    return () => {
      window.removeEventListener('keydown', onKey, true);
      if (pinned) { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); }
    };
  }, [open, pos]);

  const toggle = () => {
    if (open) { setOpen(false); return; }
    const r = btn.current?.getBoundingClientRect();
    // Điện thoại để CSS lo (bảng trượt từ đáy); máy tính thì thả ngay dưới nút, không tràn ra mép phải màn hình.
    if (r && window.matchMedia('(min-width: 768px)').matches) {
      const left = Math.max(8, Math.min(r.left, window.innerWidth - MENU_WIDTH - 8));
      const below = r.bottom + 6;
      setPos(below + 220 > window.innerHeight ? { position: 'fixed', left, bottom: window.innerHeight - r.top + 6, top: 'auto', right: 'auto' } : { position: 'fixed', left, top: below, right: 'auto' });
    } else setPos(undefined);
    setOpen(true);
  };
  const pick = (fn: () => void) => () => { setOpen(false); fn(); };
  const hasOwnerActions = Boolean(actions.onEdit || actions.onPin || actions.onDelete);

  return (
    <>
      <button ref={btn} type="button" className={`comment-more${open ? ' on' : ''}`} aria-label={`Tùy chọn bình luận của ${authorName}`} aria-haspopup="menu" aria-expanded={open} title="Tùy chọn bình luận" onClick={toggle}>
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <>
          <button type="button" className="course-menu-backdrop" aria-label="Đóng menu" onClick={() => setOpen(false)} />
          <div role="menu" className="course-menu" aria-label="Tùy chọn bình luận" style={pos}>
            <div className="course-menu-title">Bình luận của {authorName}</div>
            <button type="button" role="menuitem" onClick={pick(actions.onCopy)}><Copy size={18} />Chép nội dung</button>
            {hasOwnerActions && <div className="course-menu-sep" />}
            {actions.onEdit && <button type="button" role="menuitem" onClick={pick(actions.onEdit)}><Pencil size={18} />Sửa bình luận</button>}
            {actions.onPin && <button type="button" role="menuitem" onClick={pick(actions.onPin)}>{pinned ? <><PinOff size={18} />Bỏ ghim</> : <><Pin size={18} />Ghim bình luận</>}</button>}
            {actions.onDelete && <button type="button" role="menuitem" style={{ color: T.accentText }} onClick={pick(actions.onDelete)}><Trash2 size={18} />Xóa bình luận</button>}
          </div>
        </>
      )}
    </>
  );
}
