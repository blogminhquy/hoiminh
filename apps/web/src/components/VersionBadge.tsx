// Nhãn phiên bản ở góc dưới màn hình: cho biết bản đang chạy, báo khi Cloudflare đã có bản mới,
// nút cập nhật ngay, lịch sử phiên bản (CHANGELOG) và nhật ký các bản máy này đã dùng.
import { Check, ExternalLink, History, RefreshCw, Rocket, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { T } from '@hoiminh/ui';
import { useAuth } from '@/lib/auth';
import { fmtDateTime } from '@/lib/format';
import { commitUrl, deployWorkflowUrl, useVersionStatus, type ReleaseNote, type SeenVersion } from '@/lib/version';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2 text-[12px]">
      <span className="flex-shrink-0" style={{ color: T.ink3, width: 78 }}>{label}</span>
      <span className="min-w-0 flex-grow break-words" style={{ color: T.ink2 }}>{children}</span>
    </div>
  );
}

function ReleaseList({ releases }: { releases: ReleaseNote[] }) {
  if (releases.length === 0) return <p className="text-[12px]" style={{ color: T.ink3 }}>Chưa có ghi chú phiên bản.</p>;
  return (
    <ol className="flex flex-col gap-3.5">
      {releases.map((r) => (
        <li key={r.version}>
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-[13px]" style={{ color: T.ink }}>v{r.version}</span>
            {r.date && <span className="text-[11px]" style={{ color: T.ink3 }}>{r.date}</span>}
          </div>
          {r.summary && <p className="mt-1 text-[12px] leading-[1.5]" style={{ color: T.ink2 }}>{r.summary}</p>}
          {r.sections.map((s, i) => (
            <div key={`${r.version}-${i}`} className="mt-1.5">
              {s.title && <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: T.ink3 }}>{s.title}</div>}
              <ul className="mt-0.5 flex flex-col gap-0.5">
                {s.items.map((it, j) => (
                  <li key={j} className="text-[12px] leading-[1.5] pl-3 relative" style={{ color: T.ink2 }}>
                    <span className="absolute left-0 top-[7px] w-1 h-1 rounded-full" style={{ background: T.line2 }} />
                    {it}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </li>
      ))}
    </ol>
  );
}

function SeenList({ log, currentBuildId }: { log: SeenVersion[]; currentBuildId: string }) {
  if (log.length === 0) return <p className="text-[12px]" style={{ color: T.ink3 }}>Chưa ghi nhận lần cập nhật nào trên máy này.</p>;
  return (
    <ol className="flex flex-col gap-2">
      {log.map((e) => (
        <li key={e.buildId} className="flex items-baseline gap-2 text-[12px]">
          <span className="font-semibold" style={{ color: T.ink }}>v{e.version}</span>
          <span style={{ color: T.ink3 }}>{e.shortCommit}</span>
          <span className="flex-grow" />
          {e.buildId === currentBuildId && <span className="text-[11px] font-semibold" style={{ color: T.tealText }}>đang dùng</span>}
          <span style={{ color: T.ink3 }}>{fmtDateTime(e.seenAt)}</span>
        </li>
      ))}
    </ol>
  );
}

export function VersionBadge() {
  const { user } = useAuth();
  const { build, deployed, updateAvailable, stuck, checking, log, checkNow, update } = useVersionStatus();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'releases' | 'log'>('releases');
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const isAdmin = Boolean(user?.isSuperAdmin);
  const commit = commitUrl(build);
  const workflow = deployWorkflowUrl(build);

  return (
    <div ref={boxRef} className="hm-ver">
      {open && (
        <div className="hm-ver-panel" style={{ background: T.surface, border: `1px solid ${T.line}` }}>
          <div className="flex items-center gap-2 px-3.5 py-2.5" style={{ borderBottom: `1px solid ${T.line}` }}>
            <span className="font-semibold text-[13px] font-display" style={{ color: T.ink }}>Phiên bản</span>
            <span className="flex-grow" />
            <button type="button" aria-label="Đóng" onClick={() => setOpen(false)} style={{ color: T.ink3 }}><X size={16} /></button>
          </div>

          <div className="px-3.5 py-3 flex flex-col gap-1.5" style={{ borderBottom: `1px solid ${T.line}` }}>
            <Row label="Đang chạy"><b style={{ color: T.ink }}>v{build.version}</b> · {build.shortCommit}</Row>
            {build.branch && <Row label="Nhánh">{build.branch}</Row>}
            <Row label="Dựng lúc">{fmtDateTime(build.buildTime)}</Row>
            {build.commitMessage && <Row label="Thay đổi">{build.commitMessage}</Row>}
            <Row label="Máy chủ">
              {checking && !deployed ? 'đang kiểm tra…'
                : !deployed ? 'chưa đọc được /version.json'
                : updateAvailable ? <b style={{ color: T.accentText }}>v{deployed.version} · {deployed.shortCommit}</b>
                : <span style={{ color: T.tealText }}>đang là bản mới nhất</span>}
            </Row>
          </div>

          <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ borderBottom: `1px solid ${T.line}` }}>
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
            <p className="px-3.5 py-2 text-[11px] leading-[1.5]" style={{ background: T.accentSoft, color: T.accentText }}>
              Nạp lại rồi mà vẫn là bản cũ — trình duyệt đang giữ cache. Nhấn Ctrl+F5 (hoặc Cmd+Shift+R) để tải lại cứng.
            </p>
          )}

          <div className="flex items-center gap-1 px-2.5 pt-2.5">
            <button type="button" className={`chip${tab === 'releases' ? ' on' : ''}`} onClick={() => setTab('releases')}>Lịch sử phiên bản</button>
            <button type="button" className={`chip${tab === 'log' ? ' on' : ''}`} onClick={() => setTab('log')}><History size={13} />Máy này</button>
          </div>
          <div className="hm-ver-scroll px-3.5 py-3" style={{ maxHeight: 260 }}>
            {tab === 'releases' ? <ReleaseList releases={build.releases} /> : <SeenList log={log} currentBuildId={build.buildId} />}
          </div>

          {isAdmin && (commit || workflow) && (
            <div className="px-3.5 py-2.5 flex items-center gap-3 text-[12px]" style={{ borderTop: `1px solid ${T.line}` }}>
              {commit && <a href={commit} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: T.tealText }}><ExternalLink size={13} />Commit</a>}
              {workflow && <a href={workflow} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: T.tealText }}><ExternalLink size={13} />Chạy deploy lại</a>}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        title={updateAvailable ? 'Đã có bản mới — bấm để cập nhật' : `Hội Mình v${build.version} · ${build.shortCommit}`}
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
