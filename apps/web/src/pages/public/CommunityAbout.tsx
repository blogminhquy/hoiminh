// Trang giới thiệu hội (aboutBody trong build.mjs): đích của link hội, công khai; dữ liệu từ /v1/communities/by-slug/:slug?ref=.
import { useQuery } from '@tanstack/react-query';
import { T } from '@hoiminh/ui';
import { useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { QueryState } from '@/components/QueryState';
import { PublicHeader } from '@/layouts/PublicHeader';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AboutHero, AboutTabs, Benefits, CourseList, Faq, isViewerMember, Leader, type AboutPage } from './CommunityAboutParts';
import { AboutRail } from './CommunityAboutRail';
import { readCookie } from './AuthParts';

export default function Page() {
  const { slug = '' } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();
  const ref = params.get('ref') ?? readCookie('hm_ref');

  // Ghi cookie giới thiệu 30 ngày để đăng ký/tham gia sau vẫn ghi nhận cộng sự.
  useEffect(() => {
    const r = params.get('ref');
    if (r) document.cookie = `hm_ref=${encodeURIComponent(r)}; path=/; max-age=${30 * 86400}; samesite=lax`;
  }, [params]);

  const q = useQuery({
    queryKey: ['about', slug, ref, user?.id ?? null],
    queryFn: () => api.get<AboutPage>(`/v1/communities/by-slug/${slug}${ref ? `?ref=${encodeURIComponent(ref)}` : ''}`),
    enabled: Boolean(slug),
    staleTime: 30_000,
  });

  useEffect(() => {
    if (q.data) document.title = `${q.data.community.name} · Hội Mình`;
  }, [q.data]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: T.bg }}>
      <PublicHeader cta="join" />
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
                  <AboutRail d={d} refCode={ref} />
                </>
              );
            }}
          </QueryState>
        </div>
      </div>
    </div>
  );
}
