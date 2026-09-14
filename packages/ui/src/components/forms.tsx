// Trường nhập liệu: Field (nhãn + gợi ý), Input, Textarea, Select, OptionCard (radio dạng thẻ), SaveBar.
import clsx from 'clsx';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
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

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={clsx('input', className)}>
      <select {...rest}>{children}</select>
    </span>
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
