// Nhãn phiên bản ở góc dưới màn hình: bản đang chạy, báo khi máy chủ đã có bản mới, nút cập nhật ngay.
// Chi tiết (lịch sử phiên bản, nhật ký máy này, liên kết commit) nằm ở Tài khoản · Phiên bản.
import { Check, ChevronRight, RefreshCw, Rocket, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { T } from '@hoiminh/ui';
import { fmtDateTime } from '@/lib/format';
import { useVersionStatus } from '@/lib/version';

export function VersionBadge() {
  const { build, deployed, updateAvailable, stuck, checking, checkNow, update } = useVersionStatus();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div ref={boxRef} className="hm-ver">
      {open && (
        <div className="hm-ver-panel" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: `1px solid ${T.line}` }}>
            <span className="font-semibold text-[13px] font-display" style={{ color: T.ink }}>Phiên bản</span>
            <span className="flex-grow" />
            <button type="button" aria-label="Đóng" onClick={() => setOpen(false)} style={{ color: T.ink3 }}><X size={16} /></button>
          </div>
          <div className="px-3.5 py-3 flex flex-col gap-1 text-[12px]" style={{ color: T.ink2, borderBottom: `1px solid ${T.line}` }}>
            <div>Đang chạy <b style={{ color: T.ink }}>v{build.version}</b> · {build.shortCommit} · dựng {fmtDateTime(build.buildTime)}</div>
            <div>
              Máy chủ: {checking && !deployed ? 'đang kiểm tra…'
                : !deployed ? 'chưa đọc được /version.json'
                : updateAvailable ? <b style={{ color: T.accentText }}>v{deployed.version} · {deployed.shortCommit}</b>
                : <span style={{ color: T.tealText }}>cùng bản</span>}
            </div>
          </div>
          <div className="px-3.5 py-2.5 flex items-center gap-2">
            {updateAvailable ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={update}><Rocket size={15} />Cập nhật ngay</button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: T.tealText }}><Check size={15} />Mới nhất</span>
            )}
            <span className="flex-grow" />
            <button type="button" className="btn btn-ghost btn-sm" onClick={checkNow} disabled={checking}>
              <RefreshCw size={14} className={checking ? 'animate-spin' : undefined} />Kiểm tra
            </button>
          </div>
          {stuck && (
            <p className="px-3.5 py-2 m-0 text-[11px] leading-[1.5]" style={{ background: T.accentSoft, color: T.accentText }}>
              Nạp lại rồi mà vẫn là bản cũ: trình duyệt đang giữ cache. Nhấn Ctrl+F5 (hoặc Cmd+Shift+R) để tải lại cứng.
            </p>
          )}
          {/* Thẻ a thường, không phải Link: nhãn này nằm ngoài RouterProvider (main.tsx). */}
          <a href="/tai-khoan/phien-ban" onClick={() => setOpen(false)} className="flex items-center gap-1 px-3.5 py-2.5 text-[12px] font-semibold" style={{ color: T.tealText, borderTop: `1px solid ${T.line}` }}>
            Lịch sử phiên bản và nhật ký máy này<ChevronRight size={14} />
          </a>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={updateAvailable ? 'Đã có bản mới, bấm để cập nhật' : `Hội Mình v${build.version} · ${build.shortCommit}`}
        className="hm-ver-pill"
        style={updateAvailable
          ? { background: T.accent, color: T.invertInk, borderColor: T.accent }
          : { background: T.surface, color: T.ink3, borderColor: T.line }}
      >
        {updateAvailable
          ? <><Rocket size={13} /><span>Có bản mới</span></>
          : <><span className="hm-ver-dot" style={{ background: T.teal }} /><span>v{build.version}</span><span style={{ opacity: 0.65 }}>{build.shortCommit}</span></>}
      </button>
    </div>
  );
}
