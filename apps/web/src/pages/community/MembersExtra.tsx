// Tab Khóa học / Thanh toán / Câu hỏi của modal thành viên, modal nhắn tin, và danh bạ cho thành viên thường.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Empty, Modal, Prog, StatusTag, T, Tag, Textarea } from '@hoiminh/ui';
import { Search, Send } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { fmtDateTime, money, timeAgo } from '@/lib/format';
import type { MemberDetail } from './MembersParts';

export interface MemberUser { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null }

export function CoursesTab({ d, communityId, memberId }: { d: MemberDetail; communityId: string; memberId: string }) {
  const qc = useQueryClient();
  const grant = useMutation({ mutationFn: (courseId: string) => api.post(`/v1/communities/${communityId}/members/${memberId}/grant-course`, { courseId }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['member', communityId, memberId] }) });
  if (!d.courses.length) return <Empty title="Hội chưa có khóa học nào" />;
  return (
    <div className="flex flex-col gap-3">
      {d.courses.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 p-3.5 rounded-[12px]" style={{ background: T.bg }}>
          <div className="flex items-center gap-2">
            <span className="font-semibold flex-grow min-w-0 truncate">{c.title}</span>
            {c.manuallyUnlocked ? <Tag tone="teal">Đã mở thủ công</Tag> : <Button size="sm" loading={grant.isPending && grant.variables === c.id} onClick={() => grant.mutate(c.id)}>Mở khóa thủ công</Button>}
          </div>
          <div className="flex items-center gap-3 text-[12px]" style={{ color: T.ink2 }}>
            <Prog value={c.percent} className="flex-grow" />
            <span className="whitespace-nowrap">{c.completedLessons}/{c.totalLessons} bài · {c.percent}%</span>
          </div>
        </div>
      ))}
      {grant.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(grant.error)}</div>}
    </div>
  );
}

export function PaymentsTab({ d }: { d: MemberDetail }) {
  if (!d.payments.length) return <Empty title="Chưa có giao dịch" hint="Thành viên chưa thanh toán gì trong hội này" />;
  return (
    <div className="table-scroll">
      <div className="grid text-[13px]" style={{ gridTemplateColumns: '1.1fr 2fr 1fr 1fr 1fr', gap: 12, minWidth: 460 }}>
        <span className="th">Ngày</span><span className="th">Sản phẩm</span><span className="th">Phương thức</span><span className="th">Số tiền</span><span className="th">Trạng thái</span>
        {d.payments.map((p) => (
          <div key={p.orderId} className="contents">
            <span className="muted py-2" style={{ borderTop: `1px solid ${T.line}` }}>{fmtDateTime(p.at)}</span>
            <span className="py-2 truncate" style={{ borderTop: `1px solid ${T.line}` }}>{p.title}</span>
            <span className="muted py-2" style={{ borderTop: `1px solid ${T.line}` }}>{p.provider || p.method || '—'}</span>
            <span className="py-2 font-semibold" style={{ borderTop: `1px solid ${T.line}` }}>{money(p.amountMinor)}</span>
            <span className="py-2" style={{ borderTop: `1px solid ${T.line}` }}><StatusTag status={p.status} /></span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnswersTab({ d }: { d: MemberDetail }) {
  if (!d.answers.length) return <Empty title="Không có câu trả lời" hint="Hội chưa đặt câu hỏi khi tham gia, hoặc thành viên vào trước khi có câu hỏi" />;
  return (
    <div className="flex flex-col gap-3">
      {d.answers.map((a, i) => (
        <div key={i} className="flex flex-col gap-1 p-3.5 rounded-[12px]" style={{ background: T.bg }}>
          <span className="muted text-[12px] font-semibold">{a.question}</span>
          <span className="text-[14px]">{a.answer || '—'}</span>
        </div>
      ))}
    </div>
  );
}

/** Nhắn tin riêng cho một thành viên (POST /v1/me/messages). */
export function MessageModal({ open, onClose, communityId, user }: { open: boolean; onClose: () => void; communityId: string; user: MemberUser | null }) {
  const [body, setBody] = useState('');
  const m = useMutation({ mutationFn: () => api.post(`/v1/me/messages`, { recipientUserId: user?.id, communityId, body: body.trim() }), onSuccess: () => { setBody(''); onClose(); } });
  if (!open || !user) return null;
  return (
    <Modal open onClose={onClose} title={`Nhắn tin cho ${user.name}`} width={520}>
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2.5"><Avatar name={user.name} src={user.avatarUrl} color={user.coverColor} size={32} /><span className="font-semibold">{user.name}</span><span className="muted text-[12px]">@{user.handle}</span></div>
        <Textarea rows={4} placeholder="Viết tin nhắn…" value={body} onChange={(e) => setBody(e.target.value)} />
        {m.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}
        <div className="flex gap-2 justify-end"><Button size="sm" onClick={onClose}>Hủy</Button><Button size="sm" variant="primary" icon={<Send size={14} />} loading={m.isPending} disabled={!body.trim()} onClick={() => m.mutate()}>Gửi</Button></div>
      </div>
    </Modal>
  );
}

interface DirectoryItem { id: string; role: string; level: number; joinedAt: string; lastActiveAt: string | null; user: MemberUser & { bio: string | null }; tier: { key: string; name: string } | null }

/** Danh bạ thành viên (không có quyền quản lý): lưới thẻ, bấm vào hồ sơ. */
export function Directory({ communityId }: { communityId: string }) {
  const [q, setQ] = useState('');
  const query = useQuery({ queryKey: ['directory', communityId, q], queryFn: () => api.get<DirectoryItem[]>(`/v1/communities/${communityId}/members/directory${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`) });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="serif m-0 text-[28px] font-bold page-title">Thành viên</h1>
      <label className="input" style={{ maxWidth: 380 }}><Search size={18} style={{ color: T.ink3 }} /><input placeholder="Tìm theo tên, @tên…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
      <QueryState q={query} isEmpty={(d) => d.length === 0} empty={{ title: 'Không tìm thấy thành viên', hint: 'Thử từ khóa khác' }}>
        {(items) => (
          <div className="grid-3">
            {items.map((m) => (
              <Link key={m.id} to={`/u/${m.user.handle}`} className="card p-4 flex items-center gap-3" style={{ color: T.ink }}>
                <Avatar name={m.user.name} src={m.user.avatarUrl} color={m.user.coverColor} size={44} />
                <span className="min-w-0 flex-grow">
                  <span className="block font-semibold truncate">{m.user.name}</span>
                  <span className="block muted text-[12px] truncate">{m.user.bio || `@${m.user.handle}`}</span>
                  <span className="block muted text-[11px]">{m.lastActiveAt ? `Hoạt động ${timeAgo(m.lastActiveAt)}` : 'Chưa hoạt động'}</span>
                </span>
                {(m.role === 'owner' || m.role === 'admin') ? <Tag tone="accent">{m.role === 'owner' ? 'Chủ hội' : 'Quản trị'}</Tag> : m.tier?.key === 'premium' ? <Tag tone="gold">Premium</Tag> : m.tier?.key === 'vip' ? <Tag tone="dark">VIP</Tag> : null}
              </Link>
            ))}
          </div>
        )}
      </QueryState>
    </div>
  );
}
