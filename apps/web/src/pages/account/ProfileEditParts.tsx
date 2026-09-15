// Khối con của trang Hồ sơ: ảnh đại diện + ảnh bìa, Liên kết, Quyền riêng tư, mục Tài khoản.
import { AVATAR_COLORS, Avatar, Button, Input, Select, T, Tag, Toggle } from '@hoiminh/ui';
import { ExternalLink, Globe, Image, MessageCircle, Plus, Video, X } from 'lucide-react';
import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

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

export function AvatarCoverBlock({ name, avatarUrl, coverColor, uploading, onPick, onRemove, onCover }: { name: string; avatarUrl: string | null; coverColor: string; uploading: boolean; onPick: (file: File) => void; onRemove: () => void; onCover: (c: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex gap-5 items-center flex-wrap">
      <Avatar name={name} src={avatarUrl} color={T.ink} size={88} />
      <div className="flex flex-col gap-2">
        <span className="font-semibold">Ảnh đại diện</span>
        <div className="flex gap-2">
          <Button size="sm" icon={<Image size={14} />} loading={uploading} onClick={() => fileRef.current?.click()}>Tải ảnh lên</Button>
          <Button size="sm" onClick={onRemove} disabled={!avatarUrl}>Xóa</Button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = ''; }} />
        </div>
        <span className="muted text-[12px]">Vuông, tối thiểu 256px. Hiện ở bài viết, bình luận và bảng xếp hạng.</span>
      </div>
      <div className="ml-auto px-3.5 py-3 rounded-xl flex flex-col gap-1.5" style={{ background: T.bg, minWidth: 200 }}>
        <span className="muted text-[12px]">Ảnh bìa hồ sơ</span>
        <div className="rounded-lg" style={{ height: 44, background: coverColor }} />
        <div className="flex gap-1.5 flex-wrap">
          {AVATAR_COLORS.map((c) => (
            <button key={c} type="button" aria-label={`Màu bìa ${c}`} onClick={() => onCover(c)} className="rounded-full" style={{ width: 20, height: 20, background: c, border: c === coverColor ? `2px solid ${T.ink}` : '2px solid transparent', outline: c === coverColor ? `2px solid ${T.surface}` : undefined, outlineOffset: -4 }} />
          ))}
        </div>
      </div>
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
          <Select value={l.kind} style={{ width: 130 }} className="flex-shrink-0" onChange={(e) => { const k = LINK_KINDS.find((x) => x.kind === e.target.value); update(i, { kind: e.target.value, label: k?.label ?? e.target.value }); }}>
            {LINK_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
          </Select>
          <Input className="flex-grow" value={l.url} placeholder={l.kind === 'zalo' ? 'Số Zalo hoặc link zalo.me' : 'https://…'} maxLength={200} onChange={(e) => update(i, { url: e.target.value })} />
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
        <span className="muted" style={{ width: 130 }}>Xác thực hai lớp</span>
        <span className="muted text-[13px]">Sắp có · bạn sẽ được nhắc bật khi tính năng ra mắt</span>
      </div>
      <div className="flex items-center gap-3 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
        <span className="muted text-[13px] flex-grow">Đăng xuất khỏi thiết bị này. Các phiên khác vẫn giữ nguyên.</span>
        <Button size="sm" style={{ color: T.accentText }} onClick={onLogout}>Đăng xuất</Button>
      </div>
    </div>
  );
}
