// Hội của tôi (wsHomeMain): tiêu đề + nút Tạo hội, lưới hội làm chủ (kèm gói của từng hội), hội tham gia + thẻ gói của các hội, đội ngũ.
// Không còn dùng thử: hội đầu tiên của tài khoản miễn phí vĩnh viễn, hội thứ hai trở đi chọn gói trả phí khi tạo.
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { HoiCard, JoinedCard, TeamCard, WS_HOME_KEY, type WorkspaceHome } from './WorkspaceHomeParts';
import { PlanCard } from './WorkspacePlanCard';

export default function Page() {
  const { user } = useAuth();
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
            {d.owned.length > 0 ? (
              <div className="grid-3">{d.owned.map((c) => <HoiCard key={c.id} c={c} role={roleOf(c)} />)}</div>
            ) : (
              <div className="card p-6 text-center flex flex-col items-center gap-2">
                <div className="font-semibold">Bạn chưa có hội nào</div>
                <div className="muted text-[13px]">Tạo hội đầu tiên trong 2 phút, {ownerName ? `${ownerName} ` : ''}mọi thứ đổi được sau. Hội đầu tiên miễn phí, dùng vĩnh viễn, không cần thẻ.</div>
                <Link to="/admin/tao-hoi" className="btn btn-dark btn-sm mt-1">Tạo hội của bạn</Link>
              </div>
            )}
            <div className="flex gap-5 flex-col md:flex-row">
              <JoinedCard items={d.joined} />
              <PlanCard d={d} />
            </div>
            {d.workspace && <TeamCard team={d.team} workspaceId={d.workspace.id} canInvite={d.workspace.ownerUserId === user?.id} />}
          </>
        );
      }}
    </QueryState>
  );
}
