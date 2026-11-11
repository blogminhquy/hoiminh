// Trường nhập liệu: Field (nhãn + gợi ý), Input, Textarea, Select, OptionCard (radio dạng thẻ), SaveBar.
import clsx from 'clsx';
import { Check, ChevronDown } from 'lucide-react';
import { Children, Fragment, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ChangeEvent, CSSProperties, InputHTMLAttributes, KeyboardEvent, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './primitives';
import { Radio } from './primitives';

export function Field({ label, hint, children, className, right }: { label: ReactNode; hint?: ReactNode; children: ReactNode; className?: string; right?: ReactNode }) {
  return (
    <label className={clsx('flex flex-col gap-1.5', className)}>
      <span className="flex items-center gap-2 text-[13px] font-semibold">
        <span className="flex-grow">{label}</span>
        {right}
      </span>
      {children}
      {hint && <span className="muted text-[12px]">{hint}</span>}
    </label>
  );
}

export function Input({ left, right, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { left?: ReactNode; right?: ReactNode }) {
  return (
    <span className={clsx('input', className)}>
      {left}
      <input {...rest} />
      {right}
    </span>
  );
}

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <span className={clsx('input textarea', className)}>
      <textarea {...rest} />
    </span>
  );
}

interface SelectOption { value: string; label: ReactNode; text: string; disabled: boolean }

const textOf = (node: ReactNode): string => (node === null || node === undefined || typeof node === 'boolean' ? '' : typeof node === 'string' || typeof node === 'number' ? String(node) : Array.isArray(node) ? node.map(textOf).join('') : isValidElement(node) ? textOf((node.props as { children?: ReactNode }).children) : '');
/** Bỏ dấu và viết thường, để gõ "t" nhảy tới "Tất cả" hay "đ" tới "Điều phối". */
const fold = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();

/** Đọc các thẻ <option> con (kể cả nằm trong Fragment hay <optgroup>) thành danh sách lựa chọn. */
function readOptions(children: ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  const walk = (nodes: ReactNode) => Children.forEach(nodes, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; children?: ReactNode; disabled?: boolean; label?: string };
    if (child.type === Fragment || child.type === 'optgroup') { walk(props.children); return; }
    if (child.type !== 'option') return;
    const text = textOf(props.children) || props.label || '';
    out.push({ value: String(props.value ?? text), label: props.children ?? props.label ?? '', text, disabled: Boolean(props.disabled) });
  });
  walk(children);
  return out;
}

interface PopBox { left: number; top?: number; bottom?: number; minWidth: number; maxWidth: number; maxHeight: number }

/**
 * Ô chọn một giá trị. Dùng như <select> thường (value, defaultValue, onChange đọc e.target.value, các thẻ <option> con),
 * nhưng danh sách lựa chọn do app tự vẽ theo màu chủ đề, vì danh sách gốc của trình duyệt không theo giao diện tối
 * (nền trắng, chữ nhạt, không đọc được). Danh sách vẽ ra ngoài body nên không bị thẻ hay khung bật lên cắt mất.
 * `variant="chip"` cho ô chọn dạng viên thuốc nhỏ; mặc định là ô nhập cao 44px như Input.
 * Trong `style`, ô mặc định chỉ nhận các thuộc tính bề ngang và co giãn; chiều cao và cỡ chữ giữ theo chuẩn của ô nhập.
 */
export function Select({ className, children, value, defaultValue, onChange, disabled, style, id, name, variant = 'field', 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledby, title }: SelectHTMLAttributes<HTMLSelectElement> & { variant?: 'field' | 'chip' }) {
  const options = readOptions(children);
  const [inner, setInner] = useState(() => String(defaultValue ?? ''));
  const current = value !== undefined ? String(value) : inner;
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === current));
  const selected = options[selectedIndex];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const [box, setBox] = useState<PopBox | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const listId = useId();

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - r.bottom - 12;
    const above = r.top - 12;
    const up = below < 180 && above > below;
    const maxWidth = Math.min(420, vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - 8 - Math.min(maxWidth, Math.max(r.width, 180))));
    setBox({ left, minWidth: Math.min(Math.max(r.width, 180), maxWidth), maxWidth, maxHeight: Math.max(120, Math.min(340, up ? above : below)), ...(up ? { bottom: vh - r.top + 6 } : { top: r.bottom + 6 }) });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { const t = e.target as Node; if (!trigger.current?.contains(t) && !pop.current?.contains(t)) setOpen(false); };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) pop.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active, box]);

  const show = () => { if (disabled || !options.length) return; setActive(selectedIndex); setOpen(true); };
  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    setOpen(false);
    if (o.value === current) return;
    if (value === undefined) setInner(o.value);
    onChange?.({ target: { value: o.value, name }, currentTarget: { value: o.value, name } } as unknown as ChangeEvent<HTMLSelectElement>);
  };
  const step = (from: number, by: 1 | -1) => {
    for (let i = from + by; i >= 0 && i < options.length; i += by) if (!options[i]!.disabled) return i;
    return from;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOpen(false); return; }
    if (e.key === 'Tab') { setOpen(false); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => step(i, 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => step(i, -1)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActive(step(-1, 1)); return; }
    if (e.key === 'End') { e.preventDefault(); setActive(step(options.length, -1)); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const k = fold(e.key);
      const order = [...options.keys()].map((n) => (active + 1 + n) % options.length);
      const hit = order.find((i) => !options[i]!.disabled && fold(options[i]!.text).startsWith(k));
      if (hit !== undefined) setActive(hit);
    }
  };

  // Ô nhập chuẩn giữ chiều cao, viền và cỡ chữ của `.input`; chỉ nhận phần bề ngang, co giãn từ `style`.
  const { height: _h, fontSize: _f, border: _b, ...widthOnly } = (style ?? {}) as CSSProperties;
  const boxStyle = variant === 'chip' ? style : widthOnly;
  return (
    <>
      <button
        ref={trigger} type="button" id={id} role="combobox" title={title} disabled={disabled}
        aria-haspopup="listbox" aria-expanded={open} aria-controls={open ? listId : undefined} aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel} aria-labelledby={ariaLabelledby}
        className={clsx(variant === 'chip' ? 'chip' : 'input', 'select-trigger', className)} style={boxStyle}
        onClick={() => (open ? setOpen(false) : show())} onKeyDown={onKeyDown}
      >
        <span className="select-value">{selected?.label ?? ''}</span>
        <ChevronDown className="select-chevron" size={variant === 'chip' ? 14 : 16} aria-hidden />
      </button>
      {name !== undefined && <input type="hidden" name={name} value={selected?.value ?? ''} />}
      {open && box && createPortal(
        <div ref={pop} id={listId} role="listbox" className="select-pop" style={box} onClick={(e) => e.stopPropagation()}>
          {options.map((o, i) => (
            <div
              key={`${o.value}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === selectedIndex} aria-disabled={o.disabled || undefined} data-active={i === active}
              className="select-option"
              onPointerDown={(e) => e.preventDefault()} onPointerMove={() => { if (!o.disabled && active !== i) setActive(i); }} onClick={() => choose(i)}
            >
              <span className="select-option-label">{o.label}</span>
              {i === selectedIndex && <Check className="select-check" size={16} aria-hidden />}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}

export function OptionCard({ on, title, sub, onClick, children, className, icon }: { on: boolean; title: ReactNode; sub?: ReactNode; onClick?: () => void; children?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={clsx('option-card', on && 'on', className)}>
      <span className="flex items-center gap-2.5">
        <Radio on={on} />
        <span className="font-semibold text-[14px] inline-flex items-center gap-1.5">
          {icon}
          {title}
        </span>
      </span>
      {sub && <span className="muted text-[12px] pl-7">{sub}</span>}
      {children}
    </button>
  );
}

export function SaveBar({ title, sub, onSave, onCancel, saving, saved, extra }: { title: string; sub?: string; onSave?: () => void; onCancel?: () => void; saving?: boolean; saved?: boolean; extra?: ReactNode }) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div>
        <h1 className="serif m-0 text-[28px] font-extrabold leading-tight page-title">{title}</h1>
        {sub && <div className="muted text-[13px]">{sub}</div>}
      </div>
      <span className="flex-grow" />
      {extra}
      {saved && <span className="text-[13px] font-semibold" style={{ color: 'var(--teal)' }}>Đã lưu</span>}
      {onCancel && (
        <Button size="sm" onClick={onCancel}>Hủy</Button>
      )}
      {onSave && (
        <Button size="sm" variant="dark" onClick={onSave} loading={saving}>Lưu thay đổi</Button>
      )}
    </div>
  );
}

export function PageTitle({ title, sub, right, className }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={clsx('flex items-end gap-3 flex-wrap', className)}>
      <div className="min-w-0">
        <h1 className="serif m-0 text-[28px] font-extrabold leading-tight page-title">{title}</h1>
        {sub && <div className="muted text-[13px]">{sub}</div>}
      </div>
      <span className="flex-grow" />
      {right}
    </div>
  );
}
