// Khu học tập (V2, mục 153): tất cả khóa học và sản phẩm số đã sở hữu, gom từ mọi hội, không cần là thành viên hội nào.
import { useQuery } from '@tanstack/react-query';
import { Chip, T } from '@hoiminh/ui';
import { GraduationCap, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CourseCard, DigitalCard, JoinSuggestion, type Library } from './LibraryParts';

type Filter = 'all' | 'in_progress' | 'completed';

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="serif text-[24px] font-extrabold leading-none">{n}</span>
      <span className="muted text-[12.5px]">{label}</span>
    </div>
  );
}

function Empty() {
  return (
    <div className="card flex flex-col items-center text-center gap-3" style={{ padding: '48px 24px' }}>
      <span className="inline-flex items-center justify-center rounded-full" style={{ width: 64, height: 64, background: T.goldSoft, color: T.goldText }}><GraduationCap size={30} /></span>
      <h2 className="serif m-0 text-[20px] font-extrabold">Chưa có gì trong khu học tập</h2>
      <p className="muted text-[14px] m-0" style={{ maxWidth: 420 }}>Khóa học và tài liệu bạn mua sẽ hiện ở đây, kể cả khi bạn không tham gia hội nào. Xem thử các hội đang mở để tìm nội dung phù hợp.</p>
      <Link to="/kham-pha" className="btn btn-primary">Khám phá hội</Link>
    </div>
  );
}

export default function Page() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>('all');
  const q = useQuery({ queryKey: ['library'], queryFn: () => api.get<Library>('/v1/me/library') });
  const firstName = user?.name.trim().split(/\s+/).pop() ?? '';
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-4 flex-wrap">
        <div className="flex-grow">
          <h1 className="serif m-0 text-[28px] font-extrabold">Khu học tập{firstName ? ` của ${firstName}` : ''}</h1>
          <div className="muted text-[13px]">Mọi khóa học và tài liệu bạn đã sở hữu, gom về một chỗ</div>
        </div>
        <Link to="/tai-khoan/goi" className="btn btn-ghost btn-sm"><Receipt size={15} />Đơn hàng và hóa đơn</Link>
      </div>

      <QueryState q={q} rows={3} isEmpty={(d) => d.counts.courses === 0 && d.counts.digital === 0} empty={{ title: 'Chưa có gì trong khu học tập', hint: 'Khóa học và tài liệu bạn mua sẽ hiện ở đây' }}>
        {(d) => {
          if (d.counts.courses === 0 && d.counts.digital === 0) return <Empty />;
          const courses = d.courses.filter((c) => (filter === 'in_progress' ? (c.progress?.percent ?? 0) > 0 && !c.progress?.completedAt : filter === 'completed' ? Boolean(c.progress?.completedAt) : true));
          return (
            <>
              <div className="card flex items-center gap-8 flex-wrap" style={{ padding: '16px 22px' }}>
                <Stat n={d.counts.courses} label="Khóa học" />
                <Stat n={d.counts.inProgress} label="Đang học" />
                <Stat n={d.counts.completed} label="Hoàn thành" />
                {d.counts.digital > 0 && <Stat n={d.counts.digital} label="Tài liệu" />}
              </div>

              {d.suggestedCommunities.map((c) => <JoinSuggestion key={c.id} c={c} />)}

              {d.counts.courses > 0 && (
                <section className="flex flex-col gap-3.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="serif m-0 text-[20px] font-extrabold flex-grow">Khóa học của tôi</h2>
                    <div className="flex gap-1.5">
                      <Chip on={filter === 'all'} onClick={() => setFilter('all')} style={{ height: 30, fontSize: 12.5 }}>Tất cả</Chip>
                      <Chip on={filter === 'in_progress'} onClick={() => setFilter('in_progress')} style={{ height: 30, fontSize: 12.5 }}>Đang học{d.counts.inProgress ? ` · ${d.counts.inProgress}` : ''}</Chip>
                      <Chip on={filter === 'completed'} onClick={() => setFilter('completed')} style={{ height: 30, fontSize: 12.5 }}>Hoàn thành{d.counts.completed ? ` · ${d.counts.completed}` : ''}</Chip>
                    </div>
                  </div>
                  {courses.length === 0 ? (
                    <div className="card muted text-[13px]" style={{ padding: '20px 22px' }}>Không có khóa học nào ở mục này.</div>
                  ) : (
                    <div className="library-grid">{courses.map((c) => <CourseCard key={c.id} c={c} />)}</div>
                  )}
                </section>
              )}

              {d.counts.digital > 0 && (
                <section className="flex flex-col gap-3.5">
                  <h2 className="serif m-0 text-[20px] font-extrabold">Tài liệu đã mua</h2>
                  <div className="library-grid">{d.digital.map((p) => <DigitalCard key={p.id} p={p} />)}</div>
                </section>
              )}
            </>
          );
        }}
      </QueryState>
    </div>
  );
}
