// Rail trang giới thiệu hội: thẻ hội (số liệu, avatar, giá, nút tham gia), câu hỏi khi tham gia, giới thiệu, liên kết.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, CommunityMark, Modal, money, T } from '@hoiminh/ui';
import { ExternalLink, Eye, Globe, Lock, MailCheck, Sparkles, Tag, Users } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { rememberCommunitySlug, useAuth } from '@/lib/auth';
import { fmtCount } from '@/lib/format';
import { guestHome } from '@/lib/guest';
import { forgetInvite, inviteEffect } from '@/lib/invite';
import { JOIN_PARAM, signupPathFor } from '@/lib/join-intent';
import { checkoutQuery, modeChoices, promoEndLabel } from '@/lib/membership';
import { categoryLabel, isViewerMember, type AboutPage } from './CommunityAboutParts';
import { SITE_HOST } from '@/lib/site';

interface JoinResult { member: { status: string }; alreadyMember?: boolean; waitlisted?: boolean }

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

export function AboutRail({ d, refCode: ref, invite }: { d: AboutPage; refCode: string | null; invite?: string | null }) {
  const c = d.community;
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const qc = useQueryClient();
  const member = isViewerMember(d);
  const pending = d.viewer?.memberStatus === 'pending';
  const open = c.visibility === 'public';
  const paid = d.pricing.mode === 'subscription' || d.pricing.mode === 'one_time';
  // Giá mở đầu là kỳ hạn ngắn nhất (đã trừ khuyến mãi đang chạy); các kỳ dài hơn ghi ở dòng "Hoặc".
  const choices = modeChoices({ terms: d.pricing.premiumTerms ?? [], promo: d.pricing.promo ?? null, oneTimeMinor: d.pricing.oneTimeMinor }, d.pricing.mode);
  const entry = choices[0] ?? null;
  const longer = d.pricing.mode === 'subscription' ? choices.slice(1, 3) : [];
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Lời mời trên link đổi được gì cho người này: vào thẳng, nhận quyền quản trị, hay vẫn phải thanh toán (xem inviteEffect).
  const inv = d.invite ?? null;
  const effect = invite ? inviteEffect(inv, { member, role: d.viewer?.role, paid }) : 'none';
  const byInvite = effect === 'join' || effect === 'promote';

  const join = useMutation({
    mutationFn: (answers: Array<{ questionId: string; answer: string }>) => api.post<JoinResult>(`/v1/communities/by-slug/${c.slug}/join`, { answers, ref: ref ?? undefined, invite: byInvite ? invite ?? undefined : undefined }),
    // Lời mời vừa hết hạn hoặc vừa bị thu hồi giữa chừng: tải lại để trang hiện đúng trạng thái và nút tham gia thường.
    onError: () => { if (byInvite) void qc.invalidateQueries({ queryKey: ['about', c.slug] }); },
    onSuccess: async (r) => {
      setAsking(false);
      if (byInvite) { forgetInvite(c.slug); await qc.invalidateQueries({ queryKey: ['shell'] }); }
      await qc.invalidateQueries({ queryKey: ['me'] });
      await qc.invalidateQueries({ queryKey: ['about', c.slug] });
      if (r.member.status === 'pending') { setNotice(r.waitlisted ? 'Hội đang đủ chỗ. Yêu cầu của bạn đã vào hàng chờ, chủ hội sẽ duyệt khi có chỗ.' : 'Đã gửi yêu cầu, chờ chủ hội duyệt.'); return; }
      rememberCommunitySlug(c.slug);
      navigate(`/${c.slug}/bang-tin`);
    },
  });

  const onJoin = () => {
    if (member && effect !== 'promote') { rememberCommunitySlug(c.slug); navigate(`/${c.slug}/bang-tin`); return; }
    if (!user) { navigate(signupPathFor(c.slug, ref)); return; }
    // Được mời thì vào thẳng: không qua thanh toán (chỉ lời mời quản trị), không qua bảng câu hỏi.
    if (byInvite) { join.mutate([]); return; }
    if (paid) { navigate(`/${c.slug}/thanh-toan?${checkoutQuery(entry)}${ref ? `&ref=${encodeURIComponent(ref)}` : ''}`); return; }
    if (d.joinQuestions.length) { setAsking(true); return; }
    join.mutate([]);
  };

  const priceMain = paid && entry ? money(entry.payMinor) : 'Miễn phí';
  const priceSub = paid && entry ? (entry.months ? `/${entry.unit}` : 'trọn đời') : 'để tham gia';
  const promoEnd = promoEndLabel(d.pricing.promo);
  // Hội thu phí mà chủ hội chưa cài nhận tiền: chưa có tài khoản nào để chuyển khoản tới, nên khóa nút tham gia.
  const payLocked = paid && !member && !d.pricing.paymentsReady && !byInvite;
  // Hội đóng cổng hoặc đang chờ duyệt vẫn vào được khi có lời mời của chủ hội.
  const blocked = !byInvite && (pending || payLocked || (!member && !c.doorsOpen));

  // Vừa đăng ký hoặc đăng nhập xong từ trang của hội này (?thamgia=1): vào thẳng hội, không bắt bấm "Tham gia" lần nữa.
  // Chạy đúng việc của nút: thành viên và hội miễn phí vào Bảng tin, hội có câu hỏi mở bảng câu hỏi, hội thu phí sang thanh toán.
  // Gỡ tham số ngay để tải lại trang hay bấm Quay lại không tự tham gia lần nữa. Chưa đăng nhập thì không làm gì.
  const wantsJoin = params.get(JOIN_PARAM) === '1';
  const joinFired = useRef(false);
  useEffect(() => {
    if (!wantsJoin || authLoading || joinFired.current) return;
    joinFired.current = true;
    const rest = new URLSearchParams(params);
    rest.delete(JOIN_PARAM);
    setParams(rest, { replace: true });
    if (!user || blocked) return;
    onJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsJoin, authLoading, user]);
  const label = effect === 'promote' ? 'Nhận quyền quản trị viên' : effect === 'join' ? (inv?.role === 'admin' ? 'Nhận lời mời làm quản trị viên' : 'Nhận lời mời và vào hội') : member ? 'Vào hội' : pending ? 'Đang chờ duyệt' : !c.doorsOpen ? 'Hội đã đóng cổng' : payLocked ? 'Hội chưa mở thanh toán' : paid ? `Tham gia · ${priceMain}` : 'Tham gia miễn phí';
  const others = Math.max(0, d.stats.members - d.sampleMembers.length);

  return (
    <aside className="flex flex-col gap-3.5 w-full lg:w-[340px] lg:flex-shrink-0 lg:sticky lg:top-6">
      <div className="card overflow-hidden">
        {/* Có ảnh bìa thì hiện trọn ảnh 16:9 (ảnh thường đã có chữ riêng); chưa có thì nền màu kèm tên hội. */}
        {c.coverUrl
          ? <img src={c.coverUrl} alt={`Ảnh bìa ${c.name}`} className="block w-full" style={{ aspectRatio: '16 / 9', objectFit: 'cover' }} />
          : (
            <div className="flex items-end p-4" style={{ height: 130, background: c.coverColor }}>
              <span className="serif font-extrabold leading-[1.1] text-[22px]" style={{ color: T.invertInk, textShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>{c.coverTagline || c.name}</span>
            </div>
          )}
        <div className="flex flex-col gap-3" style={{ padding: 18 }}>
          <div className="flex items-center gap-3">
            <CommunityMark mark={c.logoMark} color={c.logoColor} url={c.logoUrl} size={48} radius={14} style={{ marginTop: -42, border: `3px solid ${T.surface}` }} />
            <div className="min-w-0"><div className="font-bold text-[16px] truncate">{c.name}</div><div className="muted text-[12px]">{SITE_HOST}/{c.slug} · {categoryLabel(c.category)}</div></div>
          </div>
          {c.shortDescription && <div className="text-[13px]" style={{ color: T.ink2 }}>{c.shortDescription}</div>}
          <div className="flex items-center gap-1.5 text-[13px]" style={{ color: T.ink2 }}>{open ? <Globe size={15} /> : <Lock size={15} />}<span><strong style={{ color: T.ink }}>{open ? 'Hội mở' : 'Hội kín'}</strong> · {open ? 'ai cũng xem được bên trong' : 'chỉ thành viên xem được bên trong'}</span></div>
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
            <div className="flex items-baseline gap-2 flex-wrap">{paid && entry && entry.percentOff > 0 && <span className="muted line-through text-[14px]">{money(entry.listMinor)}</span>}<span className="serif text-[22px] font-extrabold">{priceMain}</span><span className="muted text-[13px]">{priceSub}</span></div>
            {entry && entry.percentOff > 0 && <div className="text-[13px] font-semibold flex items-center gap-1.5" style={{ color: T.goldText }}><Tag size={14} />Đang giảm {entry.percentOff}%{promoEnd ? ` đến hết ngày ${promoEnd}` : ''}</div>}
            {d.pricing.mode === 'freemium' && entry ? <div className="muted text-[13px] flex items-center gap-1.5"><Sparkles size={14} />Premium {money(entry.payMinor)}/{entry.unit} để mở toàn bộ khóa học</div> : null}
            {longer.length > 0 && <div className="muted text-[13px] flex items-center gap-1.5"><Sparkles size={14} />Hoặc {longer.map((x) => `${money(x.payMinor)}/${x.unit}`).join(', ')}</div>}
          </div>
          <Button variant={member ? 'dark' : 'primary'} loading={join.isPending} disabled={blocked} onClick={onJoin} style={{ height: 48, fontSize: 15, borderRadius: 12 }}>{label}</Button>
          {open && !member && <Link to={guestHome(c.slug, c.tabs)} className="btn btn-ghost" style={{ height: 44, borderRadius: 12 }}><Eye size={16} />Xem trước bên trong</Link>}
          {(notice || join.isError) && <div className="text-[12px]" style={{ color: join.isError ? T.accentText : T.tealText }}>{join.isError ? errorMessage(join.error) : notice}</div>}
          {invite && inv && effect !== 'none' && (
            <div className="flex items-start gap-2 rounded-[10px] text-[13px] leading-[1.5]" style={{ padding: '10px 12px', background: T.goldSoft, color: T.goldDark }}>
              <MailCheck size={16} className="flex-shrink-0" style={{ marginTop: 2 }} />
              <span>{effect === 'promote' ? 'Chủ hội mời bạn làm quản trị viên của hội này.' : effect === 'pay' ? 'Bạn được chủ hội mời vào hội này. Hội thu phí nên bạn cần thanh toán để tham gia.' : inv.role === 'admin' ? 'Chủ hội mời bạn vào hội với vai trò quản trị viên.' : 'Bạn được chủ hội mời vào hội này, bấm để vào ngay.'}</span>
            </div>
          )}
          {invite && inv && inv.state !== 'valid' && !member && inv.message && (
            <div className="rounded-[10px] text-[13px] leading-[1.5]" style={{ padding: '10px 12px', background: T.accentSoft, color: T.accentText }}>{inv.message}</div>
          )}
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
