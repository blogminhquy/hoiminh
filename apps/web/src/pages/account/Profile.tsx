// Hồ sơ thành viên (profileMain): bìa + avatar, nhãn, bio, link, 5 số, tab bài viết; rail tiến độ học, hội cùng tham gia, thẻ cộng sự.
import { useQuery } from '@tanstack/react-query';
import { Avatar, CommunityMark, Prog, T } from '@hoiminh/ui';
import { BadgeCheck, ExternalLink, Globe, Heart, MessageCircle, Pencil, Trophy, UserPlus, Video } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { api } from '@/lib/api';
import { fmtDate, timeAgo } from '@/lib/format';
import { MessageModal } from '@/pages/community/MessageModal';

interface Profile {
  user: { id: string; name: string; handle: string; avatarUrl: string | null; coverColor: string | null; bio: string | null; location: string | null; occupation: string | null; links: Array<{ kind: string; label: string; url: string }>; createdAt: string; lastSeenAt: string | null; privacy: { allowMessages: boolean }; isSelf: boolean };
  stats: { posts: number; comments: number; coursesCompleted: number; coursesTotal: number; communities: number; referrals: number };
  memberships: Array<{ id: string; name: string; slug: string; logoMark: string; logoColor: string; role: string; tier: { key: string; name: string } | null; level: number; joinedAt: string }>;
  progress: Array<{ courseId: string; title: string; percent: number; completedAt: string | null }>;
  leaderboard: { rank: number; referrals: number; paid: number; communityId: string } | null;
  recentPosts: Array<{ id: string; communityId: string; title: string | null; excerpt: string | null; likeCount: number; commentCount: number; createdAt: string }>;
}
const ROLE: Record<string, string> = { owner: 'Chủ hội', admin: 'Quản trị viên', moderator: 'Điều hành', member: 'Thành viên' };
const linkIcon = (kind: string): ReactNode => (kind === 'youtube' ? <Video size={14} /> : kind === 'facebook' ? <ExternalLink size={14} /> : kind === 'zalo' ? <MessageCircle size={14} /> : <Globe size={14} />);

export default function Page() {
  const { handle = '' } = useParams();
  const [msg, setMsg] = useState(false);
  const q = useQuery({ queryKey: ['profile', handle], queryFn: () => api.get<Profile>(`/v1/users/${handle}`) });
  return (
    <QueryState q={q} rows={6}>
      {(p) => {
        const u = p.user;
        const top = p.memberships[0];
        const lb = p.leaderboard ? p.memberships.find((m) => m.id === p.leaderboard?.communityId) : null;
        const slugOf = (cid: string) => p.memberships.find((m) => m.id === cid)?.slug ?? null;
        const maxLevel = Math.max(0, ...p.memberships.map((m) => m.level));
        return (
          <div className="two-col">
            <div className="main flex flex-col gap-4">
              <div className="card overflow-hidden">
                <div style={{ height: 120, background: u.coverColor ?? T.accent }} />
                <div className="px-6 pb-5 flex flex-col gap-3.5">
                  <div className="flex items-end gap-4 flex-wrap" style={{ marginTop: -40 }}>
                    <span className="inline-flex rounded-full" style={{ border: `4px solid ${T.surface}` }}><Avatar name={u.name} src={u.avatarUrl} color={u.coverColor ?? T.accent} size={96} /></span>
                    <div className="flex-grow pb-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap"><span className="serif text-[24px] font-extrabold">{u.name}</span>{maxLevel > 0 && <span className="tag" style={{ background: T.goldSoft, color: T.goldText }}>Cấp {maxLevel}</span>}{top?.tier && top.tier.key !== 'standard' && <span className="tag" style={{ background: T.goldSoft, color: T.goldText }}>{top.tier.name}</span>}{p.leaderboard && <span className="tag" style={{ background: T.tealSoft, color: T.tealText }}><Trophy size={11} />Cộng sự hạng {p.leaderboard.rank}</span>}</div>
                      <div className="muted text-[13px]">@{u.handle} · Tham gia {fmtDate(u.createdAt)}{u.lastSeenAt ? ` · Hoạt động ${timeAgo(u.lastSeenAt)}` : ''}{u.occupation ? ` · ${u.occupation}` : ''}</div>
                    </div>
                    <div className="flex gap-2 pb-1.5">
                      {u.isSelf ? <Link to="/tai-khoan/ho-so" className="btn btn-ghost btn-sm"><Pencil size={14} />Sửa hồ sơ</Link> : (
                        <>{top && <Link to={`/${top.slug}/bang-tin`} className="btn btn-ghost btn-sm"><UserPlus size={14} />Cùng hội</Link>}{u.privacy.allowMessages && <button type="button" className="btn btn-dark btn-sm" onClick={() => setMsg(true)}><MessageCircle size={14} />Nhắn tin</button>}</>
                      )}
                    </div>
                  </div>
                  {u.bio && <p className="m-0 text-[14px] leading-[1.6]" style={{ color: T.ink2 }}>{u.bio}</p>}
                  {u.links.length > 0 && <div className="flex gap-3.5 flex-wrap text-[13px]">{u.links.map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium" style={{ color: T.teal }}>{linkIcon(l.kind)}{l.label || l.url.replace(/^https?:\/\//, '')}</a>)}</div>}
                  <div className="flex pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
                    {[[p.stats.posts, 'Bài viết'], [p.stats.comments, 'Bình luận'], [`${p.stats.coursesCompleted}/${p.stats.coursesTotal}`, 'Khóa học'], [p.stats.referrals, 'Người giới thiệu'], [p.stats.communities, 'Hội tham gia']].map(([v, l]) => <div key={String(l)} className="flex-1 text-center"><div className="font-bold text-[18px]">{v}</div><div className="muted text-[12px]">{l}</div></div>)}
                  </div>
                </div>
              </div>
              <div className="flex gap-5" style={{ borderBottom: `1px solid ${T.line}` }}><span className="py-2.5 font-bold text-[14px]" style={{ borderBottom: `2px solid ${T.ink}` }}>Bài viết · {p.stats.posts}</span></div>
              {p.recentPosts.length === 0 && <div className="muted text-[13px] text-center py-6">Chưa có bài viết công khai</div>}
              {p.recentPosts.map((post) => { const slug = slugOf(post.communityId); const inner = (
                <article className="card flex flex-col gap-2" style={{ padding: '18px 22px' }}>
                  <div className="flex items-center gap-2 text-[12px]"><span className="muted">{timeAgo(post.createdAt)}</span></div>
                  {post.title && <div className="serif text-[18px] font-bold leading-[1.3]">{post.title}</div>}
                  {post.excerpt && <div className="text-[13px]" style={{ color: T.ink2 }}>{post.excerpt}</div>}
                  <div className="flex gap-[18px] text-[13px] font-medium pt-1" style={{ color: T.ink2 }}><span className="inline-flex items-center gap-1.5"><Heart size={16} />{post.likeCount}</span><span className="inline-flex items-center gap-1.5"><MessageCircle size={16} />{post.commentCount}</span></div>
                </article>
              ); return slug ? <Link key={post.id} to={`/${slug}/bai-viet/${post.id}`} style={{ color: T.ink }}>{inner}</Link> : <div key={post.id}>{inner}</div>; })}
            </div>
            <aside className="rail flex flex-col gap-4">
              {p.progress.length > 0 && (
                <div className="card p-4 flex flex-col gap-3">
                  <div className="font-semibold">Tiến độ học</div>
                  {p.progress.map((c) => <div key={c.courseId} className="flex flex-col gap-1.5"><div className="flex items-center gap-2 text-[13px]"><span className="flex-grow font-medium truncate">{c.title}</span>{c.percent === 100 ? <span style={{ color: T.teal }}><BadgeCheck size={16} /></span> : <span className="muted text-[12px]">{c.percent}%</span>}</div><Prog value={c.percent} /></div>)}
                </div>
              )}
              {p.memberships.length > 0 && (
                <div className="card p-4 flex flex-col gap-2.5">
                  <div className="font-semibold">Hội tham gia</div>
                  {p.memberships.map((m) => <Link key={m.id} to={`/${m.slug}`} className="flex items-center gap-2.5" style={{ color: T.ink }}><CommunityMark mark={m.logoMark} color={m.logoColor} size={32} radius={9} /><div className="flex-grow min-w-0"><div className="text-[13px] font-semibold truncate">{m.name}</div><div className="muted text-[12px]">{ROLE[m.role] ?? m.role}</div></div></Link>)}
                </div>
              )}
              {p.leaderboard && (
                <div className="card p-4 flex flex-col gap-2" style={{ background: T.ink, color: T.surface, borderColor: T.ink }}>
                  <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.06em]" style={{ color: T.gold }}><Trophy size={14} />Cộng sự tháng {new Date().getMonth() + 1}</div>
                  <div className="serif text-[20px] font-extrabold">Hạng {p.leaderboard.rank} · {p.leaderboard.referrals} người giới thiệu</div>
                  <div className="text-[13px]" style={{ color: T.sideText }}>{p.leaderboard.paid} người trong số đó đã trả phí</div>
                  {lb && <Link to={`/${lb.slug}/xep-hang`} className="text-[13px] font-semibold" style={{ color: T.gold }}>Xem bảng xếp hạng</Link>}
                </div>
              )}
            </aside>
            {top && <MessageModal open={msg} onClose={() => setMsg(false)} recipient={{ id: u.id, name: u.name }} communityId={top.id} />}
          </div>
        );
      }}
    </QueryState>
  );
}
