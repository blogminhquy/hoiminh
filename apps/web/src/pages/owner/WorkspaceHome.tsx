// Hội của tôi (wsHomeMain): tiêu đề + nút Tạo hội, lưới hội làm chủ, hội tham gia + gói nền tảng, đội ngũ.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, T } from '@hoiminh/ui';
import { Plus } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { HoiCard, JoinedCard, TeamCard, WS_HOME_KEY, type WorkspaceHome } from './WorkspaceHomeParts';
import { PlanCard } from './WorkspacePlanCard';

function StartTrial() {
  const qc = useQueryClient();
  const m = useMutation({ mutationFn: () => api.post('/v1/me/workspace', {}), onSuccess: () => qc.invalidateQueries({ queryKey: WS_HOME_KEY }) });
  return (
    <div className="card flex flex-col gap-3 p-6" style={{ background: T.ink, color: T.surface, borderColor: T.ink }}>
      <div className="serif text-[22px] font-extrabold">Bắt đầu 14 ngày dùng thử</div>
      <div className="text-[13px]" style={{ color: T.sideText }}>Không cần thẻ. Tạo hội, đăng khóa học, nhận thanh toán qua chuyển khoản, MoMo, VNPAY, không phí giao dịch.</div>
      {m.isError && <div className="text-[13px]" style={{ color: T.accent }}>{errorMessage(m.error)}</div>}
      <div><Button variant="primary" loading={m.isPending} onClick={() => m.mutate()}>Kích hoạt dùng thử</Button></div>
    </div>
  );
}

export default function Page() {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const q = useQuery({ queryKey: WS_HOME_KEY, queryFn: () => api.get<WorkspaceHome>('/v1/me/workspace') });
  return (
    <QueryState q={q} rows={4}>
      {(d) => {
        const ownerName = user?.name ?? '';
        const roleOf = (c: WorkspaceHome['owned'][number]) => (d.workspace?.ownerUserId === user?.id && c.workspaceId === d.workspace?.id ? 'Chủ hội' : 'Quản trị');
        return (
          <>
            <div className="flex items-end gap-4 flex-wrap">
              <div>
                <h1 className="serif m-0 text-[32px] font-extrabold">Hội của tôi</h1>
                <div className="muted">{d.owned.length} hội bạn làm chủ · {d.joined.length} hội bạn tham gia</div>
              </div>
              <span className="flex-grow" />
              <Link to="/admin/tao-hoi" className="btn btn-primary"><Plus size={18} /> Tạo hội của bạn</Link>
            </div>
            {!d.workspace && <StartTrial />}
            {d.owned.length > 0 ? (
              <div className="grid-3">{d.owned.map((c) => <HoiCard key={c.id} c={c} role={roleOf(c)} />)}</div>
            ) : (
              <div className="card p-6 text-center flex flex-col items-center gap-2">
                <div className="font-semibold">Bạn chưa có hội nào</div>
                <div className="muted text-[13px]">Tạo hội đầu tiên trong 2 phút, {ownerName ? `${ownerName} ` : ''}mọi thứ đổi được sau.</div>
                <Link to="/admin/tao-hoi" className="btn btn-dark btn-sm mt-1">Tạo hội của bạn</Link>
              </div>
            )}
            <div className="flex gap-5 flex-col md:flex-row">
              <JoinedCard items={d.joined} />
              <PlanCard d={d} autoOpen={pathname === '/admin/goi'} />
            </div>
            {d.workspace && <TeamCard team={d.team} workspaceId={d.workspace.id} canInvite={d.workspace.ownerUserId === user?.id} />}
          </>
        );
      }}
    </QueryState>
  );
}
