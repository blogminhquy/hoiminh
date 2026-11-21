// Bảng lọc khoảng ngày dùng chung cho mọi trang số liệu (Tiền, Bàn điều khiển của chủ hội, Tổng quan hệ thống).
// Nút mở hiện tên mốc đang chọn hoặc khoảng ngày. Bảng gồm cột mốc bấm nhanh (bấm là áp dụng ngay), hai ô ngày
// dd/mm/yyyy, lịch tháng (máy tính hai tháng, điện thoại một tháng) và nút Đóng, Áp dụng cho khoảng tự chọn.
// Máy tính: bảng nổi cạnh nút mở. Điện thoại: bảng trượt lên từ đáy màn hình, không tràn ngang.
// Bàn phím: Esc đóng, Tab đi vòng trong bảng, phím mũi tên đi giữa các ngày trên lịch.
// Phần tính ngày nằm ở @/lib/date-range (hàm thuần, có test).
import { shiftDay, vnDay } from '@hoiminh/contracts';
import { ArrowRight, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { PRESETS, WEEKDAYS, choiceLabel, choiceRange, dayAriaLabel, fmtDay, maskDayInput, monthLabel, monthOf, monthWeeks, parseDayInput, shiftMonth, type PresetKey, type RangeChoice } from '@/lib/date-range';

/** Dưới bề ngang này bảng lọc là tấm trượt từ đáy màn hình (khớp với @media trong styles.css). */
const SHEET = '(max-width: 767px)';
/** Từ bề ngang này mới đủ chỗ cho hai tháng lịch cạnh nhau. */
const TWO_MONTHS = '(min-width: 900px)';

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (listener) => { const m = window.matchMedia(query); m.addEventListener('change', listener); return () => m.removeEventListener('change', listener); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Khoảng đang chọn dở trong bảng, chưa áp dụng. `preset` còn giữ khi người dùng chưa đụng vào ngày nào. */
interface Draft { preset: PresetKey | null; from: string | null; to: string | null }

const ARROWS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
const FOCUSABLE = 'button:not(:disabled):not([tabindex="-1"]), input:not(:disabled)';

export function DateRangePicker({ value, onChange, className }: { value: RangeChoice; onChange: (next: RangeChoice) => void; className?: string }) {
  const today = vnDay(new Date());
  const sheet = useMedia(SHEET);
  const twoMonths = useMedia(TWO_MONTHS);
  const monthCount = twoMonths ? 2 : 1;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ preset: null, from: null, to: null });
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  /** Tháng đầu tiên đang hiện trên lịch (YYYY-MM). */
  const [view, setView] = useState(monthOf(today));
  /** Đã bấm ngày thứ nhất, đang chờ ngày thứ hai. */
  const [anchor, setAnchor] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [box, setBox] = useState<CSSProperties | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  /** Ngày cần nhận tiêu điểm sau khi lịch chuyển tháng (đi bằng phím mũi tên). */
  const focusAfterRender = useRef<string | null>(null);
  const focused = useRef(false);
  const dialogId = useId();

  const thisMonth = monthOf(today);
  const months = Array.from({ length: monthCount }, (_, i) => shiftMonth(view, i));
  const lastMonth = months[months.length - 1]!;
  /** Tháng đầu muộn nhất được hiện: tháng cuối cùng trên lịch không vượt quá tháng này. */
  const latestView = shiftMonth(thisMonth, 1 - monthCount);
  const clampView = useCallback((month: string) => (month > latestView ? latestView : month), [latestView]);

  const show = () => {
    const range = choiceRange(value, today);
    setDraft({ preset: value.preset, from: range.from, to: range.to });
    setFromText(range.from ? fmtDay(range.from) : '');
    setToText(fmtDay(range.to));
    setView(clampView(shiftMonth(monthOf(range.to), 1 - monthCount)));
    setAnchor(null);
    setHover(null);
    setError(null);
    setBox(null);
    setOpen(true);
  };
  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  }, []);

  // Máy tính: đặt bảng ngay dưới nút mở, lật lên trên hoặc dịch vào trong khi sát mép màn hình.
  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    const el = pop.current;
    if (!r || !el) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(r.left + w <= vw - 8 ? r.left : r.right - w, vw - w - 8));
    const below = r.bottom + 6;
    const above = r.top - 6 - h;
    const top = below + h <= vh - 8 || above < 8 ? Math.max(8, Math.min(below, vh - h - 8)) : above;
    setBox({ left, top });
  }, []);
  useLayoutEffect(() => {
    if (!open || sheet) return;
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true); };
  }, [open, sheet, monthCount, place]);

  // Mở ra thì đưa tiêu điểm vào bảng. Trên máy tính phải chờ bảng được đặt chỗ xong: phần tử còn ẩn không nhận tiêu điểm.
  useEffect(() => {
    if (!open) { focused.current = false; return; }
    if (focused.current || (!sheet && !box)) return;
    focused.current = true;
    pop.current?.focus();
  }, [open, sheet, box]);
  // Esc đóng; bấm ra ngoài thì đóng.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); close(true); } };
    const onDown = (e: PointerEvent) => { const t = e.target as Node; if (!trigger.current?.contains(t) && !pop.current?.contains(t)) close(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [open, close]);
  // Tấm trượt trên điện thoại: khóa cuộn trang phía sau.
  useEffect(() => {
    if (!open || !sheet) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, [open, sheet]);
  // Đổi bề ngang (xoay máy) làm số tháng hiện ra đổi theo: giữ tháng cuối không vượt quá tháng này.
  useEffect(() => { setView((v) => clampView(v)); }, [clampView]);
  useEffect(() => {
    const day = focusAfterRender.current;
    if (!day) return;
    focusAfterRender.current = null;
    pop.current?.querySelector<HTMLButtonElement>(`button[data-day="${day}"]`)?.focus();
  });

  const setRange = (from: string | null, to: string | null) => { setDraft({ preset: null, from, to }); setError(null); };
  const pickPreset = (key: PresetKey) => { onChange({ preset: key }); close(true); };
  const pickDay = (day: string) => {
    if (anchor === null) {
      setAnchor(day);
      setRange(day, day);
      setFromText(fmtDay(day));
      setToText(fmtDay(day));
      return;
    }
    const [from, to] = day < anchor ? [day, anchor] : [anchor, day];
    setAnchor(null);
    setHover(null);
    setRange(from, to);
    setFromText(fmtDay(from));
    setToText(fmtDay(to));
  };
  const typeDay = (side: 'from' | 'to', text: string) => {
    const masked = maskDayInput(text);
    const day = parseDayInput(masked);
    if (side === 'from') setFromText(masked); else setToText(masked);
    setAnchor(null);
    setRange(side === 'from' ? day : draft.from, side === 'to' ? day : draft.to);
    // Gõ xong một ngày hợp lệ thì lịch nhảy tới tháng của ngày đó.
    if (day && day <= today && !months.includes(monthOf(day))) setView(clampView(side === 'to' ? shiftMonth(monthOf(day), 1 - monthCount) : monthOf(day)));
  };
  const apply = () => {
    // Chưa đụng vào ngày nào thì mốc đang chọn giữ nguyên.
    if (draft.preset) { close(true); return; }
    const from = parseDayInput(fromText);
    const to = parseDayInput(toText);
    const hint = 'Nhập theo dạng ngày/tháng/năm, ví dụ 08/10/2026.';
    if (!from) { setError(`Ngày bắt đầu chưa đúng. ${hint}`); return; }
    if (!to) { setError(`Ngày kết thúc chưa đúng. ${hint}`); return; }
    if (from > to) { setError('Ngày bắt đầu phải trước hoặc trùng ngày kết thúc.'); return; }
    if (to > today) { setError('Ngày kết thúc không được sau hôm nay.'); return; }
    onChange({ preset: null, from, to });
    close(true);
  };

  // Khoảng đang tô trên lịch: đang chọn dở thì theo ngày đầu và ô đang rê chuột tới.
  const preview = anchor && hover ? (hover < anchor ? [hover, anchor] : [anchor, hover]) : null;
  const shownFrom = preview ? preview[0]! : draft.from;
  const shownTo = preview ? preview[1]! : draft.to;
  const inRange = (day: string) => shownTo !== null && day <= shownTo && (shownFrom === null ? draft.preset === 'allTime' : day >= shownFrom);

  const onPopKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;
    // Tab đi vòng trong bảng: bảng đang mở là việc duy nhất cần làm xong.
    const items = Array.from(pop.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
    if (!items.length) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === pop.current)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  const onDayKeyDown = (e: ReactKeyboardEvent<HTMLButtonElement>, day: string) => {
    const step = ARROWS[e.key];
    if (step === undefined) return;
    e.preventDefault();
    const next = shiftDay(day, step);
    if (next > today) return;
    if (anchor) setHover(next);
    const month = monthOf(next);
    if (months.includes(month)) {
      // Ngày kế đang có trên lịch: chuyển tiêu điểm ngay.
      pop.current?.querySelector<HTMLButtonElement>(`button[data-day="${next}"]`)?.focus();
      return;
    }
    // Ngày kế nằm ở tháng chưa hiện: lật lịch trước, vẽ xong mới chuyển tiêu điểm.
    focusAfterRender.current = next;
    setView(clampView(step < 0 ? month : shiftMonth(month, 1 - monthCount)));
  };

  const label = choiceLabel(value);
  return (
    <>
      <button ref={trigger} type="button" className={`btn btn-ghost drp-trigger${className ? ` ${className}` : ''}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? dialogId : undefined} aria-label={`Khoảng ngày: ${label}`} onClick={() => (open ? close(false) : show())}>
        <CalendarDays size={18} aria-hidden className="drp-trigger-icon" />
        <span className="drp-trigger-label">{label}</span>
        <ChevronDown size={16} aria-hidden className="drp-trigger-chevron" />
      </button>
      {open && createPortal(
        <>
          <div className="drp-backdrop" aria-hidden="true" />
          <div ref={pop} id={dialogId} className="drp-pop" role="dialog" aria-modal="true" aria-label="Chọn khoảng ngày" tabIndex={-1} style={sheet ? undefined : (box ?? { left: 0, top: 0, visibility: 'hidden' })} onKeyDown={onPopKeyDown}>
            <div className="drp-title">Chọn khoảng ngày</div>
            <div className="drp-body">
              <div className="drp-presets" role="group" aria-label="Mốc bấm nhanh">
                {PRESETS.map((p) => (
                  <button key={p.key} type="button" className="drp-preset" aria-pressed={draft.preset === p.key} onClick={() => pickPreset(p.key)}>{p.label}</button>
                ))}
              </div>
              <div className="drp-main">
                <div className="drp-inputs">
                  <input className="drp-input" type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/yyyy" maxLength={10} aria-label="Từ ngày" value={fromText} onChange={(e) => typeDay('from', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} />
                  <ArrowRight size={18} aria-hidden className="drp-arrow" />
                  <input className="drp-input" type="text" inputMode="numeric" autoComplete="off" placeholder="dd/mm/yyyy" maxLength={10} aria-label="Đến ngày" value={toText} onChange={(e) => typeDay('to', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') apply(); }} />
                </div>
                <div className="drp-months" onPointerLeave={() => setHover(null)}>
                  {months.map((month, i) => {
                    const weeks = monthWeeks(month);
                    while (weeks.length < 6) weeks.push([null, null, null, null, null, null, null]);
                    const days = weeks.flat().filter((d): d is string => d !== null && d <= today);
                    // Mỗi tháng chỉ một ô ngày nằm trên đường Tab; các ô khác đi bằng phím mũi tên.
                    const tabStop = [shownTo, shownFrom, today].find((d) => d && days.includes(d)) ?? days[0] ?? null;
                    return (
                      <div key={month} className="drp-month" role="group" aria-label={monthLabel(month)}>
                        <div className="drp-month-head">
                          <span className="drp-nav">
                            {i === 0 && (
                              <>
                                <button type="button" aria-label="Lùi một năm" onClick={() => setView(shiftMonth(view, -12))}><ChevronsLeft size={18} aria-hidden /></button>
                                <button type="button" aria-label="Lùi một tháng" onClick={() => setView(shiftMonth(view, -1))}><ChevronLeft size={18} aria-hidden /></button>
                              </>
                            )}
                          </span>
                          <span className="drp-month-title" aria-live="polite">{monthLabel(month)}</span>
                          <span className="drp-nav">
                            {i === months.length - 1 && (
                              <>
                                <button type="button" aria-label="Tới một tháng" disabled={lastMonth >= thisMonth} onClick={() => setView(clampView(shiftMonth(view, 1)))}><ChevronRight size={18} aria-hidden /></button>
                                <button type="button" aria-label="Tới một năm" disabled={lastMonth >= thisMonth} onClick={() => setView(clampView(shiftMonth(view, 12)))}><ChevronsRight size={18} aria-hidden /></button>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="drp-weekdays" aria-hidden="true">{WEEKDAYS.map((w) => <span key={w}>{w}</span>)}</div>
                        <div className="drp-grid">
                          {weeks.flat().map((day, cell) => {
                            if (!day) return <span key={`empty-${cell}`} className="drp-empty" />;
                            const start = day === shownFrom;
                            const end = day === shownTo;
                            return (
                              <button
                                key={day} type="button" className="drp-day" data-day={day} disabled={day > today} tabIndex={day === tabStop ? 0 : -1}
                                data-in={inRange(day) || undefined} data-edge={start && end ? 'both' : start ? 'start' : end ? 'end' : undefined} data-today={day === today || undefined}
                                aria-label={`${dayAriaLabel(day)}${day === today ? ', hôm nay' : ''}`} aria-pressed={start || end}
                                onClick={() => pickDay(day)} onPointerEnter={() => { if (anchor) setHover(day); }} onFocus={() => { if (anchor) setHover(day); }} onKeyDown={(e) => onDayKeyDown(e, day)}
                              >
                                {Number(day.slice(8))}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="drp-hint" role={error ? 'alert' : undefined} data-error={error ? true : undefined}>
                  {error ?? (anchor ? 'Bấm thêm một ngày nữa để chốt khoảng.' : 'Bấm một mốc có sẵn, hoặc bấm ngày đầu rồi ngày cuối trên lịch.')}
                </div>
              </div>
            </div>
            <div className="drp-foot">
              <button type="button" className="btn btn-ghost" onClick={() => close(true)}>Đóng</button>
              <button type="button" className="btn btn-primary" onClick={apply}>Áp dụng</button>
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
  );
}
