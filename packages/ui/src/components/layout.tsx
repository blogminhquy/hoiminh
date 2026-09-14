// Khối bố cục dùng lại: Modal, StatCard, WalletBox, StatusTag, DateBlock, Logo Hội Mình, CommunityMark, BarChart nhỏ.
import clsx from 'clsx';
import { X } from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect } from 'react';
import { T } from '../tokens';
import { Tag } from './primitives';

export function Modal({ open, onClose, title, children, width = 680, footer }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; width?: number; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="card modal overflow-hidden" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {title !== undefined && (
          <div className="flex items-center px-5 py-4" style={{ borderBottom: `1px solid ${T.line}` }}>
            <span className="font-bold text-[16px] flex-grow text-center pl-5">{title}</span>
            <button type="button" aria-label="Đóng" onClick={onClose} style={{ color: T.ink3 }}>
              <X size={20} />
            </button>
          </div>
        )}
        {children}
        {footer}
      </div>
    </div>
  );
}

export function StatCard({ label, value, sub, subColor, className }: { label: string; value: ReactNode; sub?: ReactNode; subColor?: string; className?: string }) {
  return (
    <div className={clsx('card flex-1 min-w-0 px-[18px] py-4 flex flex-col gap-1', className)}>
      <span className="muted text-[12px] font-semibold uppercase tracking-[0.06em]">{label}</span>
      <span className="serif text-[24px] font-extrabold leading-tight">{value}</span>
      {sub && <span className="text-[12px]" style={{ color: subColor ?? T.ink3 }}>{sub}</span>}
    </div>
  );
}

export function WalletBox({ label, value, hint, strong }: { label: string; value: ReactNode; hint?: ReactNode; strong?: boolean }) {
  return (
    <div className="card flex-1 min-w-0 px-[18px] py-4 flex flex-col gap-1" style={strong ? { background: T.ink, color: T.surface, borderColor: T.ink } : undefined}>
      <span className="text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: strong ? T.gold : T.ink3 }}>{label}</span>
      <span className="serif text-[24px] font-extrabold">{value}</span>
      {hint && <span className="text-[12px]" style={{ color: strong ? T.sideText : T.ink3 }}>{hint}</span>}
    </div>
  );
}

const STATUS: Record<string, [string, 'accent' | 'teal' | 'gold' | 'neutral' | 'danger']> = {
  requested: ['Chờ duyệt', 'gold'], reviewing: ['Đang xử lý', 'teal'], paid: ['Đã trả', 'teal'], rejected: ['Bị từ chối', 'danger'], cancelled: ['Đã hủy', 'neutral'],
  pending: ['Đang giữ', 'gold'], available: ['Có thể rút', 'teal'], reversed: ['Đã đảo', 'danger'],
  active: ['Đang hoạt động', 'teal'], cancelling: ['Đang hủy', 'gold'], churned: ['Đã rời', 'neutral'], banned: ['Bị chặn', 'danger'],
  succeeded: ['Thành công', 'teal'], failed: ['Thất bại', 'danger'], refunded: ['Hoàn tiền', 'danger'], processing: ['Đang xử lý', 'gold'], expired: ['Hết hạn', 'neutral'],
  draft: ['Nháp', 'neutral'], published: ['Đã đăng', 'teal'], archived: ['Lưu trữ', 'neutral'], locked: ['Đã khóa', 'danger'],
  matched: ['Đã khớp', 'teal'], unmatched: ['Chưa khớp', 'gold'], wrong_content: ['Sai nội dung', 'gold'], missing_code: ['Thiếu mã', 'gold'], amount_mismatch: ['Lệch số tiền', 'danger'], duplicate: ['Trùng', 'danger'], manual_review: ['Cần xem', 'gold'],
  trialing: ['Dùng thử', 'neutral'], past_due: ['Quá hạn', 'danger'],
};
export function StatusTag({ status }: { status: string }) {
  const [label, tone] = STATUS[status] ?? [status, 'neutral'];
  return <Tag tone={tone}>{label}</Tag>;
}
export function statusLabel(status: string): string {
  return STATUS[status]?.[0] ?? status;
}

export function DateBlock({ date, tone = 'neutral', size = 56 }: { date: Date; tone?: 'accent' | 'teal' | 'neutral'; size?: number }) {
  const dow = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()];
  const colors = tone === 'accent' ? { bg: T.accentSoft, fg: T.accentText } : tone === 'teal' ? { bg: T.tealSoft, fg: T.tealText } : { bg: T.bg, fg: T.ink2 };
  return (
    <div className="text-center rounded-[10px] py-1.5 flex-shrink-0" style={{ width: size, background: colors.bg }}>
      <div className="text-[11px] font-semibold" style={{ color: colors.fg }}>{dow}</div>
      <div className="serif font-extrabold leading-[1.1]" style={{ fontSize: size > 48 ? 22 : 18, color: colors.fg }}>{date.getDate()}</div>
    </div>
  );
}

export function Logo({ size = 26, light, className }: { size?: number; light?: boolean; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center gap-2 serif font-extrabold', className)} style={{ fontSize: Math.round(size * 0.8), color: light ? T.surface : T.ink }}>
      <svg width={size} height={size} viewBox="0 0 26 26" fill="none" aria-hidden="true">
        <circle cx="9" cy="13" r="7" fill={T.accent} />
        <circle cx="17" cy="13" r="7" fill={T.teal} fillOpacity="0.85" />
      </svg>
      Hội Mình
    </span>
  );
}

export function CommunityMark({ mark, color, size = 40, radius, url, style }: { mark: string; color: string; size?: number; radius?: number; url?: string | null; style?: CSSProperties }) {
  return (
    <span className="inline-flex items-center justify-center serif font-extrabold flex-shrink-0 overflow-hidden" style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.3), background: url ? `url(${url}) center/cover` : color, color: T.surface, fontSize: Math.round(size * 0.42), ...style }}>
      {url ? '' : mark}
    </span>
  );
}

export function Bars({ values, height = 120, highlightLast = true }: { values: number[]; height?: number; highlightLast?: boolean }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {values.map((v, i) => (
        <div key={i} className="flex-1 rounded-t" style={{ height: `${Math.max(2, (v / max) * 100)}%`, background: highlightLast && i === values.length - 1 ? T.accent : T.teal, opacity: highlightLast && i === values.length - 1 ? 1 : 0.55 }} />
      ))}
    </div>
  );
}

export function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[12px]" style={{ color: T.ink3 }}>
      <span className="flex-grow h-px" style={{ background: T.line }} />
      {label}
      <span className="flex-grow h-px" style={{ background: T.line }} />
    </div>
  );
}
