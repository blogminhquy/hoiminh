// Cài đặt · Bảng tin (feedSettingsMain): tab hiển thị, chuyên mục (tên, ai được đăng, số bài), bắt buộc chuyên mục, duyệt bài thành viên mới.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, SaveBar, Select, T, Toggle } from '@hoiminh/ui';
import { Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { shellKey, useShell } from '@/lib/community';

type Perm = 'everyone' | 'admins_only' | 'premium';
interface Space { id?: string; name: string; postPermission: Perm; sortOrder: number; postCount?: number }
interface Feed { tabs: Record<string, boolean>; requireSpace: boolean; moderateNewMembersDays: number; spaces: Space[] }
const TABS: Array<[string, string, boolean]> = [['feed', 'Bảng tin', true], ['courses', 'Khóa học', false], ['events', 'Sự kiện', false], ['members', 'Thành viên', false], ['affiliate', 'Xếp hạng cộng sự', false], ['store', 'Cửa hàng', false], ['about', 'Giới thiệu', true], ['resources', 'Tài nguyên', false]];
const PERM: Array<[Perm, string]> = [['admins_only', 'Chỉ quản trị'], ['everyone', 'Mọi thành viên'], ['premium', 'Thành viên Premium']];

export default function Page() {
  const shell = useShell();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['feed-settings', shell.community.id], queryFn: () => api.get<Feed>(`/v1/communities/${shell.community.id}/feed-settings`) });
  const [f, setF] = useState<Feed | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (q.data && !f) setF(q.data); }, [q.data, f]);
  const save = useMutation({
    mutationFn: () => api.put<Feed>(`/v1/communities/${shell.community.id}/feed-settings`, { tabs: f?.tabs, requireSpace: f?.requireSpace, moderateNewMembersDays: f?.moderateNewMembersDays, spaces: f?.spaces.filter((s) => s.name.trim()).map((s, i) => ({ id: s.id, name: s.name.trim(), postPermission: s.postPermission, sortOrder: i })) }),
    onSuccess: (d) => { setF(d); setSaved(true); setTimeout(() => setSaved(false), 2000); void qc.invalidateQueries({ queryKey: shellKey(shell.community.slug) }); void qc.invalidateQueries({ queryKey: ['feed-settings'] }); },
  });
  if (!f) return <LoadingBlock rows={4} />;
  const patch = (p: Partial<Feed>) => setF({ ...f, ...p });
  const setSpace = (i: number, p: Partial<Space> | null) => patch({ spaces: p === null ? f.spaces.filter((_, j) => j !== i) : f.spaces.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const cols = '24px 1.6fr 1.2fr 80px 32px';
  return (
    <>
      <SaveBar title="Bảng tin" sub="Tab, chuyên mục và quyền đăng bài" saving={save.isPending} saved={saved} onSave={() => save.mutate()} onCancel={() => setF(null)} />
      {save.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</div>}
      <div className="card flex flex-col gap-2.5" style={{ padding: '20px 24px' }}>
        <span className="font-semibold">Tab hiển thị</span>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: '8px 32px' }}>
          {TABS.map(([k, l, lock]) => <div key={k} className="flex items-center gap-2.5 text-[14px] py-1.5"><span className="flex-grow">{l}</span>{lock ? <span className="muted text-[12px]">luôn bật</span> : <Toggle on={f.tabs[k] ?? false} onChange={(v) => patch({ tabs: { ...f.tabs, [k]: v } })} />}</div>)}
        </div>
      </div>
      <div className="card overflow-hidden">
        <div className="flex items-center px-5 py-4"><span className="font-semibold">Chuyên mục</span><span className="flex-grow" /><Button size="sm" onClick={() => patch({ spaces: [...f.spaces, { name: '', postPermission: 'everyone', sortOrder: f.spaces.length }] })}><Plus size={14} />Thêm chuyên mục</Button></div>
        <div className="table-scroll">
          <div className="grid gap-3 px-4 pb-2" style={{ gridTemplateColumns: cols, minWidth: 520 }}><span /><span className="th">Tên</span><span className="th">Ai được đăng</span><span className="th">Số bài</span><span /></div>
          {f.spaces.map((s, i) => (
            <div key={s.id ?? `new-${i}`} className="grid items-center gap-3 px-4 py-2.5" style={{ gridTemplateColumns: cols, minWidth: 520, borderTop: `1px solid ${T.line}` }}>
              <span className="muted text-[12px]">{i + 1}</span>
              <input value={s.name} maxLength={40} onChange={(e) => setSpace(i, { name: e.target.value })} className="font-medium bg-transparent min-w-0" placeholder="Tên chuyên mục" />
              <Select value={s.postPermission} onChange={(e) => setSpace(i, { postPermission: e.target.value as Perm })} style={{ height: 30, fontSize: 12, width: 'fit-content' }}>{PERM.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select>
              <span className="muted text-[13px]">{s.postCount ?? 0} bài</span>
              <button type="button" aria-label="Xóa" disabled={(s.postCount ?? 0) > 0} title={(s.postCount ?? 0) > 0 ? 'Chuyên mục còn bài, không xóa được' : undefined} onClick={() => setSpace(i, null)} style={{ color: T.ink3, opacity: (s.postCount ?? 0) > 0 ? 0.3 : 1 }}><X size={16} /></button>
            </div>
          ))}
        </div>
      </div>
      <div className="card flex flex-col gap-3" style={{ padding: '20px 24px' }}>
        <div className="flex items-center gap-2.5"><span className="font-semibold flex-grow">Bắt buộc chọn chuyên mục khi đăng</span><Toggle on={f.requireSpace} onChange={(requireSpace) => patch({ requireSpace })} /></div>
        <div className="flex items-center gap-2.5"><span className="font-semibold flex-grow">Duyệt bài của thành viên mới trong 7 ngày đầu</span><Toggle on={f.moderateNewMembersDays > 0} onChange={(v) => patch({ moderateNewMembersDays: v ? 7 : 0 })} /></div>
      </div>
    </>
  );
}
