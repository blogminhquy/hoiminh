// Component gốc: Avatar, Button, Chip, Tag, Card, Toggle, Radio, Prog, Money, Skeleton, Empty, ErrorBox.
import clsx from 'clsx';
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';
import { avatarColor, initialsOf, T } from '../tokens';

export interface AvatarProps {
  name: string | null | undefined;
  src?: string | null;
  color?: string | null;
  size?: number;
  className?: string;
  style?: CSSProperties;
}
/** Avatar chữ cái đầu hoặc ảnh, màu theo tên. */
export function Avatar({ name, src, color, size = 36, className, style }: AvatarProps) {
  const fs = Math.max(10, Math.round(size * 0.36));
  return (
    <span className={clsx('avatar', className)} style={{ width: size, height: size, fontSize: fs, background: src ? `url(${src})` : avatarColor(name, color), ...style }} aria-label={name ?? ''}>
      {src ? '' : initialsOf(name)}
    </span>
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
}
export function Button({ variant = 'ghost', size = 'md', loading, icon, block, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button type="button" {...rest} disabled={disabled || loading} className={clsx('btn', `btn-${variant}`, size === 'sm' && 'btn-sm', size === 'lg' && 'btn-lg', block && 'w-full', className)}>
      {loading ? <span className="inline-block w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Chip({ on, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { on?: boolean }) {
  return (
    <button type="button" {...rest} className={clsx('chip', on && 'on', className)}>
      {children}
    </button>
  );
}

export function Tag({ tone = 'neutral', children, className, style }: { tone?: 'accent' | 'teal' | 'gold' | 'neutral' | 'dark' | 'danger'; children: ReactNode; className?: string; style?: CSSProperties }) {
  const tones: Record<string, CSSProperties> = {
    accent: { background: T.accentSoft, color: T.accentText },
    teal: { background: T.tealSoft, color: T.tealText },
    gold: { background: T.goldSoft, color: T.goldText },
    neutral: { background: T.bg, color: T.ink2 },
    dark: { background: T.ink, color: T.surface },
    danger: { background: T.accentSoft, color: T.accentText },
  };
  return (
    <span className={clsx('tag', className)} style={{ ...tones[tone], ...style }}>
      {children}
    </span>
  );
}

export function Card({ children, className, style, dark, padded = true, onClick }: { children: ReactNode; className?: string; style?: CSSProperties; dark?: boolean; padded?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={clsx('card', padded && 'p-4 md:p-5', dark && 'card-dark', onClick && 'cursor-pointer', className)} style={dark ? { background: T.ink, color: T.surface, borderColor: T.ink, ...style } : style}>
      {children}
    </div>
  );
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={clsx('toggle', on && 'on', disabled && 'opacity-50')} onClick={() => onChange?.(!on)} />;
}

export function Radio({ on }: { on: boolean }) {
  return <span className={clsx('radio', on && 'on')} />;
}

export function Prog({ value, height = 6, className }: { value: number; height?: number; className?: string }) {
  return (
    <div className={clsx('prog', className)} style={{ height }}>
      <div style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Định dạng tiền: 249.000đ · $9.96. */
export function money(amountMinor: number | null | undefined, currency: string = 'VND'): string {
  if (amountMinor === null || amountMinor === undefined) return '';
  if (currency === 'USD') return `$${(amountMinor / 100).toFixed(2)}`;
  return `${Math.round(amountMinor).toLocaleString('vi-VN')}đ`;
}
export function Money({ amountMinor, currency = 'VND', className }: { amountMinor: number | null | undefined; currency?: string; className?: string }) {
  return <span className={className}>{money(amountMinor, currency)}</span>;
}

export function Skeleton({ h = 16, w = '100%', className }: { h?: number; w?: number | string; className?: string }) {
  return <div className={clsx('skeleton', className)} style={{ height: h, width: w }} />;
}

export function Empty({ title = 'Chưa có gì ở đây', hint, action }: { title?: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="card p-8 flex flex-col items-center text-center gap-2">
      <div className="font-semibold">{title}</div>
      {hint && <div className="muted text-[13px]">{hint}</div>}
      {action}
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card p-6 flex flex-col items-center text-center gap-2" style={{ borderColor: T.accentSoft }}>
      <div className="font-semibold" style={{ color: T.accentText }}>Có lỗi xảy ra</div>
      <div className="muted text-[13px]">{message}</div>
      {onRetry && <Button size="sm" onClick={onRetry}>Thử lại</Button>}
    </div>
  );
}

export function Toggle2({ on, onChange, disabled, label }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return Toggle({ on, onChange, disabled, label });
}
