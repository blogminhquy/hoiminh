// Form soạn một bài học (phải) và modal nhập nhanh nhiều link YouTube cho màn Soạn nội dung khóa học.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Chip, ErrorBox, Field, Input, Modal, Select, T, Tag, Textarea } from '@hoiminh/ui';
import { Check, CheckSquare, ExternalLink, FileText, Link as LinkIcon, Paperclip, Play, Plus, Video, X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MdEditor, ToggleRow } from '@/components/EditorBits';
import { LoadingBlock } from '@/components/QueryState';
import { api, errorMessage } from '@/lib/api';

export type LessonKind = 'video' | 'text' | 'task' | 'file';
export const KIND_ICON: Record<LessonKind, ReactNode> = { video: <Video size={14} />, text: <FileText size={14} />, task: <CheckSquare size={14} />, file: <Paperclip size={14} /> };
const KINDS: Array<[LessonKind, string]> = [['video', 'Video'], ['text', 'Bài viết'], ['task', 'Bài tập'], ['file', 'Tài liệu']];
const PROVIDER_LABEL: Record<string, string> = { youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook', loom: 'Loom', vimeo: 'Vimeo', bunny: 'Bunny' };

interface LessonDto { lesson: { id: string; title: string; kind: LessonKind; videoUrl: string | null; contentMd: string; isPreview: boolean; dripDays: number; requireComplete: boolean; durationSeconds: number | null }; embed: { provider: string; embedUrl: string } | null; resources: Array<{ id: string; fileId: string | null; name: string }> }
interface Draft { title: string; kind: LessonKind; videoUrl: string; contentMd: string; isPreview: boolean; dripDays: number; requireComplete: boolean; durationMinutes: string; resources: Array<{ key: string; fileId: string | null; name: string }> }

export function LessonForm({ courseId, lessonId, communityId, moduleIndex, lessonIndex, previewUrl }: { courseId: string; lessonId: string; communityId: string; moduleIndex: number; lessonIndex: number; previewUrl: string }) {
  const q = useQuery({ queryKey: ['lesson', lessonId], queryFn: () => api.get<LessonDto>(`/v1/lessons/${lessonId}`) });
  if (q.isLoading) return <div className="p-5"><LoadingBlock rows={2} /></div>;
  if (q.isError || !q.data) return <div className="p-5"><ErrorBox message={errorMessage(q.error)} onRetry={() => void q.refetch()} /></div>;
  return <LessonEditor key={lessonId} courseId={courseId} communityId={communityId} data={q.data} moduleIndex={moduleIndex} lessonIndex={lessonIndex} previewUrl={previewUrl} />;
}

function LessonEditor({ courseId, communityId, data, moduleIndex, lessonIndex, previewUrl }: { courseId: string; communityId: string; data: LessonDto; moduleIndex: number; lessonIndex: number; previewUrl: string }) {
  const qc = useQueryClient();
  const l = data.lesson;
  const [d, setD] = useState<Draft>({ title: l.title, kind: l.kind, videoUrl: l.videoUrl ?? '', contentMd: l.contentMd, isPreview: l.isPreview, dripDays: l.dripDays, requireComplete: l.requireComplete, durationMinutes: l.durationSeconds ? String(Math.round(l.durationSeconds / 60)) : '', resources: data.resources.map((r) => ({ key: r.id, fileId: r.fileId, name: r.name })) });
  const [embed, setEmbed] = useState<{ provider: string; embedUrl: string } | null | undefined>(data.embed);
  const [resourcesTouched, setResourcesTouched] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const patch = (p: Partial<Draft>) => setD((prev) => ({ ...prev, ...p }));

  useEffect(() => {
    const url = d.videoUrl.trim();
    if (!url) { setEmbed(undefined); return; }
    if (url === (l.videoUrl ?? '')) { setEmbed(data.embed); return; }
    const t = setTimeout(() => { void api.post<{ embed: { provider: string; embedUrl: string } | null }>('/v1/video/parse', { url }).then((r) => setEmbed(r.embed)).catch(() => setEmbed(null)); }, 500);
    return () => clearTimeout(t);
  }, [d.videoUrl, l.videoUrl, data.embed]);

  const save = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = { title: d.title.trim(), kind: d.kind, videoUrl: d.videoUrl.trim() || null, contentMd: d.contentMd, isPreview: d.isPreview, dripDays: d.dripDays, requireComplete: d.requireComplete, durationSeconds: d.durationMinutes ? Number(d.durationMinutes) * 60 : null };
      if (resourcesTouched) body.resourceFileIds = d.resources.map((r) => r.fileId).filter((x): x is string => Boolean(x));
      return api.patch(`/v1/courses/${courseId}/lessons/${l.id}`, body);
    },
    onSuccess: () => { setResourcesTouched(false); void qc.invalidateQueries({ queryKey: ['lesson', l.id] }); void qc.invalidateQueries({ queryKey: ['course', courseId] }); },
  });
  const addFiles = async (files: FileList) => {
    setUploading(true);
    try {
      const added: Draft['resources'] = [];
      for (const f of Array.from(files)) { const r = await api.upload(f, 'lesson_resource', { communityId }); added.push({ key: r.fileId, fileId: r.fileId, name: f.name }); }
      patch({ resources: [...d.resources, ...added] });
      setResourcesTouched(true);
    } catch (e) { window.alert(errorMessage(e)); } finally { setUploading(false); }
  };
  const missingFileId = resourcesTouched && d.resources.some((r) => !r.fileId);
  return (
    <>
      <div className="flex items-center gap-3 px-5 py-3.5 flex-wrap" style={{ borderBottom: `1px solid ${T.line}` }}>
        <Tag tone="neutral" style={{ color: T.ink2 }}>Module {moduleIndex + 1} · Bài {lessonIndex + 1}</Tag>
        <div className="flex gap-1.5 flex-wrap">{KINDS.map(([k, label]) => <Chip key={k} on={d.kind === k} style={{ height: 28, fontSize: 12 }} onClick={() => patch({ kind: k })}>{KIND_ICON[k]}{label}</Chip>)}</div>
        <span className="flex-grow" />
        <a className="btn btn-ghost btn-sm" href={previewUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} />Xem trước</a>
        <Button size="sm" variant="dark" loading={save.isPending} disabled={!d.title.trim()} onClick={() => save.mutate()}>Lưu bài</Button>
      </div>
      <div className="p-5 flex flex-col gap-4">
        {save.isError && <div className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(save.error)}</div>}
        {save.isSuccess && !save.isPending && <div className="text-[13px] font-semibold" style={{ color: T.teal }}>Đã lưu bài</div>}
        <Field label="Tên bài"><Input value={d.title} onChange={(e) => patch({ title: e.target.value })} maxLength={160} /></Field>
        {(d.kind === 'video' || d.videoUrl) && (
          <Field label="Video">
            <div className="flex gap-3 flex-col sm:flex-row">
              <div className="rounded-[10px] flex items-center justify-center overflow-hidden flex-shrink-0" style={{ width: 200, maxWidth: '100%', aspectRatio: '16 / 9', background: T.player, color: T.surface }}>
                {embed ? <iframe title="Xem trước video" src={embed.embedUrl} className="w-full h-full" allow="autoplay; fullscreen" /> : <Play size={24} />}
              </div>
              <div className="flex-grow flex flex-col gap-2 min-w-0">
                <Input left={<LinkIcon size={16} style={{ color: T.ink3 }} />} value={d.videoUrl} onChange={(e) => patch({ videoUrl: e.target.value })} placeholder="youtube.com/watch?v=…" right={d.videoUrl.trim() ? (embed ? <Tag tone="teal"><Check size={11} />{PROVIDER_LABEL[embed.provider] ?? embed.provider}</Tag> : embed === null ? <Tag tone="danger">Không nhận diện</Tag> : null) : null} />
                <div className="muted text-[12px]">Dán link YouTube, TikTok, Facebook, Loom, Vimeo hoặc Bunny. Video ẩn trên YouTube vẫn phát được. Đặt "Không liệt kê" để người ngoài không tìm thấy.</div>
              </div>
            </div>
          </Field>
        )}
        <Field label="Nội dung bài"><MdEditor value={d.contentMd} onChange={(v) => patch({ contentMd: v })} minHeight={140} note="Markdown" tools={['b', 'i', 'h2', 'h3', 'ul', 'ol', 'quote', 'link', 'img', 'code']} placeholder="Nội dung, ghi chú, bài tập…" /></Field>
        <div className="flex gap-4 flex-col md:flex-row">
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <span className="text-[13px] font-semibold">Tài liệu đính kèm</span>
            <div className="flex gap-2 flex-wrap">
              {d.resources.map((r) => <span key={r.key} className="chip"><FileText size={14} /><span className="truncate" style={{ maxWidth: 180 }}>{r.name}</span><button type="button" aria-label="Xóa tệp" onClick={() => { patch({ resources: d.resources.filter((x) => x.key !== r.key) }); setResourcesTouched(true); }} style={{ color: T.ink3 }}><X size={12} /></button></span>)}
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) void addFiles(e.target.files); e.target.value = ''; }} />
              <Chip style={{ borderStyle: 'dashed' }} disabled={uploading} onClick={() => fileRef.current?.click()}><Plus size={14} />{uploading ? 'Đang tải…' : 'Thêm tệp'}</Chip>
            </div>
            {missingFileId && <span className="muted text-[12px]">Tệp cũ chưa có mã sẽ bị bỏ khi lưu; tải lại tệp nếu cần giữ.</span>}
          </div>
          <div className="md:w-[300px] flex-shrink-0 flex flex-col gap-2.5 rounded-[12px] px-3.5 py-3 text-[13px]" style={{ background: T.bg }}>
            <ToggleRow label="Cho xem thử (không cần quyền)" on={d.isPreview} onChange={(v) => patch({ isPreview: v })} />
            <ToggleRow label="Mở sau khi vào khóa"><Select style={{ width: 120, height: 26, fontSize: 12 }} value={String(d.dripDays)} onChange={(e) => patch({ dripDays: Number(e.target.value) })}><option value="0">Ngay</option>{[1, 3, 7, 14, 30, 60].map((n) => <option key={n} value={n}>{n} ngày</option>)}</Select></ToggleRow>
            <ToggleRow label="Phải hoàn thành mới qua bài sau" on={d.requireComplete} onChange={(v) => patch({ requireComplete: v })} />
            <ToggleRow label="Thời lượng (phút)"><span className="input" style={{ width: 80, height: 26, fontSize: 12 }}><input inputMode="numeric" value={d.durationMinutes} onChange={(e) => patch({ durationMinutes: e.target.value.replace(/\D/g, '') })} /></span></ToggleRow>
          </div>
        </div>
      </div>
    </>
  );
}

/** Nhập nhanh: mỗi link YouTube một bài vào module đang mở. */
export function BulkImportModal({ open, onClose, courseId, moduleId }: { open: boolean; onClose: () => void; courseId: string; moduleId: string | null }) {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const m = useMutation({
    mutationFn: async () => {
      const links = text.split(/\s+/).map((s) => s.trim()).filter((s) => /^https?:\/\//.test(s));
      let n = 0;
      for (const [i, url] of links.entries()) {
        const r = await api.post<{ embed: { provider: string; externalId: string } | null }>('/v1/video/parse', { url });
        if (!r.embed) continue;
        await api.post(`/v1/courses/${courseId}/lessons`, { moduleId, title: `Bài ${i + 1} · ${r.embed.provider === 'youtube' ? 'YouTube' : r.embed.provider} ${r.embed.externalId}`.slice(0, 160), kind: 'video', videoUrl: url });
        n++;
      }
      return n;
    },
    onSuccess: () => { setText(''); void qc.invalidateQueries({ queryKey: ['course', courseId] }); onClose(); },
  });
  if (!open) return null;
  return (
    <Modal open onClose={onClose} title="Nhập nhanh từ danh sách link" width={520}>
      <div className="p-5 flex flex-col gap-3">
        <span className="muted text-[13px]">Dán nhiều link YouTube (mỗi dòng một link). Mỗi link thành một bài video trong module đang mở, bạn đổi tên bài sau.</span>
        <Textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder={'https://youtube.com/watch?v=…\nhttps://youtu.be/…'} />
        {!moduleId && <span className="text-[13px]" style={{ color: T.accentText }}>Hãy tạo và mở một module trước.</span>}
        {m.isError && <span className="text-[13px]" style={{ color: T.accentText }}>{errorMessage(m.error)}</span>}
        <div className="flex gap-2 justify-end"><Button size="sm" onClick={onClose}>Hủy</Button><Button size="sm" variant="primary" loading={m.isPending} disabled={!moduleId || !text.trim()} onClick={() => m.mutate()}>Tạo bài</Button></div>
      </div>
    </Modal>
  );
}
