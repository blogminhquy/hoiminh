// Tài khoản · Hồ sơ (profileEditMain trong build.mjs): một hồ sơ dùng chung cho mọi hội, PATCH /v1/me.
import { Button, Field, Input, T, Textarea } from '@hoiminh/ui';
import { useMutation } from '@tanstack/react-query';
import { Check, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { AccountCard, AvatarCoverBlock, LinksCard, PrivacyCard, type Privacy, type ProfileLink } from './ProfileEditParts';

interface Form {
  name: string; handle: string; bio: string; location: string; occupation: string;
  avatarUrl: string | null; avatarFileId: string | null | undefined; coverColor: string; links: ProfileLink[]; privacy: Privacy;
}
const DEFAULT_PRIVACY: Privacy = { publicProfile: true, showProgress: true, showCommunities: false, allowMessages: true };

export default function Page() {
  const { user, profile, refresh, logout } = useAuth();
  const { hash } = useLocation();
  const [form, setForm] = useState<Form | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (form || !user || !profile) return;
    setForm({
      name: user.name, handle: user.handle, bio: profile.bio ?? '', location: profile.location ?? '', occupation: profile.occupation ?? '',
      avatarUrl: user.avatarUrl ?? null, avatarFileId: undefined, coverColor: profile.coverColor ?? T.accent, links: profile.links ?? [],
      privacy: { ...DEFAULT_PRIVACY, ...(profile.privacy as Partial<Privacy>) },
    });
  }, [form, user, profile]);
  useEffect(() => {
    if (hash === '#tai-khoan' && form) document.getElementById('tai-khoan')?.scrollIntoView({ behavior: 'smooth' });
  }, [hash, form]);

  const upload = useMutation({
    mutationFn: (file: File) => api.upload(file, 'avatar'),
    onSuccess: (r) => setForm((f) => (f ? { ...f, avatarUrl: r.url, avatarFileId: r.fileId } : f)),
  });
  const save = useMutation({
    mutationFn: (f: Form) => api.patch('/v1/me', {
      name: f.name.trim(), handle: f.handle.trim().toLowerCase(), bio: f.bio, location: f.location, occupation: f.occupation,
      coverColor: f.coverColor, links: f.links.filter((l) => l.url.trim()).map((l) => ({ ...l, url: l.url.trim() })), privacy: f.privacy,
      ...(f.avatarFileId !== undefined ? { avatarFileId: f.avatarFileId } : {}),
    }),
    onSuccess: async () => { setSaved(true); setTimeout(() => setSaved(false), 2500); await refresh(); },
  });

  if (!form || !user) return null;
  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const handleOk = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/.test(form.handle);

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <h1 className="serif m-0 text-[28px] font-extrabold leading-tight">Hồ sơ</h1>
          <div className="muted text-[13px]">Một hồ sơ dùng chung cho mọi hội bạn tham gia</div>
        </div>
        <span className="flex-grow" />
        {saved && <span className="text-[13px] font-semibold" style={{ color: T.teal }}>Đã lưu</span>}
        <Link to={`/u/${user.handle}`} className="btn btn-ghost btn-sm"><User size={14} />Xem như người khác</Link>
        <Button size="sm" variant="dark" loading={save.isPending} disabled={!handleOk || form.name.trim().length < 2} onClick={() => save.mutate(form)}>Lưu thay đổi</Button>
      </div>
      {save.isError && <div className="text-[13px] px-4 py-3 rounded-[10px]" style={{ background: T.accentSoft, color: T.accentText }}>{errorMessage(save.error)}</div>}
      {upload.isError && <div className="text-[13px] px-4 py-3 rounded-[10px]" style={{ background: T.accentSoft, color: T.accentText }}>{errorMessage(upload.error)}</div>}

      <div className="card p-6 flex flex-col gap-[18px]">
        <AvatarCoverBlock name={form.name} avatarUrl={form.avatarUrl} coverColor={form.coverColor} uploading={upload.isPending} onPick={(f) => upload.mutate(f)} onRemove={() => set({ avatarUrl: null, avatarFileId: null })} onCover={(c) => set({ coverColor: c })} />
        <div className="grid-2">
          <Field label="Tên hiển thị"><Input value={form.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Tên người dùng" hint={`Dùng để nhắc đến bạn trong bài viết: @${form.handle || 'ban'}`}>
            <Input left={<span className="muted">@</span>} value={form.handle} maxLength={30} onChange={(e) => set({ handle: e.target.value.toLowerCase() })} right={handleOk ? <Check size={16} style={{ color: T.teal }} /> : <span className="text-[12px]" style={{ color: T.accentText }}>3–30 ký tự a-z, 0-9, -</span>} />
          </Field>
        </div>
        <Field label="Giới thiệu ngắn" hint={`${form.bio.length}/300 ký tự`}>
          <Textarea value={form.bio} maxLength={300} rows={3} onChange={(e) => set({ bio: e.target.value })} placeholder="Bạn làm gì, đang theo đuổi điều gì, người khác có thể hỏi bạn về chuyện gì" />
        </Field>
        <div className="grid-2">
          <Field label="Địa điểm"><Input value={form.location} maxLength={80} placeholder="Hà Nội" onChange={(e) => set({ location: e.target.value })} /></Field>
          <Field label="Nghề nghiệp"><Input value={form.occupation} maxLength={80} placeholder="Sáng lập …" onChange={(e) => set({ occupation: e.target.value })} /></Field>
        </div>
      </div>

      <LinksCard links={form.links} onChange={(links) => set({ links })} />
      <PrivacyCard privacy={form.privacy} onChange={(privacy) => set({ privacy })} />
      <AccountCard email={user.email} verifiedAt={user.emailVerifiedAt ?? null} onLogout={() => void logout()} />
    </>
  );
}
