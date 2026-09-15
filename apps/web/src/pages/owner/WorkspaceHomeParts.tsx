// Mảnh màn "Hội của tôi" (wsHomeMain trong build.mjs): kiểu dữ liệu, thẻ hội, hội tham gia, đội ngũ + modal mời quản trị.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, CommunityMark, Field, Input, Modal, Select, T } from '@hoiminh/ui';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { fmtCount, fmtDate, fmtShortMoney } from '@/lib/format';

export interface WorkspaceHome {
  workspace: { id: string; name: string; slug: string; planKey: string; status: string; trialEndsAt: string | null; contentLockedAt: string | null; ownerUserId: string } | null;
  platformSubscription: { id: string; planKey: string; status: 'trialing' | 'active' | 'past_due' | 'cancelled' | 'expired'; billingCycle: 'monthly' | 'yearly'; currentPeriodStart: string; currentPeriodEnd: string; cancelAtPeriodEnd: boolean } | null;
  owned: Array<{ id: string; workspaceId: string; name: string; slug: string; logoMark: string; logoColor: string; logoUrl: string | null; status: string; pricingMode: string; memberCount: number; paidMemberCount: number; revenue30Minor: number }>;
  joined: Array<{ id: string; name: string; slug: string; logoMark: string; logoColor: string; role: string; tier: { key: string; name: string } | null; nextRenewalAt: string | null }>;
  team: Array<{ id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null; role: string }>;
  totals: { communities: number; members: number };
}

export const WS_HOME_KEY = ['workspace-home'] as const;

const MODE_LABEL: Record<string, string> = { free: 'Miễn phí', freemium: 'Freemium', subscription: 'Thu phí', one_time: 'Trọn đời' };
const WS_ROLE: Record<string, string> = { owner: 'Chủ sở hữu', admin: 'Quản trị', editor: 'Biên tập' };

export function HoiCard({ c, role }: { c: WorkspaceHome['owned'][number]; role: string }) {
  const draft = c.status === 'draft';
  return (
    <div className="card flex flex-col gap-3.5 p-5">
      <div className="flex items-center gap-3">
        <CommunityMark mark={c.logoMark} color={c.logoColor} url={c.logoUrl} size={48} radius={14} />
        <div className="flex-grow min-w-0"><div className="font-bold text-[16px] truncate">{c.name}</div><div className="muted text-[12px]">hoiminh.vn/{c.slug}</div></div>
        {draft ? <span className="tag" style={{ background: T.bg, color: T.ink3 }}>Nháp</span> : <span className="tag" style={{ background: T.tealSoft, color: T.tealText }}>{MODE_LABEL[c.pricingMode] ?? c.pricingMode}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
        <div><div className="font-bold text-[18px]">{fmtCount(c.memberCount)}</div><div className="muted text-[12px]">Thành viên</div></div>
        <div><div className="font-bold text-[18px]">{fmtCount(c.paidMemberCount)}</div><div className="muted text-[12px]">Trả phí</div></div>
        <div><div className="font-bold text-[18px]">{fmtShortMoney(c.revenue30Minor)}</div><div className="muted text-[12px]">30 ngày</div></div>
      </div>
      <div className="flex items-center gap-2">
        <span className="tag" style={{ background: T.goldSoft, color: T.goldText }}>{role}</span>
        <span className="flex-grow" />
        <Link to={`/${c.slug}/cai-dat`} className="btn btn-ghost btn-sm">Cài đặt</Link>
        <Link to={`/${c.slug}/bang-tin`} className="btn btn-dark btn-sm">Vào hội</Link>
      </div>
    </div>
  );
}

export function JoinedCard({ items }: { items: WorkspaceHome['joined'] }) {
  const sub = (j: WorkspaceHome['joined'][number]) => {
    const tier = j.tier?.name ?? 'Thành viên';
    return j.nextRenewalAt ? `${tier} · gia hạn ${fmtDate(j.nextRenewalAt)}` : tier;
  };
  return (
    <div className="card flex flex-col gap-3 flex-[1.4_1_0]" style={{ padding: '20px 24px' }}>
      <div className="flex items-center"><span className="font-semibold">Hội bạn tham gia</span><span className="flex-grow" /><Link to="/kham-pha" className="text-[13px] font-semibold" style={{ color: T.teal }}>Khám phá thêm</Link></div>
      {items.length === 0 && <div className="muted text-[13px]">Bạn chưa tham gia hội nào khác.</div>}
      {items.map((j) => (
        <Link key={j.id} to={`/${j.slug}/bang-tin`} className="flex items-center gap-3 py-2.5" style={{ borderTop: `1px solid ${T.line}`, color: T.ink }}>
          <CommunityMark mark={j.logoMark} color={j.logoColor} size={36} radius={10} />
          <div className="flex-grow min-w-0"><div className="font-semibold truncate">{j.name}</div><div className="muted text-[12px]">{sub(j)}</div></div>
          <span className="tag" style={{ background: T.bg, color: T.ink2 }}>{j.role === 'member' ? 'Thành viên' : j.role === 'moderator' ? 'Điều hành' : 'Quản trị'}</span>
        </Link>
      ))}
    </div>
  );
}

function InviteTeamModal({ open, onClose, workspaceId }: { open: boolean; onClose: () => void; workspaceId: string }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'editor'>('admin');
  const m = useMutation({
    mutationFn: () => api.post<{ invited: boolean; reason?: string }>('/v1/me/workspace/team', { workspaceId, email, role }),
    onSuccess: (r) => { if (r.invited) { void qc.invalidateQueries({ queryKey: WS_HOME_KEY }); setEmail(''); } },
  });
  const note = m.isError ? errorMessage(m.error) : m.data ? (m.data.invited ? 'Đã thêm vào đội ngũ' : m.data.reason ?? 'Không mời được') : 'Người được mời cần có tài khoản Hội Mình';
  return (
    <Modal open={open} onClose={onClose} title="Mời người quản trị" width={480} footer={(
      <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.line}` }}>
        <span className="text-[12px] flex-grow" style={{ color: m.isError || (m.data && !m.data.invited) ? T.accentText : m.data?.invited ? T.tealText : T.ink3 }}>{note}</span>
        <Button size="sm" onClick={onClose}>Đóng</Button>
        <Button size="sm" variant="primary" loading={m.isPending} disabled={!email.trim()} onClick={() => m.mutate()}>Gửi lời mời</Button>
      </div>
    )}>
      <div className="p-5 flex flex-col gap-4">
        <Field label="Email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ban@email.com" /></Field>
        <Field label="Vai trò" hint={role === 'admin' ? 'Quản trị: toàn quyền cài đặt và thành viên mọi hội' : 'Biên tập: soạn bài, khóa học, sự kiện'}>
          <Select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'editor')}>
            <option value="admin">Quản trị</option>
            <option value="editor">Biên tập</option>
          </Select>
        </Field>
      </div>
    </Modal>
  );
}

export function TeamCard({ team, workspaceId, canInvite }: { team: WorkspaceHome['team']; workspaceId: string; canInvite: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="card flex flex-col gap-3" style={{ padding: '20px 24px' }}>
      <div className="flex items-center flex-wrap gap-2">
        <span className="font-semibold">Đội ngũ</span><span className="muted text-[13px] ml-2">dùng chung cho mọi hội của bạn</span>
        <span className="flex-grow" />
        {canInvite && <Button size="sm" icon={<UserPlus size={14} />} onClick={() => setOpen(true)}>Mời người quản trị</Button>}
      </div>
      <div className="flex gap-3 flex-wrap">
        {team.map((t) => (
          <Link key={t.id} to={`/u/${t.handle}`} className="flex items-center gap-2.5 rounded-[10px] flex-1 min-w-[200px]" style={{ padding: '10px 12px', background: T.bg, color: T.ink }}>
            <Avatar name={t.name} src={t.avatarUrl} color={t.coverColor} size={32} />
            <div><div className="font-semibold text-[13px]">{t.name}</div><div className="muted text-[12px]">{WS_ROLE[t.role] ?? t.role}</div></div>
          </Link>
        ))}
      </div>
      <InviteTeamModal open={open} onClose={() => setOpen(false)} workspaceId={workspaceId} />
    </div>
  );
}
