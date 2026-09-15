// Modal "Tạo bài viết": chuyên mục bắt buộc, Markdown, nền cho status ngắn, ảnh/video/bình chọn/link, gửi email cho thành viên.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Modal, T, Toggle } from '@hoiminh/ui';
import { AtSign, BarChart3, Check, ChevronDown, Image as ImageIcon, Link as LinkIcon, Mail, Paperclip, Users, Video } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBox } from '@/components/post/PostCard';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useCan, useShell } from '@/lib/community';
import { BgStrip, ImagePicker, LinkInput, PollEditor, STATUS_MAX, VideoInput, useFilePicker, type PickedImage, type PollDraft } from './ComposerParts';

interface Space { id: string; name: string; colorKey: string; postPermission: string }
interface FeedMeta { spaces: Space[]; access: { canBroadcast: boolean } }

const Tool = ({ icon, label, on, onClick }: { icon: ReactNode; label: string; on?: boolean; onClick?: () => void }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} className="w-9 h-9 rounded-[9px] inline-flex items-center justify-center" style={{ background: on ? T.accentSoft : 'transparent', color: on ? T.accentText : T.ink2 }}>{icon}</button>
);

export function Composer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shell = useShell();
  const can = useCan();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const cid = shell.community.id;
  const meta = useQuery({ queryKey: ['feed', cid, 'meta'], queryFn: () => api.get<FeedMeta>(`/v1/communities/${cid}/feed?limit=1`), enabled: open, staleTime: 60_000 });
  const spaces = meta.data?.spaces ?? [];
  const canBroadcast = can('post.broadcast') || Boolean(meta.data?.access.canBroadcast);

  const [spaceId, setSpaceId] = useState('');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [bgKey, setBgKey] = useState<string | null>(null);
  const [images, setImages] = useState<PickedImage[]>([]);
  const [video, setVideo] = useState<{ open: boolean; url: string | null }>({ open: false, url: null });
  const [poll, setPoll] = useState<PollDraft | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [broadcast, setBroadcast] = useState(false);
  const picker = useFilePicker();

  const len = content.trim().length;
  const eligible = len <= STATUS_MAX && !title.trim() && images.length === 0 && !/!\[/.test(content);
  const showBg = eligible && Boolean(bgKey);

  const reset = () => { setTitle(''); setContent(''); setBgKey(null); setImages([]); setVideo({ open: false, url: null }); setPoll(null); setLink(null); setBroadcast(false); };
  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/v1/communities/${cid}/posts`, {
      spaceId, title: title.trim(), contentMd: content.trim(), statusBgKey: showBg ? bgKey : null,
      imageFileIds: images.map((i) => i.fileId), videoUrl: video.url, linkUrl: link?.trim() || null, broadcastEmail: broadcast && canBroadcast,
      poll: poll && poll.question.trim() ? { question: poll.question.trim(), options: poll.options.map((o) => o.trim()).filter(Boolean), multipleChoice: poll.multipleChoice } : null,
    }),
    onSuccess: (p) => { void qc.invalidateQueries({ queryKey: ['feed'] }); reset(); onClose(); navigate(`/${shell.community.slug}/bai-viet/${p.id}`); },
  });
  const valid = Boolean(spaceId) && len > 0 && (!poll || (poll.question.trim() && poll.options.filter((o) => o.trim()).length >= 2));

  return (
    <Modal open={open} onClose={onClose} title="Tạo bài viết" width={680}>
      <div className="px-5 py-4 flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name} src={user?.avatarUrl} size={44} />
          <div>
            <div className="font-semibold">{user?.name}</div>
            <div className="flex gap-1.5 mt-1 flex-wrap">
              <label className="chip relative" style={{ height: 26, fontSize: 12, background: T.bg, borderColor: spaceId ? T.line2 : T.accent }}>
                {spaces.find((s) => s.id === spaceId)?.name ?? 'Chọn chuyên mục'} <ChevronDown size={12} />
                <select aria-label="Chuyên mục" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full">
                  <option value="">Chọn chuyên mục</option>
                  {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <span className="chip" style={{ height: 26, fontSize: 12, background: T.bg }}><Users size={12} /> Mọi thành viên <ChevronDown size={12} /></span>
            </div>
          </div>
        </div>

        {showBg ? (
          <div className="relative">
            <StatusBox text={content || 'Viết gì đó…'} bgKey={bgKey} height={300} fontSize={30} />
            <BgStrip overlay bgKey={bgKey} onPick={setBgKey} onToggle={() => setBgKey(null)} onClear={() => setBgKey(null)} onImage={picker.open} />
          </div>
        ) : eligible ? (
          <BgStrip bgKey={bgKey} onPick={setBgKey} onToggle={() => setBgKey(bgKey ? null : 'dat')} onClear={() => setBgKey(null)} onImage={picker.open} />
        ) : null}
        <span className="input textarea" style={{ borderRadius: 12 }}>
          <textarea rows={showBg ? 2 : 6} placeholder="Chia sẻ điều gì đó với cộng đồng… (hỗ trợ Markdown)" value={content} onChange={(e) => setContent(e.target.value)} />
        </span>
        {eligible && (
          <div className="flex items-center gap-2 text-[12px]" style={{ color: T.ink3 }}>
            <Check size={14} />
            <span>Nền dùng được vì bài ngắn hơn {STATUS_MAX} ký tự và chưa có ảnh · <strong style={{ color: T.ink2 }}>{len}/{STATUS_MAX}</strong>. Thêm ảnh hoặc viết dài hơn thì nền tự tắt.</span>
          </div>
        )}
        <span className="input"><input placeholder="Tiêu đề (tùy chọn)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></span>

        <ImagePicker images={images} onChange={setImages} communityId={cid} inputRef={picker.ref} />
        {video.open && <VideoInput value={video.url} onChange={(u) => setVideo({ open: true, url: u })} onClose={() => setVideo({ open: false, url: null })} />}
        {poll && <PollEditor poll={poll} onChange={setPoll} onClose={() => setPoll(null)} />}
        {link !== null && <LinkInput value={link} onChange={setLink} onClose={() => setLink(null)} />}

        <div className="flex items-center gap-1 px-3 py-2.5 rounded-xl" style={{ border: `1px solid ${T.line2}` }}>
          <span className="text-[13px] font-semibold flex-grow">Thêm vào bài viết</span>
          <Tool icon={<ImageIcon size={20} />} label="Ảnh" on={images.length > 0} onClick={picker.open} />
          <Tool icon={<Video size={20} />} label="Video" on={video.open} onClick={() => setVideo((v) => ({ open: !v.open, url: v.open ? null : v.url }))} />
          <Tool icon={<BarChart3 size={20} />} label="Bình chọn" on={Boolean(poll)} onClick={() => setPoll(poll ? null : { question: '', options: ['', ''], multipleChoice: false })} />
          <Tool icon={<LinkIcon size={20} />} label="Link" on={link !== null} onClick={() => setLink(link === null ? '' : null)} />
          <Tool icon={<AtSign size={20} />} label="Nhắc tên" onClick={() => setContent((c) => `${c}@`)} />
          <Tool icon={<Paperclip size={20} />} label="Đính kèm" onClick={picker.open} />
        </div>

        {create.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(create.error)}</span>}
        <div className="flex items-center gap-2.5 pt-1.5 flex-wrap" style={{ borderTop: `1px solid ${T.line}` }}>
          {canBroadcast && (
            <>
              <span className="text-[13px] inline-flex items-center gap-2" style={{ color: T.ink2 }}><Mail size={16} /> Gửi email cho tất cả thành viên</span>
              <Toggle on={broadcast} onChange={setBroadcast} label="Gửi email" />
            </>
          )}
          <span className="flex-grow" />
          <Button size="sm" onClick={onClose}>Hủy</Button>
          <Button variant="primary" loading={create.isPending} disabled={!valid} onClick={() => create.mutate()}>Đăng bài</Button>
        </div>
      </div>
    </Modal>
  );
}
