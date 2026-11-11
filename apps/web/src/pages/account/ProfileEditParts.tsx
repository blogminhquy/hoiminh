// Khối con của trang Hồ sơ: ảnh đại diện + ảnh bìa, Liên kết, Quyền riêng tư, Đổi mật khẩu, mục Tài khoản.
import { useMutation } from '@tanstack/react-query';
import { AVATAR_COLORS, Avatar, Button, Field, Input, Select, T, Tag, Toggle } from '@hoiminh/ui';
import { Camera, ExternalLink, Eye, EyeOff, Globe, Image, MessageCircle, Plus, Trash2, Video, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { api, errorMessage } from '@/lib/api';
import { TwoFactorCard } from './TwoFactorCard';

export interface ProfileLink { kind: string; label: string; url: string }
export interface Privacy { publicProfile: boolean; showProgress: boolean; showCommunities: boolean; allowMessages: boolean }

export const LINK_KINDS: Array<{ kind: string; label: string }> = [
  { kind: 'website', label: 'Website' }, { kind: 'facebook', label: 'Facebook' }, { kind: 'youtube', label: 'YouTube' }, { kind: 'zalo', label: 'Zalo' },
];
export function linkIcon(kind: string, size = 16): ReactNode {
  if (kind === 'facebook') return <ExternalLink size={size} />;
  if (kind === 'youtube') return <Video size={size} />;
  if (kind === 'zalo') return <MessageCircle size={size} />;
  return <Globe size={size} />;
}

const Spinner = ({ size = 16 }: { size?: number }) => <span className="inline-block rounded-full border-2 border-current border-t-transparent animate-spin" style={{ width: size, height: size }} />;

/**
 * Đầu trang Hồ sơ, bố cục như trang cá nhân Facebook: ảnh bìa nằm ngang ở trên, nút "Chỉnh sửa ảnh bìa" ở góc dưới phải,
 * ảnh đại diện tròn đè lên mép dưới ảnh bìa và có nút máy ảnh để đổi. Chưa có ảnh bìa thì hiện nền màu.
 */
export function ProfileHeaderBlock({ name, handle, avatarUrl, coverUrl, coverColor, avatarUploading, coverUploading, onAvatar, onAvatarRemove, onCover, onCoverRemove, onCoverColor }: {
  name: string; handle: string; avatarUrl: string | null; coverUrl: string | null; coverColor: string; avatarUploading: boolean; coverUploading: boolean;
  onAvatar: (file: File) => void; onAvatarRemove: () => void; onCover: (file: File) => void; onCoverRemove: () => void; onCoverColor: (c: string) => void;
}) {
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const menuBox = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => { if (!menuBox.current?.contains(e.target as Node)) setMenu(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey); };
  }, [menu]);
  const item = 'flex items-center gap-2.5 w-full text-left text-[15px] font-semibold rounded-[8px] px-3';
  return (
    <div className="flex flex-col">
      <div className="relative">
        <div role="img" aria-label={coverUrl ? 'Ảnh bìa hồ sơ' : 'Nền màu của hồ sơ, chưa có ảnh bìa'} className="rounded-[14px]" style={{ width: '100%', aspectRatio: '3 / 1', minHeight: 132, backgroundColor: coverColor, backgroundImage: coverUrl ? `url(${coverUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }} />
        <div ref={menuBox} className="absolute right-3 top-3 sm:top-auto sm:bottom-3" style={{ zIndex: 10 }}>
          <button type="button" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)} className="inline-flex items-center gap-2 rounded-[10px] text-[14px] font-semibold" style={{ height: 40, padding: '0 12px', background: T.surface, color: T.ink, boxShadow: '0 2px 10px rgba(0,0,0,0.25)' }}>
            {coverUploading ? <Spinner /> : <Camera size={17} />}Chỉnh sửa ảnh bìa
          </button>
          {menu && (
            <div role="menu" className="card absolute right-0 flex flex-col p-1.5" style={{ top: 'calc(100% + 6px)', width: 250, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
              <button type="button" role="menuitem" className={item} style={{ height: 44, color: T.ink }} onClick={() => { setMenu(false); coverRef.current?.click(); }}><Image size={18} />{coverUrl ? 'Tải ảnh khác lên' : 'Tải ảnh lên'}</button>
              {coverUrl && <button type="button" role="menuitem" className={item} style={{ height: 44, color: T.accentText }} onClick={() => { setMenu(false); onCoverRemove(); }}><Trash2 size={18} />Gỡ ảnh bìa</button>}
              <div className="flex flex-col gap-2 px-3 pt-2.5 pb-2 mt-1" style={{ borderTop: `1px solid ${T.line}` }}>
                <span className="muted text-[13px]">Màu nền khi không dùng ảnh</span>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((c) => (
                    <button key={c} type="button" aria-label={`Màu bìa ${c}`} aria-pressed={c === coverColor} onClick={() => onCoverColor(c)} className="rounded-full" style={{ width: 24, height: 24, background: c, border: c === coverColor ? `2px solid ${T.ink}` : '2px solid transparent', outline: c === coverColor ? `2px solid ${T.surface}` : undefined, outlineOffset: -4 }} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="relative flex items-end gap-3.5 flex-wrap px-2 sm:px-4" style={{ marginTop: -44 }}>
        <span className="relative inline-flex rounded-full flex-shrink-0" style={{ border: `4px solid ${T.surface}`, background: T.surface }}>
          <Avatar name={name} src={avatarUrl} color={T.side} size={112} />
          <button type="button" aria-label="Đổi ảnh đại diện" onClick={() => avatarRef.current?.click()} className="absolute right-0 bottom-0 rounded-full inline-flex items-center justify-center" style={{ width: 38, height: 38, background: T.surface, color: T.ink, border: `1px solid ${T.line2}` }}>{avatarUploading ? <Spinner /> : <Camera size={18} />}</button>
        </span>
        <div className="flex-grow min-w-0 pb-1.5" style={{ flexBasis: 160 }}>
          <div className="serif text-[22px] font-extrabold leading-tight" style={{ overflowWrap: 'anywhere' }}>{name || 'Tên của bạn'}</div>
          <div className="muted text-[14px]">@{handle || 'ban'}</div>
        </div>
        {avatarUrl && <div className="pb-1.5"><Button size="sm" onClick={onAvatarRemove}>Gỡ ảnh đại diện</Button></div>}
      </div>
      <span className="muted text-[13px] leading-[1.6] mt-3">Ảnh bìa nên là ảnh ngang từ 1200 x 400px. Ảnh đại diện nên vuông, tối thiểu 256px, hiện ở bài viết, bình luận và bảng xếp hạng.</span>
      <input ref={coverRef} type="file" accept="image/*" hidden aria-label="Tệp ảnh bìa" onChange={(e) => { const f = e.target.files?.[0]; if (f) onCover(f); e.target.value = ''; }} />
      <input ref={avatarRef} type="file" accept="image/*" hidden aria-label="Tệp ảnh đại diện" onChange={(e) => { const f = e.target.files?.[0]; if (f) onAvatar(f); e.target.value = ''; }} />
    </div>
  );
}

export function LinksCard({ links, onChange }: { links: ProfileLink[]; onChange: (links: ProfileLink[]) => void }) {
  const update = (i: number, patch: Partial<ProfileLink>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="card p-6 flex flex-col gap-3.5">
      <div className="flex items-center">
        <span className="font-semibold">Liên kết</span>
        <span className="flex-grow" />
        <Button size="sm" icon={<Plus size={14} />} disabled={links.length >= 6} onClick={() => onChange([...links, { kind: 'website', label: 'Website', url: '' }])}>Thêm liên kết</Button>
      </div>
      {links.length === 0 && <span className="muted text-[13px]">Chưa có liên kết nào. Thêm website, Facebook, YouTube hoặc Zalo.</span>}
      {links.map((l, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-[10px] inline-flex items-center justify-center flex-shrink-0" style={{ background: T.bg, color: T.ink2 }}>{linkIcon(l.kind)}</span>
          {/* Ô chọn loại rộng cố định, ô link lấy phần còn lại; màn hình hẹp thì ô link xuống dòng dưới. */}
          <div className="flex-grow min-w-0 flex gap-2 flex-wrap">
            <div style={{ flex: '0 0 140px' }}>
              <Select value={l.kind} aria-label="Loại liên kết" onChange={(e) => { const k = LINK_KINDS.find((x) => x.kind === e.target.value); update(i, { kind: e.target.value, label: k?.label ?? e.target.value }); }}>
                {LINK_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
              </Select>
            </div>
            <div className="min-w-0" style={{ flex: '1 1 180px' }}>
              <Input value={l.url} aria-label="Địa chỉ liên kết" placeholder={l.kind === 'zalo' ? 'Số Zalo hoặc link zalo.me' : 'https://…'} maxLength={200} onChange={(e) => update(i, { url: e.target.value })} />
            </div>
          </div>
          <button type="button" aria-label="Xóa liên kết" style={{ color: T.ink3 }} onClick={() => onChange(links.filter((_, j) => j !== i))}><X size={16} /></button>
        </div>
      ))}
    </div>
  );
}

const PRIVACY_ROWS: Array<[keyof Privacy, string]> = [
  ['publicProfile', 'Hiện hồ sơ với người chưa tham gia hội'],
  ['showProgress', 'Hiện tiến độ học trên hồ sơ'],
  ['showCommunities', 'Hiện các hội tôi tham gia'],
  ['allowMessages', 'Cho phép thành viên khác nhắn tin cho tôi'],
];
export function PrivacyCard({ privacy, onChange }: { privacy: Privacy; onChange: (p: Privacy) => void }) {
  return (
    <div className="card px-6 py-5 flex flex-col gap-3.5">
      <span className="font-semibold">Quyền riêng tư</span>
      {PRIVACY_ROWS.map(([key, label]) => (
        <div key={key} className="flex items-center gap-2.5 text-[14px]">
          <span className="flex-grow">{label}</span>
          <Toggle on={privacy[key]} label={label} onChange={(v) => onChange({ ...privacy, [key]: v })} />
        </div>
      ))}
    </div>
  );
}

/** Đổi mật khẩu: nhập mật khẩu hiện tại, mật khẩu mới và xác nhận. Mặc định đẩy các thiết bị khác ra. */
export function PasswordCard() {
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [logoutOthers, setLogoutOthers] = useState(true);
  const [show, setShow] = useState(false);
  const [done, setDone] = useState(false);
  const m = useMutation({
    mutationFn: () => api.post('/v1/me/password', { currentPassword: f.currentPassword, newPassword: f.newPassword, logoutOthers }),
    onSuccess: () => {
      setF({ currentPassword: '', newPassword: '', confirm: '' });
      setDone(true);
      setTimeout(() => setDone(false), 4000);
    },
  });
  const tooShort = f.newPassword.length > 0 && f.newPassword.length < 8;
  const mismatch = f.confirm.length > 0 && f.confirm !== f.newPassword;
  const same = f.newPassword.length > 0 && f.newPassword === f.currentPassword;
  const ok = f.currentPassword.length > 0 && f.newPassword.length >= 8 && f.confirm === f.newPassword && !same;
  const eye = (
    <button type="button" aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShow((v) => !v)} style={{ color: T.ink3 }}>
      {show ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
  return (
    <div id="mat-khau" className="card px-6 py-5 flex flex-col gap-3.5" style={{ scrollMarginTop: 80 }}>
      <div className="flex items-center gap-2">
        <span className="font-semibold">Đổi mật khẩu</span>
        {done && <span className="text-[13px] font-semibold" style={{ color: T.teal }}>Đã đổi mật khẩu</span>}
      </div>
      <div className="grid-2">
        <Field label="Mật khẩu hiện tại">
          <Input type={show ? 'text' : 'password'} autoComplete="current-password" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} right={eye} />
        </Field>
        <span className="hide-mobile" />
        <Field label="Mật khẩu mới" hint={tooShort ? 'Tối thiểu 8 ký tự' : same ? 'Phải khác mật khẩu hiện tại' : 'Tối thiểu 8 ký tự'}>
          <Input type={show ? 'text' : 'password'} autoComplete="new-password" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} />
        </Field>
        <Field label="Nhập lại mật khẩu mới" hint={mismatch ? 'Hai ô chưa khớp' : undefined}>
          <Input type={show ? 'text' : 'password'} autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} />
        </Field>
      </div>
      {m.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}
      <div className="flex items-center gap-3 flex-wrap pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
        <Toggle on={logoutOthers} onChange={setLogoutOthers} label="Đăng xuất khỏi các thiết bị khác" />
        <span className="flex-grow" />
        <Button size="sm" variant="dark" loading={m.isPending} disabled={!ok} onClick={() => m.mutate()}>Đổi mật khẩu</Button>
      </div>
    </div>
  );
}

export function AccountCard({ email, verifiedAt, onLogout }: { email: string; verifiedAt: string | null; onLogout: () => void }) {
  return (
    <div id="tai-khoan" className="card px-6 py-5 flex flex-col gap-3.5" style={{ scrollMarginTop: 80 }}>
      <span className="font-semibold">Tài khoản</span>
      <div className="flex items-center gap-3 text-[14px] flex-wrap">
        <span className="muted" style={{ width: 130 }}>Email đăng nhập</span>
        <span className="font-medium">{email}</span>
        {verifiedAt ? <Tag tone="teal">Đã xác minh</Tag> : <Link to="/xac-minh-email" className="text-[13px] font-semibold">Chưa xác minh · xác minh ngay</Link>}
      </div>
      <div className="flex items-center gap-3 text-[14px] flex-wrap">
        <span className="muted" style={{ width: 130 }}>Mật khẩu</span>
        <a href="#mat-khau" className="text-[13px] font-semibold">Đổi mật khẩu</a>
      </div>
      <TwoFactorCard />
      <div className="flex items-center gap-3 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
        <span className="muted text-[13px] flex-grow">Đăng xuất khỏi thiết bị này. Các phiên khác vẫn giữ nguyên.</span>
        <Button size="sm" style={{ color: T.accentText }} onClick={onLogout}>Đăng xuất</Button>
      </div>
    </div>
  );
}
