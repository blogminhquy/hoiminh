// Rail trang giới thiệu hội: thẻ hội (số liệu, avatar, giá, nút tham gia), câu hỏi khi tham gia, giới thiệu, liên kết.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, CommunityMark, Modal, money, T } from '@hoiminh/ui';
import { ExternalLink, Sparkles, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { rememberCommunitySlug, useAuth } from '@/lib/auth';
import { fmtCount } from '@/lib/format';
import { categoryLabel, isViewerMember, type AboutPage } from './CommunityAboutParts';

interface JoinResult { member: { status: string }; alreadyMember?: boolean }

function JoinQuestionsModal({ d, open, onClose, onSubmit, saving, error }: { d: AboutPage; open: boolean; onClose: () => void; onSubmit: (answers: Array<{ questionId: string; answer: string }>) => void; saving: boolean; error: unknown }) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const ok = d.joinQuestions.every((q) => !q.required || (answers[q.id] ?? '').trim());
  return (
    <Modal open={open} onClose={onClose} title={`Tham gia ${d.community.name}`} width={520} footer={(
      <div className="flex items-center gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.line}` }}>
        <span className="text-[12px] flex-grow" style={{ color: T.accentText }}>{error ? errorMessage(error) : ''}</span>
        <Button size="sm" onClick={onClose}>Để sau</Button>
        <Button size="sm" variant="primary" loading={saving} disabled={!ok} onClick={() => onSubmit(d.joinQuestions.map((q) => ({ questionId: q.id, answer: (answers[q.id] ?? '').trim() })).filter((a) => a.answer))}>Gửi và tham gia</Button>
      </div>
    )}>
      <div className="p-5 flex flex-col gap-4">
        <div className="muted text-[13px]">Chủ hội muốn biết đôi chút về bạn trước khi vào.</div>
        {d.joinQuestions.map((q) => (
          <label key={q.id} className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">{q.question}{q.required && <span style={{ color: T.accent }}> *</span>}</span>
            <span className="input textarea"><textarea rows={2} maxLength={500} value={answers[q.id] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))} /></span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

export function AboutRail({ d, refCode: ref }: { d: AboutPage; refCode: string | null }) {
  const c = d.community;
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const member = isViewerMember(d);
  const pending = d.viewer?.memberStatus === 'pending';
  const paid = d.pricing.mode === 'subscription' || d.pricing.mode === 'one_time';
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: (answers: Array<{ questionId: string; answer: string }>) => api.post<JoinResult>(`/v1/communities/by-slug/${c.slug}/join`, { answers, ref: ref ?? undefined }),
    onSuccess: async (r) => {
      setAsking(false);
      await qc.invalidateQueries({ queryKey: ['me'] });
      await qc.invalidateQueries({ queryKey: ['about', c.slug] });
      if (r.member.status === 'pending') { setNotice('Đã gửi yêu cầu, chờ chủ hội duyệt.'); return; }
      rememberCommunitySlug(c.slug);
      navigate(`/${c.slug}/bang-tin`);
    },
  });

  const onJoin = () => {
    if (member) { rememberCommunitySlug(c.slug); navigate(`/${c.slug}/bang-tin`); return; }
    if (!user) { navigate(`/dang-ky?hoi=${encodeURIComponent(c.slug)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`); return; }
    if (paid) { navigate(`/${c.slug}/thanh-toan?tier=premium&cycle=${d.pricing.mode === 'one_time' ? 'one_time' : 'monthly'}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`); return; }
    if (d.joinQuestions.length) { setAsking(true); return; }
    join.mutate([]);
  };

  const priceMain = d.pricing.mode === 'subscription' && d.pricing.premiumMonthlyMinor ? money(d.pricing.premiumMonthlyMinor) : d.pricing.mode === 'one_time' && d.pricing.oneTimeMinor ? money(d.pricing.oneTimeMinor) : 'Miễn phí';
  const priceSub = d.pricing.mode === 'subscription' ? '/tháng' : d.pricing.mode === 'one_time' ? 'trọn đời' : 'để tham gia';
  const label = member ? 'Vào hội' : pending ? 'Đang chờ duyệt' : !c.doorsOpen ? 'Hội đã đóng cổng' : paid ? `Tham gia · ${priceMain}` : 'Tham gia miễn phí';
  const others = Math.max(0, d.stats.members - d.sampleMembers.length);

  return (
    <aside className="flex flex-col gap-3.5 w-full lg:w-[340px] lg:flex-shrink-0 lg:sticky lg:top-6">
      <div className="card overflow-hidden">
        <div className="flex items-end p-4" style={{ height: 130, background: c.coverUrl ? `url(${c.coverUrl}) center/cover` : c.coverColor }}>
          <span className="serif font-extrabold leading-[1.1] text-[22px]" style={{ color: T.invertInk, textShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>{c.coverTagline || c.name}</span>
        </div>
        <div className="flex flex-col gap-3" style={{ padding: 18 }}>
          <div className="flex items-center gap-3">
            <CommunityMark mark={c.logoMark} color={c.logoColor} url={c.logoUrl} size={48} radius={14} style={{ marginTop: -42, border: `3px solid ${T.surface}` }} />
            <div className="min-w-0"><div className="font-bold text-[16px] truncate">{c.name}</div><div className="muted text-[12px]">hoiminh.vn/{c.slug} · {categoryLabel(c.category)}</div></div>
          </div>
          {c.shortDescription && <div className="text-[13px]" style={{ color: T.ink2 }}>{c.shortDescription}</div>}
          <div className="grid grid-cols-3 gap-2 py-2.5" style={{ borderTop: `1px solid ${T.line}`, borderBottom: `1px solid ${T.line}` }}>
            {([[d.stats.members, 'Thành viên'], [d.stats.online, 'Online'], [d.stats.courses, 'Khóa học']] as const).map(([v, l]) => (
              <div key={l} className="text-center"><div className="font-bold text-[18px]">{fmtCount(v)}</div><div className="muted text-[12px]">{l}</div></div>
            ))}
          </div>
          {d.sampleMembers.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex">
                {d.sampleMembers.slice(0, 5).map((m, k) => <span key={m.id} className="inline-flex rounded-full" style={{ marginLeft: k ? -8 : 0, border: `2px solid ${T.surface}` }}><Avatar name={m.name} src={m.avatarUrl} color={m.coverColor} size={28} /></span>)}
              </div>
              {others > 0 && <span className="muted text-[12px]">và {fmtCount(others)} người khác</span>}
            </div>
          )}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-baseline gap-2"><span className="serif text-[22px] font-extrabold">{priceMain}</span><span className="muted text-[13px]">{priceSub}</span></div>
            {d.pricing.mode === 'freemium' && d.pricing.premiumMonthlyMinor ? <div className="muted text-[13px] flex items-center gap-1.5"><Sparkles size={14} />Premium {money(d.pricing.premiumMonthlyMinor)}/tháng để mở toàn bộ khóa học</div> : null}
            {d.pricing.mode === 'subscription' && d.pricing.premiumYearlyMinor ? <div className="muted text-[13px] flex items-center gap-1.5"><Sparkles size={14} />Hoặc {money(d.pricing.premiumYearlyMinor)}/năm</div> : null}
          </div>
          <Button variant={member ? 'dark' : 'primary'} loading={join.isPending} disabled={pending || (!member && !c.doorsOpen)} onClick={onJoin} style={{ height: 48, fontSize: 15, borderRadius: 12 }}>{label}</Button>
          {(notice || join.isError) && <div className="text-[12px]" style={{ color: join.isError ? T.accentText : T.tealText }}>{join.isError ? errorMessage(join.error) : notice}</div>}
          {d.referrer && (
            <div className="flex items-center gap-2 rounded-[10px] text-[12px]" style={{ padding: '10px 12px', background: T.goldSoft, color: T.goldDark }}><Users size={14} />Bạn được <strong className="mx-1">{d.referrer.name}</strong> giới thiệu</div>
          )}
        </div>
      </div>
      {c.links.length > 0 && (
        <div className="card flex flex-col gap-2" style={{ padding: '16px 18px' }}>
          <div className="font-semibold text-[13px]">Liên kết</div>
          {c.links.map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-[13px]" style={{ color: T.ink }}>
              <span style={{ color: T.ink3 }}><ExternalLink size={14} /></span>
              <span className="flex-grow truncate">{l.label || l.url}</span>
              <span className="muted text-[12px] truncate" style={{ maxWidth: 140 }}>{l.url.replace(/^https?:\/\//, '')}</span>
            </a>
          ))}
        </div>
      )}
      <div className="muted text-[12px] text-center">Vận hành trên <strong style={{ color: T.ink }}>Hội Mình</strong> · <Link to="/tao-hoi" className="font-semibold" style={{ color: T.teal }}>Tạo hội của bạn</Link></div>
      <JoinQuestionsModal d={d} open={asking} onClose={() => setAsking(false)} onSubmit={(a) => join.mutate(a)} saving={join.isPending} error={join.error} />
    </aside>
  );
}
