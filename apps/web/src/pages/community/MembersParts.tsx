// Modal quản lý thành viên (760px, 4 tab): thông tin, khóa học, thanh toán, câu hỏi khi tham gia.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Modal, T, Tag } from '@hoiminh/ui';
import { Calendar, Clock, MessageCircle, QrCode, Trophy, Users, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { fmtDate, fmtDateTime, money, daysUntil } from '@/lib/format';
import { AnswersTab, CoursesTab, PaymentsTab, type MemberUser } from './MembersExtra';

export interface MemberDetail {
  member: { id: string; role: string; status: string; joinedAt: string; lastActiveAt: string | null; lifetimeValueCents: number; nextRenewalAt: string | null; lastPaymentAt: string | null; source: string };
  user: (MemberUser & { email: string }) | null;
  tier: { key: string; name: string } | null;
  subscription: { amountMinor: number; billingCycle: string; currentPeriodEnd: string; provider: string | null; status: string } | null;
  referrer: { name: string; handle: string } | null;
  courses: Array<{ id: string; title: string; accessMode: string; percent: number; completedLessons: number; totalLessons: number; manuallyUnlocked: boolean }>;
  payments: Array<{ orderId: string; at: string; amountMinor: number; status: string; method: string; provider: string; title: string }>;
  answers: Array<{ question: string; answer: string }>;
}

export function tierTone(key: string | null | undefined): 'gold' | 'dark' | 'neutral' {
  return key === 'premium' ? 'gold' : key === 'vip' ? 'dark' : 'neutral';
}
const ROLE_LABEL: Record<string, string> = { owner: 'Chủ hội', admin: 'Quản trị', moderator: 'Điều phối', member: 'Thành viên' };
const TABS = ['Thành viên', 'Khóa học', 'Thanh toán', 'Câu hỏi khi tham gia'] as const;

export function MemberModal({ communityId, memberId, onClose, onMessage }: { communityId: string; memberId: string; onClose: () => void; onMessage: (u: MemberUser) => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Thành viên');
  const key = ['member', communityId, memberId];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<MemberDetail>(`/v1/communities/${communityId}/members/${memberId}`) });
  const d = q.data;
  return (
    <Modal open onClose={onClose} width={760}>
      <div className="flex items-center gap-3.5 px-6 py-4" style={{ borderBottom: `1px solid ${T.line}` }}>
        <Avatar name={d?.user?.name} src={d?.user?.avatarUrl} color={d?.user?.coverColor} size={44} />
        <div className="flex-grow min-w-0"><div className="font-semibold text-[16px] truncate">{d?.user?.name ?? '…'}</div><div className="muted text-[13px]">Quản lý thành viên</div></div>
        <button type="button" aria-label="Đóng" onClick={onClose} style={{ color: T.ink3 }}>✕</button>
      </div>
      <div className="flex flex-col md:flex-row" style={{ minHeight: 420 }}>
        <div className="flex md:flex-col gap-0.5 p-3 overflow-x-auto md:overflow-visible flex-shrink-0" style={{ width: undefined, borderRight: `1px solid ${T.line}` }}>
          {TABS.map((t) => <button key={t} type="button" onClick={() => setTab(t)} className="text-left rounded-[10px] px-3 py-2.5 whitespace-nowrap md:w-[176px]" style={tab === t ? { background: T.goldSoft, fontWeight: 600 } : { color: T.ink2 }}>{t}</button>)}
        </div>
        <div className="flex-grow min-w-0 px-5 md:px-7 py-6 flex flex-col gap-3.5">
          <QueryState q={q} rows={2}>
            {(data) => tab === 'Thành viên' ? <InfoTab d={data} communityId={communityId} memberId={memberId} onClose={onClose} onMessage={onMessage} /> : tab === 'Khóa học' ? <CoursesTab d={data} communityId={communityId} memberId={memberId} /> : tab === 'Thanh toán' ? <PaymentsTab d={data} /> : <AnswersTab d={data} />}
          </QueryState>
        </div>
      </div>
    </Modal>
  );
}

function InfoTab({ d, communityId, memberId, onClose, onMessage }: { d: MemberDetail; communityId: string; memberId: string; onClose: () => void; onMessage: (u: MemberUser) => void }) {
  const qc = useQueryClient();
  const [editRole, setEditRole] = useState(false);
  const [editTier, setEditTier] = useState(false);
  const invalidate = () => { void qc.invalidateQueries({ queryKey: ['member', communityId, memberId] }); void qc.invalidateQueries({ queryKey: ['members', communityId] }); };
  const patch = useMutation({ mutationFn: (body: { role?: string; tierKey?: string }) => api.patch(`/v1/communities/${communityId}/members/${memberId}`, body), onSuccess: () => { invalidate(); setEditRole(false); setEditTier(false); } });
  const act = useMutation({ mutationFn: (action: string) => api.post(`/v1/communities/${communityId}/members/${memberId}/actions`, { action }), onSuccess: () => { invalidate(); onClose(); } });
  const doAction = (action: string, confirmText: string) => { if (window.confirm(confirmText)) act.mutate(action); };
  const m = d.member;
  const sub = d.subscription;
  const renew = sub ? daysUntil(sub.currentPeriodEnd) : null;
  const last = d.payments[0];
  const isOwner = m.role === 'owner';
  const err = patch.error ?? act.error;
  const row = (icon: ReactNode, text: ReactNode) => <div className="flex items-center gap-2.5" style={{ color: T.ink2 }}>{icon}<span className="min-w-0 truncate">{text}</span></div>;
  return (
    <>
      <div className="grid text-[14px]" style={{ gridTemplateColumns: '120px 1fr', rowGap: 12, columnGap: 12 }}>
        <span className="muted">Email</span><span className="truncate">{d.user?.email ?? '—'}</span>
        <span className="muted">Vai trò</span>
        <span className="inline-flex items-center gap-2 flex-wrap">
          {editRole && !isOwner ? <select className="input" style={{ height: 32, width: 180 }} defaultValue={m.role} onChange={(e) => patch.mutate({ role: e.target.value })}><option value="member">Thành viên</option><option value="moderator">Điều phối</option><option value="admin">Quản trị</option></select> : <>{ROLE_LABEL[m.role] ?? m.role}{!isOwner && <a href="#" onClick={(e) => { e.preventDefault(); setEditRole(true); }}>(đổi)</a>}</>}
        </span>
        <span className="muted">Gói</span>
        <span className="inline-flex items-center gap-2 flex-wrap">
          {editTier && !isOwner ? <select className="input" style={{ height: 32, width: 180 }} defaultValue={d.tier?.key ?? 'standard'} onChange={(e) => patch.mutate({ tierKey: e.target.value })}><option value="standard">Tiêu chuẩn</option><option value="premium">Premium</option><option value="vip">VIP</option></select> : <><Tag tone={tierTone(d.tier?.key)}>{d.tier?.name ?? 'Miễn phí'}</Tag>{!isOwner && <a href="#" onClick={(e) => { e.preventDefault(); setEditTier(true); }}>(đổi)</a>}</>}
        </span>
      </div>
      <div className="grid-2 text-[14px] pt-3.5" style={{ borderTop: `1px solid ${T.line}`, gap: 12 }}>
        {row(<Calendar size={18} />, `Tham gia ${fmtDate(m.joinedAt)}`)}
        {row(<Wallet size={18} />, sub ? `${money(sub.amountMinor)}/${sub.billingCycle === 'yearly' ? 'năm' : sub.billingCycle === 'one_time' ? 'một lần' : 'tháng'}${sub.provider ? ` · qua ${sub.provider}` : ''}` : 'Chưa trả phí')}
        {row(<Clock size={18} />, renew !== null ? `Gia hạn sau ${Math.max(0, renew)} ngày` : 'Không có kỳ gia hạn')}
        {row(<Trophy size={18} />, `Giá trị trọn đời ${money(m.lifetimeValueCents)}`)}
        {row(<Users size={18} />, d.referrer ? `Giới thiệu bởi ${d.referrer.name}` : `Nguồn: ${m.source === 'affiliate' ? 'cộng sự' : m.source === 'invite' ? 'lời mời' : m.source === 'discovery' ? 'khám phá' : 'trực tiếp'}`)}
        {row(<QrCode size={18} />, last ? `Lần cuối: ${fmtDateTime(last.at)} · ${money(last.amountMinor)} · ${last.status === 'paid' ? 'thành công' : last.status}` : 'Chưa có giao dịch')}
      </div>
      <div className="flex-grow" />
      {err && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(err)}</div>}
      {!isOwner && (
        <div className="flex gap-2 flex-wrap pt-3.5" style={{ borderTop: `1px solid ${T.line}` }}>
          {m.status === 'pending' && <Button size="sm" variant="primary" loading={act.isPending} onClick={() => act.mutate('approve')}>Duyệt</Button>}
          {m.status === 'banned' ? <Button size="sm" loading={act.isPending} onClick={() => doAction('unban', 'Bỏ chặn thành viên này?')}>Bỏ chặn</Button> : (
            <>
              <Button size="sm" loading={act.isPending} onClick={() => doAction('remove', 'Xóa thành viên khỏi nhóm? Lịch sử thanh toán được giữ lại.')}>Xóa khỏi nhóm</Button>
              <Button size="sm" loading={act.isPending} onClick={() => doAction('ban', 'Chặn thành viên này? Họ sẽ không vào lại được hội.')}>Chặn</Button>
              {sub && sub.status === 'active' && <Button size="sm" style={{ color: T.accentText }} loading={act.isPending} onClick={() => doAction('cancel_subscription', 'Hủy đăng ký của thành viên? Gói hết hạn cuối kỳ hiện tại.')}>Hủy đăng ký</Button>}
            </>
          )}
          <span className="flex-grow" />
          {d.user && <Button size="sm" variant="dark" icon={<MessageCircle size={14} />} onClick={() => onMessage(d.user!)}>Nhắn tin</Button>}
        </div>
      )}
    </>
  );
}
