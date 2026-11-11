// Modal "Tạo bài viết", bản gọn: một ô viết, nút ảnh, nút Đăng. Chuyên mục tự chọn sẵn (vẫn đổi được);
// tiêu đề, nền status, video, bình chọn, link và gửi email nằm sau nút "Thêm".
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Avatar, Button, Modal, Select, T, Toggle } from '@hoiminh/ui';
import { BarChart3, ChevronDown, ChevronUp, Image as ImageIcon, Link as LinkIcon, Mail, Video } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { StatusBox } from '@/components/post/PostCard';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { isPremium, useCan, useShell } from '@/lib/community';
import { BgStrip, ImagePicker, LinkInput, PollEditor, STATUS_MAX, VideoInput, useFilePicker, type PickedImage, type PollDraft } from './ComposerParts';

export interface ComposerSpace { id: string; name: string; colorKey: string; postPermission: string }
interface FeedMeta { spaces: ComposerSpace[]; access: { canBroadcast: boolean } }

const lastSpaceKey = (communityId: string) => `hm_last_space_${communityId}`;
function readLastSpace(communityId: string): string {
  try { return localStorage.getItem(lastSpaceKey(communityId)) ?? ''; } catch { return ''; }
}
function rememberSpace(communityId: string, spaceId: string): void {
  try { localStorage.setItem(lastSpaceKey(communityId), spaceId); } catch { /* chế độ riêng tư: lần sau chọn lại theo mặc định */ }
}

/**
 * Chuyên mục chọn sẵn khi mở khung soạn, chỉ trong các chuyên mục người này đăng được:
 * mục đang lọc ở bảng tin → mục đăng lần trước → "Chia sẻ" → mục đầu tiên.
 */
export function pickDefaultSpace(spaces: ComposerSpace[], opts: { preferred?: string; last?: string; canModerate: boolean; premium: boolean }): string {
  const allowed = spaces.filter((s) => opts.canModerate || s.postPermission === 'everyone' || (s.postPermission === 'premium' && opts.premium));
  const has = (id?: string) => (id && allowed.some((s) => s.id === id) ? id : '');
  return has(opts.preferred) || has(opts.last) || allowed.find((s) => s.name.trim().toLowerCase() === 'chia sẻ')?.id || allowed[0]?.id || '';
}

const Tool = ({ icon, label, on, onClick }: { icon: ReactNode; label: string; on?: boolean; onClick?: () => void }) => (
  <button type="button" aria-pressed={on} onClick={onClick} className="chip" style={on ? { background: T.primarySoft, color: T.primaryText, borderColor: T.primarySoft } : undefined}>{icon}{label}</button>
);

export function Composer({ open, onClose, defaultSpaceId }: { open: boolean; onClose: () => void; defaultSpaceId?: string }) {
  const shell = useShell();
  const can = useCan();
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const cid = shell.community.id;
  const meta = useQuery({ queryKey: ['feed', cid, 'meta'], queryFn: () => api.get<FeedMeta>(`/v1/communities/${cid}/feed?limit=1`), enabled: open, staleTime: 60_000 });
  const spaces = useMemo(() => meta.data?.spaces ?? [], [meta.data]);
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
  const [more, setMore] = useState(false);
  const picker = useFilePicker();

  // Chọn sẵn chuyên mục khi mở khung (hoặc khi danh sách chuyên mục vừa tải xong); người dùng đã tự chọn thì giữ.
  const premium = isPremium(shell);
  const canModerate = can('post.moderate');
  useEffect(() => {
    if (!open || spaces.length === 0) return;
    setSpaceId((cur) => (cur && spaces.some((s) => s.id === cur) ? cur : pickDefaultSpace(spaces, { preferred: defaultSpaceId, last: readLastSpace(cid), canModerate, premium })));
  }, [open, spaces, defaultSpaceId, cid, canModerate, premium]);

  const len = content.trim().length;
  const eligible = len <= STATUS_MAX && !title.trim() && images.length === 0 && !/!\[/.test(content);
  const showBg = eligible && Boolean(bgKey);

  const reset = () => { setSpaceId(''); setTitle(''); setContent(''); setBgKey(null); setImages([]); setVideo({ open: false, url: null }); setPoll(null); setLink(null); setBroadcast(false); setMore(false); };
  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>(`/v1/communities/${cid}/posts`, {
      spaceId, title: title.trim(), contentMd: content.trim(), statusBgKey: showBg ? bgKey : null,
      imageFileIds: images.map((i) => i.fileId), videoUrl: video.url, linkUrl: link?.trim() || null, broadcastEmail: broadcast && canBroadcast,
      poll: poll && poll.question.trim() ? { question: poll.question.trim(), options: poll.options.map((o) => o.trim()).filter(Boolean), multipleChoice: poll.multipleChoice } : null,
    }),
    onSuccess: (p) => { rememberSpace(cid, spaceId); void qc.invalidateQueries({ queryKey: ['feed'] }); reset(); onClose(); navigate(`/${shell.community.slug}/bai-viet/${p.id}`); },
  });
  const valid = Boolean(spaceId) && len > 0 && (!poll || (poll.question.trim() && poll.options.filter((o) => o.trim()).length >= 2));

  return (
    <Modal open={open} onClose={onClose} title="Tạo bài viết" width={620}>
      <div className="px-5 py-4 flex flex-col gap-3.5">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name} src={user?.avatarUrl} size={44} />
          <div className="min-w-0">
            <div className="font-semibold truncate">{user?.name}</div>
            <Select variant="chip" aria-label="Chuyên mục" className="mt-1" value={spaceId} onChange={(e) => setSpaceId(e.target.value)} style={{ height: 32, fontSize: 14, maxWidth: '100%', background: T.primarySoft, color: T.primaryText, borderColor: T.primarySoft }}>
              {!spaceId && <option value="">{meta.isLoading ? 'Đang tải…' : 'Chọn chuyên mục'}</option>}
              {spaces.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </div>

        {showBg && (
          <div className="relative">
            <StatusBox text={content || 'Viết gì đó…'} bgKey={bgKey} height={260} fontSize={28} />
          </div>
        )}
        <span className="input textarea" style={{ borderRadius: 12 }}>
          <textarea autoFocus rows={showBg ? 2 : 5} aria-label="Nội dung bài viết" placeholder="Bạn muốn chia sẻ gì?" value={content} onChange={(e) => setContent(e.target.value)} style={{ fontSize: 16 }} />
        </span>

        <ImagePicker images={images} onChange={setImages} communityId={cid} inputRef={picker.ref} />

        {more && (
          <div className="flex flex-col gap-3 p-3 rounded-xl" style={{ background: T.bg }}>
            <span className="input"><input aria-label="Tiêu đề" placeholder="Tiêu đề (không bắt buộc)" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} /></span>
            <div className="flex gap-2 flex-wrap">
              <Tool icon={<Video size={16} />} label="Video" on={video.open} onClick={() => setVideo((v) => ({ open: !v.open, url: v.open ? null : v.url }))} />
              <Tool icon={<BarChart3 size={16} />} label="Bình chọn" on={Boolean(poll)} onClick={() => setPoll(poll ? null : { question: '', options: ['', ''], multipleChoice: false })} />
              <Tool icon={<LinkIcon size={16} />} label="Link" on={link !== null} onClick={() => setLink(link === null ? '' : null)} />
            </div>
            {video.open && <VideoInput value={video.url} onChange={(u) => setVideo({ open: true, url: u })} onClose={() => setVideo({ open: false, url: null })} />}
            {poll && <PollEditor poll={poll} onChange={setPoll} onClose={() => setPoll(null)} />}
            {link !== null && <LinkInput value={link} onChange={setLink} onClose={() => setLink(null)} />}
            {eligible && (
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold" style={{ color: T.ink2 }}>Nền màu cho bài ngắn (dưới {STATUS_MAX} ký tự, không ảnh)</span>
                <BgStrip bgKey={bgKey} onPick={setBgKey} />
              </div>
            )}
            {canBroadcast && (
              <label className="flex items-center gap-2.5 text-[13px]" style={{ color: T.ink2 }}>
                <Mail size={16} /><span className="flex-grow">Gửi email cho tất cả thành viên</span>
                <Toggle on={broadcast} onChange={setBroadcast} label="Gửi email" />
              </label>
            )}
          </div>
        )}

        {create.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(create.error)}</span>}
        <div className="flex items-center gap-2 pt-3" style={{ borderTop: `1px solid ${T.line}` }}>
          {/* Điện thoại 390px: ba nút với lề 18px rộng hơn khung 20px, nút Đăng bài tràn ra ngoài. Hai nút phụ dùng lề 12px. */}
          <Button className="max-md:!px-3" icon={<ImageIcon size={18} />} onClick={picker.open}>Ảnh</Button>
          <Button className="max-md:!px-3" aria-expanded={more} onClick={() => setMore((v) => !v)}>Thêm {more ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</Button>
          <span className="flex-grow" />
          <Button variant="primary" loading={create.isPending} disabled={!valid} onClick={() => create.mutate()}>Đăng bài</Button>
        </div>
      </div>
    </Modal>
  );
}
