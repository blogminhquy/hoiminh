// Cảm xúc kiểu Facebook cho bài viết và bình luận: bấm là Thích (bấm lần nữa là gỡ), rê chuột hoặc nhấn giữ thì bật
// thanh sáu cảm xúc để chọn. Mỗi người một cảm xúc cho mỗi bài; chọn loại khác là đổi, không cộng thêm.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { api } from '@/lib/api';

export type ReactionKind = 'like' | 'love' | 'haha' | 'wow' | 'sad' | 'angry';
export const REACTIONS: Array<{ kind: ReactionKind; emoji: string; label: string; color: string }> = [
  { kind: 'like', emoji: '👍', label: 'Thích', color: T.primaryText },
  { kind: 'love', emoji: '❤️', label: 'Yêu thích', color: '#C81E4A' },
  { kind: 'haha', emoji: '😆', label: 'Haha', color: T.goldText },
  { kind: 'wow', emoji: '😮', label: 'Wow', color: T.goldText },
  { kind: 'sad', emoji: '😢', label: 'Buồn', color: T.goldText },
  { kind: 'angry', emoji: '😡', label: 'Phẫn nộ', color: T.accentText },
];
const byKind = (kind: string | null | undefined) => REACTIONS.find((r) => r.kind === kind) ?? null;

/** Thả, đổi hoặc gỡ cảm xúc. Gửi đúng loại đang thả thì máy chủ gỡ; gửi loại khác thì đổi. */
export function useReact(targetType: 'post' | 'comment') {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { targetId: string; reaction: ReactionKind }) => api.post<{ liked: boolean; reaction: ReactionKind | null; likeCount: number }>('/v1/reactions/toggle', { targetType, targetId: v.targetId, reaction: v.reaction }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['feed'] }); void qc.invalidateQueries({ queryKey: ['post'] }); void qc.invalidateQueries({ queryKey: ['comments'] }); },
  });
}

/** Ba cảm xúc nhiều nhất xếp chồng cạnh tổng số, như dòng đếm dưới bài viết của Facebook. */
export function ReactionSummary({ counts, total, size = 20, showTotal = true }: { counts?: Record<string, number> | null; total: number; size?: number; showTotal?: boolean }) {
  if (total <= 0) return null;
  const top = Object.entries(counts ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k]) => byKind(k)).filter((r): r is (typeof REACTIONS)[number] => Boolean(r));
  // Lượt thích cũ (trước khi có sáu loại) không có dòng chi tiết: coi là Thích.
  const shown = top.length ? top : [REACTIONS[0]!];
  const label = `${total} lượt cảm xúc: ${shown.map((r) => r.label).join(', ')}`;
  return (
    <span className="inline-flex items-center gap-1.5" role="img" aria-label={label} title={label}>
      <span className="inline-flex">
        {shown.map((r, i) => (
          <span key={r.kind} className="inline-flex items-center justify-center rounded-full" style={{ width: size, height: size, fontSize: size * 0.62, lineHeight: 1, marginLeft: i ? -5 : 0, background: T.surface, border: `1px solid ${T.line}`, zIndex: 3 - i }}>{r.emoji}</span>
        ))}
      </span>
      {showTotal && <span className="text-[14px]" style={{ color: T.ink2 }}>{total}</span>}
    </span>
  );
}

const noCallout: CSSProperties = { WebkitTouchCallout: 'none', userSelect: 'none' };

/**
 * Nút cảm xúc. `variant="bar"`: nút lớn trong hàng Thích, Bình luận, Chia sẻ. `variant="text"`: chữ nhỏ dưới bình luận.
 * Máy tính: rê chuột lên nút thì thanh cảm xúc bật ra. Điện thoại: nhấn giữ. Bàn phím: mũi tên lên.
 */
export function ReactionButton({ targetType, targetId, mine, variant = 'bar', className }: { targetType: 'post' | 'comment'; targetId: string; mine: string | null | undefined; variant?: 'bar' | 'text'; className?: string }) {
  const react = useReact(targetType);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Nhấn giữ trên điện thoại mở thanh cảm xúc; lượt "click" mà trình duyệt bắn ra sau khi nhả tay không được tính là bấm Thích.
  const skipClick = useRef(false);
  const current = byKind(mine);
  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const later = (fn: () => void, ms: number) => { clear(); timer.current = setTimeout(fn, ms); };
  useEffect(() => clear, []);
  // Thanh cảm xúc mở bằng nhấn giữ thì không có "rời chuột" để tự đóng: chạm ra ngoài là đóng.
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const pick = (kind: ReactionKind) => { clear(); setOpen(false); react.mutate({ targetId, reaction: kind }); };
  const onMainClick = () => {
    if (skipClick.current) { skipClick.current = false; return; }
    pick(current?.kind ?? 'like');
  };
  const text = variant === 'text';
  return (
    <span
      ref={box}
      className={`relative inline-flex${className ? ` ${className}` : ''}`}
      onMouseEnter={() => later(() => setOpen(true), 350)}
      onMouseLeave={() => later(() => setOpen(false), 280)}
    >
      <button
        type="button"
        className={text ? 'font-semibold' : 'post-action'}
        style={{ ...noCallout, color: current ? current.color : text ? T.ink2 : undefined }}
        aria-pressed={Boolean(current)}
        aria-haspopup="true"
        aria-label={current ? `${current.label}, bấm để gỡ` : 'Thích'}
        disabled={react.isPending}
        onClick={onMainClick}
        onTouchStart={() => later(() => { skipClick.current = true; setOpen(true); }, 420)}
        onTouchEnd={() => { if (!open) clear(); }}
        onTouchMove={() => { if (!open) clear(); }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); setOpen(true); } else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); } }}
      >
        {!text && (current ? <span aria-hidden="true" style={{ fontSize: 18, lineHeight: 1 }}>{current.emoji}</span> : <ThumbsUp size={18} />)}
        {current ? current.label : 'Thích'}
      </button>
      {open && (
        <span className="reaction-picker" role="group" aria-label="Chọn cảm xúc">
          {REACTIONS.map((r) => (
            <button key={r.kind} type="button" aria-label={r.label} title={r.label} aria-pressed={current?.kind === r.kind} onClick={() => pick(r.kind)} style={noCallout}>{r.emoji}</button>
          ))}
        </span>
      )}
    </span>
  );
}
