// Tài khoản · Phiên bản: bản đang chạy, bản trên máy chủ, nút cập nhật, lịch sử phiên bản (CHANGELOG lúc build)
// và nhật ký các bản trình duyệt này đã dùng. Trước đây tất cả nằm trong bảng bật ra từ nhãn góc màn hình.
import { Button, T } from '@hoiminh/ui';
import { Check, ExternalLink, RefreshCw, Rocket } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { fmtDateTime } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { commitUrl, deployWorkflowUrl, useVersionStatus, type ReleaseNote, type SeenVersion } from '@/lib/version';

/** CHANGELOG viết Markdown; hiện đậm và mã nguồn inline thay vì để nguyên dấu ** và `. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean).map((part, i) => {
    if (part.startsWith('**')) return <strong key={i} style={{ color: T.ink }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`')) return <code key={i} className="text-[12px]" style={{ background: T.bg, padding: '0 4px', borderRadius: 4 }}>{part.slice(1, -1)}</code>;
    return part;
  });
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-[13px] flex-wrap">
      <span className="flex-shrink-0 muted" style={{ width: 96 }}>{label}</span>
      <span className="min-w-0 flex-grow break-words" style={{ color: T.ink2 }}>{children}</span>
    </div>
  );
}

function Release({ r, current }: { r: ReleaseNote; current: boolean }) {
  return (
    <li className="flex flex-col gap-1.5 py-4" style={{ borderTop: `1px solid ${T.line}` }}>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-semibold text-[15px]" style={{ color: T.ink }}>v{r.version}</span>
        {r.date && <span className="muted text-[12px]">{r.date}</span>}
        {current && <span className="tag" style={{ background: T.tealSoft, color: T.tealText }}>đang chạy</span>}
      </div>
      {r.summary && <p className="m-0 text-[13px] leading-[1.6]" style={{ color: T.ink2 }}>{inline(r.summary)}</p>}
      {r.sections.map((s, i) => (
        <div key={`${r.version}-${i}`} className="mt-1">
          {s.title && <div className="text-[11px] font-semibold uppercase tracking-wide muted">{s.title}</div>}
          <ul className="mt-1 flex flex-col gap-1 pl-0 list-none">
            {s.items.map((it, j) => (
              <li key={j} className="text-[13px] leading-[1.6] pl-3.5 relative" style={{ color: T.ink2 }}>
                <span className="absolute left-0 top-[9px] w-1.5 h-1.5 rounded-full" style={{ background: T.line2 }} />
                {inline(it)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </li>
  );
}

function SeenList({ log, currentBuildId }: { log: SeenVersion[]; currentBuildId: string }) {
  if (log.length === 0) return <p className="muted text-[13px] m-0">Chưa ghi nhận lần cập nhật nào trên máy này.</p>;
  return (
    <ol className="flex flex-col list-none pl-0 m-0">
      {log.map((e) => (
        <li key={e.buildId} className="flex items-baseline gap-3 text-[13px] py-2 flex-wrap" style={{ borderTop: `1px solid ${T.line}` }}>
          <span className="font-semibold" style={{ color: T.ink }}>v{e.version}</span>
          <code className="text-[12px] muted">{e.shortCommit}</code>
          {e.buildId === currentBuildId && <span className="tag" style={{ background: T.tealSoft, color: T.tealText }}>đang dùng</span>}
          <span className="flex-grow" />
          <span className="muted">{fmtDateTime(e.seenAt)}</span>
        </li>
      ))}
    </ol>
  );
}

export default function Page() {
  const { user } = useAuth();
  const { build, deployed, updateAvailable, stuck, checking, log, checkNow, update } = useVersionStatus();
  const [tab, setTab] = useState<'releases' | 'log'>('releases');
  const isAdmin = Boolean(user?.isSuperAdmin);
  const commit = commitUrl(build);
  const workflow = deployWorkflowUrl(build);

  return (
    <>
      <div>
        <h1 className="serif m-0 text-[28px] font-extrabold leading-tight">Phiên bản</h1>
        <div className="muted text-[13px]">Bản bạn đang mở, bản mới nhất trên máy chủ và những gì đã thay đổi</div>
      </div>

      <div className="card flex flex-col gap-2.5" style={{ padding: '18px 20px' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-semibold">Đang chạy</span>
          <span className="flex-grow" />
          {updateAvailable
            ? <Button variant="primary" size="sm" icon={<Rocket size={14} />} onClick={update}>Cập nhật ngay</Button>
            : <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: T.tealText }}><Check size={15} />Bản mới nhất</span>}
          <Button size="sm" icon={<RefreshCw size={13} className={checking ? 'animate-spin' : undefined} />} disabled={checking} onClick={checkNow}>Kiểm tra</Button>
        </div>
        <Row label="Phiên bản"><b style={{ color: T.ink }}>v{build.version}</b> · <code className="text-[12px]">{build.shortCommit}</code>{build.branch ? ` · nhánh ${build.branch}` : ''}</Row>
        <Row label="Dựng lúc">{fmtDateTime(build.buildTime)}</Row>
        {build.commitMessage && <Row label="Thay đổi cuối">{build.commitMessage}</Row>}
        <Row label="Máy chủ">
          {checking && !deployed ? 'đang kiểm tra…'
            : !deployed ? 'chưa đọc được /version.json'
            : updateAvailable ? <><b style={{ color: T.accentText }}>v{deployed.version} · {deployed.shortCommit}</b> · dựng {fmtDateTime(deployed.buildTime)}</>
            : <span style={{ color: T.tealText }}>cùng bản với máy bạn</span>}
        </Row>
        {stuck && (
          <p className="m-0 mt-1 px-3 py-2 rounded-lg text-[12px] leading-[1.5]" style={{ background: T.accentSoft, color: T.accentText }}>
            Nạp lại rồi mà vẫn là bản cũ: trình duyệt đang giữ cache. Nhấn Ctrl+F5 (hoặc Cmd+Shift+R) để tải lại cứng.
          </p>
        )}
        {isAdmin && (commit || workflow) && (
          <div className="flex items-center gap-4 text-[12px] pt-1">
            {commit && <a href={commit} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: T.tealText }}><ExternalLink size={13} />Commit trên GitHub</a>}
            {workflow && <a href={workflow} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1" style={{ color: T.tealText }}><ExternalLink size={13} />Chạy deploy lại</a>}
          </div>
        )}
      </div>

      <div className="card flex flex-col gap-3" style={{ padding: '18px 20px' }}>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" className={`chip${tab === 'releases' ? ' on' : ''}`} onClick={() => setTab('releases')}>Lịch sử phiên bản</button>
          <button type="button" className={`chip${tab === 'log' ? ' on' : ''}`} onClick={() => setTab('log')}>Máy này</button>
          <span className="flex-grow" />
          <span className="muted text-[12px]">{tab === 'releases' ? 'Đọc từ CHANGELOG lúc build' : 'Lưu trên trình duyệt này, tối đa 20 dòng'}</span>
        </div>
        {tab === 'releases'
          ? build.releases.length === 0
            ? <p className="muted text-[13px] m-0">Chưa có ghi chú phiên bản.</p>
            : <ol className="flex flex-col list-none pl-0 m-0">{build.releases.map((r) => <Release key={r.version} r={r} current={r.version === build.version} />)}</ol>
          : <SeenList log={log} currentBuildId={build.buildId} />}
      </div>
    </>
  );
}
