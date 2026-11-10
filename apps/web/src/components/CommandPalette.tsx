// Ô lệnh "Bạn muốn làm gì?": mở bằng nút ở đầu trang hoặc Ctrl K (Cmd K trên máy Mac). Gõ vài chữ không cần dấu,
// dùng mũi tên lên xuống rồi Enter, hoặc chạm vào một dòng. Danh sách lệnh do nơi gọi truyền vào (lib/commands.ts),
// `extra` cho phép thêm kết quả theo chữ đang gõ (tìm thành viên, tìm trong bảng tin).
import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { searchCommands, type Command } from '@/lib/commands';

export interface PaletteItem { id: string; group: string; label: string; hint?: string; to: string; icon?: ReactNode }

/** Bật tắt ô lệnh bằng Ctrl K hoặc Cmd K ở bất kỳ đâu trong trang. */
export function useCommandHotkey(toggle: () => void, enabled = true): void {
  useEffect(() => {
    // Người không có ô lệnh thì để nguyên phím tắt của trình duyệt.
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); toggle(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, enabled]);
}

/** Nút mở ô lệnh. Máy tính: một ô dài giống ô tìm kiếm, có ghi phím tắt. Điện thoại: nút vuông có kính lúp. */
export function CommandButton({ onOpen, compact }: { onOpen: () => void; compact?: boolean }) {
  if (compact) {
    return <button type="button" aria-label="Bạn muốn làm gì?" aria-haspopup="dialog" onClick={onOpen} className="cmd-icon-btn"><Search size={20} /></button>;
  }
  return (
    <button type="button" aria-haspopup="dialog" onClick={onOpen} className="input search cmd-open">
      <Search size={18} />
      <span className="flex-grow text-left truncate">Bạn muốn làm gì?</span>
      <kbd>Ctrl K</kbd>
    </button>
  );
}

export function CommandPalette({ open, onClose, commands, extra, placeholder = 'Gõ việc muốn làm, ví dụ: mời thành viên' }: { open: boolean; onClose: () => void; commands: Command[]; extra?: (query: string) => PaletteItem[]; placeholder?: string }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const items = useMemo<PaletteItem[]>(() => [...searchCommands(commands, q), ...(extra ? extra(q.trim()) : [])], [commands, q, extra]);

  useEffect(() => { if (open) { setQ(''); setActive(0); } }, [open]);
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' }); }, [active]);
  if (!open) return null;

  const go = (item: PaletteItem | undefined) => { if (!item) return; onClose(); navigate(item.to); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(items[active]); }
  };
  // Khi đang gõ, kết quả xếp theo độ khớp nên không chia nhóm nữa; ô trống thì hiện theo nhóm để dễ lướt.
  const grouped = !q.trim();
  let lastGroup = '';
  return (
    <div className="cmd-backdrop" onClick={onClose}>
      <div className="cmd-panel" role="dialog" aria-modal="true" aria-label="Bạn muốn làm gì?" onClick={(e) => e.stopPropagation()} onKeyDown={onKeyDown}>
        <label className="cmd-input">
          <Search size={20} />
          <input autoFocus type="search" enterKeyHint="go" role="combobox" aria-expanded="true" aria-controls="cmd-list" aria-activedescendant={items[active] ? `cmd-${items[active].id}` : undefined} placeholder={placeholder} aria-label="Bạn muốn làm gì?" value={q} onChange={(e) => setQ(e.target.value)} />
          <button type="button" className="cmd-close" onClick={onClose}>Đóng</button>
        </label>
        <div id="cmd-list" ref={listRef} role="listbox" aria-label="Kết quả" className="cmd-list">
          {items.length === 0 && <div className="cmd-empty">Không có việc nào khớp với "{q.trim()}". Thử gõ ít chữ hơn.</div>}
          {items.map((it, i) => {
            const head = grouped && it.group !== lastGroup ? it.group : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {head && <div className="cmd-group">{head}</div>}
                <button type="button" id={`cmd-${it.id}`} role="option" aria-selected={i === active} className="cmd-item" onMouseMove={() => setActive(i)} onClick={() => go(it)}>
                  {it.icon}
                  <span className="flex-grow min-w-0"><span className="block truncate">{it.label}</span>{it.hint && <span className="block cmd-hint truncate">{it.hint}</span>}</span>
                  {!grouped && <span className="cmd-tag">{it.group}</span>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
