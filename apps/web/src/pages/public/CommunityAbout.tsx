// Trang giới thiệu hội (aboutBody trong build.mjs): đích của link hội, công khai; dữ liệu từ /v1/communities/by-slug/:slug?ref=.
import { useQuery } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { useEffect } from 'react';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { PublicHeader } from '@/layouts/PublicHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AboutHero, AboutTabs, Benefits, CourseList, Faq, isViewerMember, Leader, type AboutPage } from './CommunityAboutParts';
import { AboutRail } from './CommunityAboutRail';
import { currentRef, movedSlugPath } from '@/lib/referral';
import { forgetInvite, INVITE_PARAM, inviteFor, inviteIsDead, rememberInvite } from '@/lib/invite';

export default function Page() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const location = useLocation();
  // Mã giới thiệu trên link được ghi nhớ 30 ngày ở gốc router (mọi trang), để đăng ký/tham gia sau vẫn ghi nhận affiliate.
  const ref = currentRef(params);

  // Mã mời trên link (`?invite=`) được nhớ theo hội để còn nguyên sau bước đăng ký và xác minh email.
  const linkInvite = params.get(INVITE_PARAM);
  useEffect(() => { rememberInvite(slug, linkInvite); }, [slug, linkInvite]);
  const invite = inviteFor(slug, params);

  const q = useQuery({
    queryKey: ['about', slug, ref, user?.id ?? null, invite],
    queryFn: () => {
      const qs = new URLSearchParams();
      if (ref) qs.set('ref', ref);
      if (invite) qs.set('invite', invite);
      const tail = qs.toString();
      return api.get<AboutPage>(`/v1/communities/by-slug/${slug}${tail ? `?${tail}` : ''}`);
    },
    enabled: Boolean(slug),
    staleTime: 30_000,
  });

  // Mã đã hết hạn, đã dùng hoặc bị thu hồi thì quên đi, kẻo lần sau mở trang hội vẫn hiện lời báo lỗi cũ.
  const deadInvite = inviteIsDead(q.data?.invite);
  useEffect(() => { if (deadInvite) forgetInvite(slug); }, [deadInvite, slug]);

  useEffect(() => {
    if (q.data) document.title = `${q.data.community.name} · Hội Mình`;
  }, [q.data]);

  // Hội đã đổi đường dẫn: link cũ đã chia sẻ (kể cả link affiliate có ?ref=) chuyển sang đường dẫn mới.
  const moved = q.data ? movedSlugPath(location, slug, q.data.community.slug) : null;
  if (moved) return <Navigate to={moved} replace />;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg }}>
      <PublicHeader cta="join" join={slug ? { slug: q.data?.community.slug ?? slug, loginNext: `/${q.data?.community.slug ?? slug}/bang-tin`, ref } : undefined} />
      <div className="flex justify-center px-4 md:px-16 pt-6 pb-12">
        <div className="w-full flex flex-col lg:flex-row gap-8 items-start" style={{ maxWidth: 1120 }}>
          <QueryState q={q} rows={3}>
            {(d) => {
              const member = isViewerMember(d);
              return (
                <>
                  <div className="flex-grow min-w-0 w-full flex flex-col gap-5">
                    <AboutTabs d={d} member={member} />
                    <AboutHero d={d} />
                    <div className="flex flex-col gap-2.5">
                      <h1 className="serif m-0 font-extrabold leading-[1.2] text-[26px] md:text-[32px]">{d.community.name}</h1>
                      <p className="m-0 text-[16px] leading-[1.7] whitespace-pre-line" style={{ color: T.ink2 }}>{d.community.description || d.community.shortDescription || 'Chủ hội chưa viết mô tả.'}</p>
                    </div>
                    <Benefits d={d} />
                    <Leader d={d} />
                    <CourseList d={d} member={member} />
                    <Faq d={d} />
                  </div>
                  <AboutRail d={d} refCode={ref} invite={invite} />
                </>
              );
            }}
          </QueryState>
        </div>
      </div>
    </div>
  );
}
