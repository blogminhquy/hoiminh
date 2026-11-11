// Kéo thả để đổi thứ tự các ô trong một lưới, dùng được bằng chuột lẫn ngón tay.
//   - Chuột: nhấn rồi kéo quá vài pixel là bắt đầu.
//   - Cảm ứng: nhấn giữ một nhịp ngắn rồi mới kéo, để vuốt cuộn trang bình thường không bị hiểu nhầm là kéo ô.
// Thứ tự trong DOM không đổi trong lúc kéo (ô chỉ đổi chỗ bằng CSS `order`), nên phần tử đang được giữ không bị gỡ ra giữa chừng.
import { useCallback, useEffect, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';

/** Ngón tay phải giữ yên chừng này mới tính là kéo. */
export const TOUCH_HOLD_MS = 220;
const TOUCH_SLOP = 8;
const MOUSE_SLOP = 5;
/** Con trỏ ra xa lưới quá mức này thì coi như bỏ, thả ra ô về chỗ cũ. */
const OUTSIDE = 56;

export interface DragState {
  /** Vị trí ban đầu của ô đang kéo. */
  from: number;
  /** Vị trí ô sẽ nằm nếu thả ngay lúc này. */
  over: number;
  /** Tọa độ con trỏ trên màn hình, để vẽ bản sao đi theo tay. */
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Live { pointerId: number; from: number; over: number; startX: number; startY: number; x: number; y: number; touch: boolean; active: boolean; rects: DOMRect[]; timer: ReturnType<typeof setTimeout> | null }

/** Vị trí mới của ô `i` khi ô `from` được đưa tới `to`. */
export function positionAfterMove(i: number, from: number, to: number): number {
  if (i === from) return to;
  if (from < to && i > from && i <= to) return i - 1;
  if (from > to && i >= to && i < from) return i + 1;
  return i;
}

/** Danh sách sau khi đưa phần tử ở `from` tới `to`. */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  if (item !== undefined) next.splice(to, 0, item);
  return next;
}

/** Ô gần con trỏ nhất; trả về null khi con trỏ đã ra xa hẳn khỏi lưới. */
export function slotAt(rects: ReadonlyArray<Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom'>>, x: number, y: number): number | null {
  if (!rects.length) return null;
  const left = Math.min(...rects.map((r) => r.left));
  const right = Math.max(...rects.map((r) => r.right));
  const top = Math.min(...rects.map((r) => r.top));
  const bottom = Math.max(...rects.map((r) => r.bottom));
  if (x < left - OUTSIDE || x > right + OUTSIDE || y < top - OUTSIDE || y > bottom + OUTSIDE) return null;
  let best = 0;
  let bestDist = Infinity;
  rects.forEach((r, i) => {
    const d = Math.hypot(x - (r.left + r.right) / 2, y - (r.top + r.bottom) / 2);
    if (d < bestDist) { bestDist = d; best = i; }
  });
  return best;
}

export function useDragSort({ count, disabled, onDrop }: { count: number; disabled?: boolean; onDrop: (from: number, to: number) => void }) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const items = useRef<Array<HTMLElement | null>>([]);
  const container = useRef<HTMLDivElement | null>(null);
  const live = useRef<Live | null>(null);
  /** Vừa kéo xong thì lượt click đi kèm không được tính là bấm chọn. */
  const dragged = useRef(false);
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  const countRef = useRef(count);
  countRef.current = count;

  const stop = useCallback(() => {
    const l = live.current;
    if (l?.timer) clearTimeout(l.timer);
    live.current = null;
    setDrag(null);
  }, []);

  const activate = useCallback(() => {
    const l = live.current;
    if (!l || l.active) return;
    const rects = items.current.slice(0, countRef.current).map((el) => el?.getBoundingClientRect());
    const own = rects[l.from];
    if (!own || rects.some((r) => !r)) { stop(); return; }
    l.active = true;
    l.rects = rects as DOMRect[];
    if (l.touch) navigator.vibrate?.(10);
    setDrag({ from: l.from, over: l.from, x: l.x, y: l.y, width: own.width, height: own.height });
  }, [stop]);

  // Trong lúc kéo bằng ngón tay, chặn trang cuộn theo. Phải gắn trực tiếp (không qua React) để được phép chặn.
  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const block = (e: TouchEvent) => { if (live.current?.active && e.cancelable) e.preventDefault(); };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  });

  useEffect(() => () => { if (live.current?.timer) clearTimeout(live.current.timer); }, []);

  const onPointerDown = (i: number) => (e: ReactPointerEvent<HTMLElement>) => {
    if (disabled || count < 2 || live.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const touch = e.pointerType !== 'mouse';
    live.current = { pointerId: e.pointerId, from: i, over: i, startX: e.clientX, startY: e.clientY, x: e.clientX, y: e.clientY, touch, active: false, rects: [], timer: touch ? setTimeout(activate, TOUCH_HOLD_MS) : null };
    dragged.current = false;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* trình duyệt không cho giữ con trỏ thì vẫn kéo được trong phạm vi ô */ }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const l = live.current;
    if (!l || l.pointerId !== e.pointerId) return;
    l.x = e.clientX;
    l.y = e.clientY;
    if (!l.active) {
      const moved = Math.hypot(e.clientX - l.startX, e.clientY - l.startY);
      // Ngón tay di chuyển trước khi giữ đủ lâu là đang cuộn trang, không phải kéo ô.
      if (l.touch) { if (moved > TOUCH_SLOP) stop(); return; }
      if (moved <= MOUSE_SLOP) return;
      activate();
      if (!l.active) return;
    }
    const over = slotAt(l.rects, e.clientX, e.clientY) ?? l.from;
    l.over = over;
    setDrag((d) => (d ? { ...d, over, x: e.clientX, y: e.clientY } : d));
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLElement>) => {
    const l = live.current;
    if (!l || l.pointerId !== e.pointerId) return;
    const { active, from, over } = l;
    stop();
    if (!active) return;
    dragged.current = true;
    setTimeout(() => { dragged.current = false; }, 80);
    if (over !== from) dropRef.current(from, over);
  };

  const onPointerCancel = (e: ReactPointerEvent<HTMLElement>) => {
    if (live.current?.pointerId === e.pointerId) stop();
  };

  /** Gắn vào từng ô. `i` là vị trí của ô trong danh sách (cũng là thứ tự trong DOM). */
  const itemProps = (i: number) => ({
    ref: (el: HTMLElement | null) => { items.current[i] = el; },
    onPointerDown: onPointerDown(i),
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onContextMenu: (e: ReactMouseEvent) => { if (live.current) e.preventDefault(); },
    draggable: false,
  });

  /** Kiểu dáng của ô `i`: chỗ đứng theo thứ tự đang xem trước, và không cho trình duyệt bôi chọn hay bật menu khi nhấn giữ. */
  const itemStyle = (i: number): CSSProperties => ({
    order: drag ? positionAfterMove(i, drag.from, drag.over) : i,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTouchCallout: 'none',
    cursor: disabled || count < 2 ? undefined : drag ? 'grabbing' : 'grab',
  });

  return { drag, container, itemProps, itemStyle, /** true ngay sau một lượt kéo: bỏ qua lượt click đi kèm. */ wasDragged: () => dragged.current };
}
