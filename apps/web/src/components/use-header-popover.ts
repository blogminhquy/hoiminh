// Cách mở và đóng bảng nổi ở đầu trang, dùng chung cho nút chuông Thông báo và nút Tin nhắn để hai bảng hành xử như nhau:
// mở thì đưa tiêu điểm vào bảng; bấm ra ngoài, nhấn Esc hay chuyển trang thì đóng; điện thoại (bảng trượt từ đáy lên,
// phủ gần hết màn hình) thì khóa cuộn trang phía sau. Mở bảng này thì bảng kia tự đóng, vì bấm nút này là bấm ra ngoài bảng kia.
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

export function useHeaderPopover() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  /** Khung bọc cả nút lẫn bảng: bấm trong khung không tính là bấm ra ngoài. */
  const wrap = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  /** Đóng bảng. `toTrigger` trả tiêu điểm về nút (đóng bằng nút X), để bàn phím không bị rơi về đầu trang. */
  const close = (toTrigger = false) => { setOpen(false); if (toTrigger) trigger.current?.focus(); };

  // Chuyển trang (kể cả bấm một dòng trong bảng) thì đóng bảng.
  useEffect(() => { setOpen(false); }, [location.key]);

  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    const sheet = window.matchMedia('(max-width: 767px)').matches;
    const prev = document.body.style.overflow;
    if (sheet) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
      if (sheet) document.body.style.overflow = prev;
    };
  }, [open]);

  return { open, setOpen, close, wrap, trigger, panel };
}
