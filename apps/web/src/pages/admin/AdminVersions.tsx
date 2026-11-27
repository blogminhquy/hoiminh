// Hệ thống · Phiên bản: bản trình duyệt đang chạy, danh sách bản đã tải lên Cloudflare kèm nút "Cập nhật"
// (đưa bản đó lên chạy cho mọi người, chọn bản cũ hơn là quay lui), và lịch sử phiên bản từ CHANGELOG.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Modal, T, Tag } from '@hoiminh/ui';
import { Check, ExternalLink, RefreshCw, Rocket, RotateCcw } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import { applyUpdate, commitUrl, deployWorkflowUrl, useVersionStatus, type ReleaseNote } from '@/lib/version';

interface ReleaseVersion { id: string; number: number | null; tag: string | null; message: string | null; createdAt: string | null; source: string | null; live: boolean }
interface ReleaseState { configured: boolean; script: string; liveVersionId: string | null; liveSince: string | null; versions: ReleaseVersion[] }

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 text-[15px]">
      <span className="flex-shrink-0 muted" style={{ width: 110 }}>{label}</span>
      <span className="min-w-0 flex-grow break-words">{children}</span>
    </div>
  );
}

/** Bản trình duyệt của admin đang chạy so với bản Cloudflare đang phục vụ. */
function BrowserCard() {
  const { build, deployed, updateAvailable, stuck, checking, checkNow, update } = useVersionStatus();
  const commit = commitUrl(build);
  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="serif m-0 text-[20px] font-bold">Bản đang chạy</h2>
        <span className="flex-grow" />
        <Button size="sm" icon={<RefreshCw size={15} className={checking ? 'animate-spin' : undefined} />} onClick={checkNow} disabled={checking}>Kiểm tra</Button>
      </div>
      <Row label="Phiên bản"><b>v{build.version}</b> · {commit ? <a href={commit} target="_blank" rel="noreferrer" style={{ color: T.tealText }}>{build.shortCommit}</a> : build.shortCommit}</Row>
      {build.branch && <Row label="Nhánh">{build.branch}</Row>}
      <Row label="Dựng lúc">{fmtDateTime(build.buildTime)}</Row>
      {build.commitMessage && <Row label="Thay đổi">{build.commitMessage}</Row>}
      <Row label="Máy chủ">
        {checking && !deployed ? 'đang kiểm tra…'
          : !deployed ? 'chưa đọc được /version.json'
          : updateAvailable ? <b style={{ color: T.accentText }}>đã có v{deployed.version} · {deployed.shortCommit}</b>
          : <span style={{ color: T.tealText }}>trình duyệt đang dùng bản mới nhất</span>}
      </Row>
      {updateAvailable && (
        <div className="flex items-center gap-3 flex-wrap pt-1">
          <Button variant="primary" icon={<Rocket size={16} />} onClick={update}>Tải bản mới cho trình duyệt này</Button>
          <span className="muted text-[14px]">Người dùng khác tự nhận bản mới ở lần chuyển trang kế tiếp.</span>
        </div>
      )}
      {stuck && <p className="m-0 text-[14px] p-3 rounded-[10px]" style={{ background: T.accentSoft, color: T.accentText }}>Nạp lại rồi mà vẫn là bản cũ: trình duyệt đang giữ cache. Nhấn Ctrl+F5 (hoặc Cmd+Shift+R) để tải lại cứng.</p>}
    </div>
  );
}

function versionLabel(v: ReleaseVersion): string {
  return v.tag ?? (v.number != null ? `Bản #${v.number}` : v.id.slice(0, 8));
}

/** Danh sách bản đã tải lên Cloudflare, bấm để đưa lên chạy. */
function ReleasesCard() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['admin', 'releases'], queryFn: () => api.get<ReleaseState>('/v1/admin/releases'), refetchInterval: 60_000 });
  const [pick, setPick] = useState<ReleaseVersion | null>(null);
  const deploy = useMutation({
    mutationFn: (id: string) => api.post<ReleaseState>(`/v1/admin/releases/${id}/deploy`),
    onSuccess: (data) => {
      qc.setQueryData(['admin', 'releases'], data);
      setPick(null);
      // Cloudflare cần vài giây để bản mới lan ra; sau đó hỏi lại /version.json.
      window.setTimeout(() => void qc.invalidateQueries({ queryKey: ['app-version'] }), 5_000);
    },
  });
  const workflow = deployWorkflowUrl();
  const liveIdx = q.data?.versions.findIndex((v) => v.live) ?? -1;

  return (
    <div className="card p-5 flex flex-col gap-3">
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="serif m-0 text-[20px] font-bold">Phát hành</h2>
        <span className="flex-grow" />
        {workflow && <a href={workflow} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[14px]" style={{ color: T.tealText }}><ExternalLink size={14} />GitHub Actions</a>}
      </div>
      <QueryState q={q} rows={4}>
        {(d) => !d.configured ? (
          <div className="text-[15px] leading-[1.6] flex flex-col gap-2">
            <p className="m-0">Chưa bật phát hành thủ công. Hiện mỗi lần đẩy code lên <code>main</code> thì web tự lên bản mới.</p>
            <p className="m-0 muted">Để admin tự bấm cập nhật:</p>
            <ol className="m-0 pl-5 flex flex-col gap-1 list-decimal">
              <li>Tạo token Cloudflare chỉ có quyền <b>Workers Scripts: Edit</b>.</li>
              <li>Đặt secret cho Worker API: <code>wrangler secret put CF_RELEASE_API_TOKEN</code> và <code>CF_RELEASE_ACCOUNT_ID</code>.</li>
              <li>Trong GitHub → Settings → Variables, đặt <code>RELEASE_MODE=manual</code>. Từ đó CI chỉ tải bản mới lên, chờ admin bấm ở đây.</li>
            </ol>
          </div>
        ) : d.versions.length === 0 ? <p className="m-0 muted text-[15px]">Chưa có phiên bản nào trên Cloudflare.</p> : (
          <ol className="m-0 p-0 list-none flex flex-col">
            {d.versions.map((v, i) => {
              const newer = liveIdx === -1 || i < liveIdx;
              return (
                <li key={v.id} className="flex items-start gap-3 py-3" style={{ borderTop: i ? `1px solid ${T.line}` : undefined }}>
                  <div className="min-w-0 flex-grow">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="text-[16px]">{versionLabel(v)}</b>
                      {v.live && <Tag tone="teal">Đang chạy</Tag>}
                      {!v.live && newer && <Tag tone="accent">Bản mới</Tag>}
                    </div>
                    {v.message && <div className="text-[15px] mt-0.5 break-words">{v.message}</div>}
                    <div className="muted text-[14px] mt-0.5">{v.createdAt ? fmtDateTime(v.createdAt) : ''}{v.source ? ` · ${v.source}` : ''}</div>
                  </div>
                  {v.live ? <Check size={20} style={{ color: T.teal, marginTop: 4 }} /> : (
                    <Button size="sm" variant={newer ? 'primary' : 'ghost'} icon={newer ? <Rocket size={15} /> : <RotateCcw size={15} />} onClick={() => setPick(v)}>
                      {newer ? 'Cập nhật' : 'Quay lui'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </QueryState>

      <Modal
        open={Boolean(pick)}
        onClose={() => { if (!deploy.isPending) { setPick(null); deploy.reset(); } }}
        title={pick ? `Đưa ${versionLabel(pick)} lên chạy?` : ''}
        width={480}
        footer={pick && (
          <div className="flex justify-end gap-2">
            <Button onClick={() => { setPick(null); deploy.reset(); }} disabled={deploy.isPending}>Hủy</Button>
            <Button variant="primary" loading={deploy.isPending} onClick={() => deploy.mutate(pick.id)}>Đồng ý cập nhật</Button>
          </div>
        )}
      >
        <div className="text-[15px] leading-[1.6] flex flex-col gap-2">
          <p className="m-0">Toàn bộ người dùng sẽ nhận bản này ở lần chuyển trang kế tiếp. Có thể quay lui về bản trước bất cứ lúc nào ở cùng danh sách.</p>
          {pick?.message && <p className="m-0 muted">{pick.message}</p>}
          {deploy.error && <p className="m-0" style={{ color: T.accentText }}>{(deploy.error as Error).message}</p>}
        </div>
      </Modal>
    </div>
  );
}

function ReleaseItem({ r, open, onToggle }: { r: ReleaseNote; open: boolean; onToggle: () => void }) {
  const count = r.sections.reduce((n, sec) => n + sec.items.length, 0);
  return (
    // overflow-wrap: anywhere: chuỗi dài không có khoảng trắng (tên migration, tên chỉ mục) vẫn xuống dòng, không làm trang tràn ngang trên điện thoại.
    <section className="flex flex-col gap-1.5 pt-3 [overflow-wrap:anywhere]" style={{ borderTop: `1px solid ${T.line}` }}>
      <div className="flex items-baseline gap-2"><b className="text-[17px]">v{r.version}</b>{r.date && <span className="muted text-[14px]">{r.date}</span>}</div>
      {r.summary && <p className="m-0 text-[15px] leading-[1.6]">{r.summary}</p>}
      {count > 0 && <button type="button" className="self-start text-[14px] font-semibold" style={{ color: T.tealText }} onClick={onToggle}>{open ? 'Ẩn chi tiết' : `Xem ${count} thay đổi`}</button>}
      {open && r.sections.map((sec, i) => (
        <div key={i}>
          {sec.title && <div className="text-[13px] font-semibold uppercase tracking-wide muted mt-1">{sec.title}</div>}
          <ul className="m-0 pl-5 flex flex-col gap-0.5 list-disc">{sec.items.map((it, j) => <li key={j} className="text-[15px] leading-[1.6]" style={{ color: T.ink2 }}>{it}</li>)}</ul>
        </div>
      ))}
    </section>
  );
}

function ChangelogCard({ releases }: { releases: ReleaseNote[] }) {
  const [openVer, setOpenVer] = useState<string | null>(null);
  return (
    <div className="card p-5 flex flex-col gap-3">
      <h2 className="serif m-0 text-[20px] font-bold">Lịch sử phiên bản</h2>
      {releases.length === 0 ? <p className="m-0 muted text-[15px]">Chưa có ghi chú phiên bản.</p> : releases.map((r) => (
        <ReleaseItem key={r.version} r={r} open={openVer === r.version} onToggle={() => setOpenVer((v) => (v === r.version ? null : r.version))} />
      ))}
    </div>
  );
}

export default function Page() {
  const { build } = useVersionStatus();
  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 880 }}>
      <div>
        <h1 className="serif m-0 text-[28px] font-extrabold">Phiên bản</h1>
        <p className="muted m-0 mt-1 text-[15px]">Xem bản đang chạy, đưa bản mới lên cho mọi người hoặc quay lui khi có lỗi.</p>
      </div>
      <BrowserCard />
      <ReleasesCard />
      <ChangelogCard releases={build.releases} />
      <p className="muted text-[14px] m-0">Tải lại sạch trình duyệt này: <button type="button" className="underline" onClick={() => void applyUpdate()}>xóa cache và nạp lại</button></p>
    </div>
  );
}
