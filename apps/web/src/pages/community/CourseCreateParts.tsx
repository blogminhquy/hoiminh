// Khối form của màn Tạo/Sửa khóa học: Thông tin, Ai được học, Nâng cao, và rail xem trước + checklist.
import { Field, HEX, Input, OptionCard, Select, T, Tag } from '@hoiminh/ui';
import { Check, Sparkles, Video } from 'lucide-react';
import { Checklist, CoverPicker, MdEditor, ToggleRow } from '@/components/EditorBits';
import { money } from '@/lib/format';

export interface CourseForm {
  title: string; shortDescription: string; descriptionMd: string; coverFileId: string | null; coverUrl: string | null; coverColor: string; introVideoUrl: string;
  accessMode: 'all_members' | 'premium' | 'store_only' | 'premium_and_store'; priceMinor: number | null; compareAtMinor: number | null;
  previewFirstModule: boolean; affiliateEnabled: boolean; dripEnabled: boolean; certificateEnabled: boolean; sequential: boolean; hiddenFromStore: boolean;
}
export const EMPTY_COURSE: CourseForm = { title: '', shortDescription: '', descriptionMd: '', coverFileId: null, coverUrl: null, coverColor: HEX.accent, introVideoUrl: '', accessMode: 'premium_and_store', priceMinor: null, compareAtMinor: null, previewFirstModule: true, affiliateEnabled: true, dripEnabled: false, certificateEnabled: true, sequential: false, hiddenFromStore: false };
export const ACCESS_LABEL: Record<CourseForm['accessMode'], string> = { all_members: 'Mọi thành viên', premium: 'Premium', store_only: 'Bán lẻ', premium_and_store: 'Premium miễn phí' };

type Patch = (p: Partial<CourseForm>) => void;
const PROVIDER_LABEL: Record<string, string> = { youtube: 'YouTube', tiktok: 'TikTok', facebook: 'Facebook', loom: 'Loom', vimeo: 'Vimeo', bunny: 'Bunny' };

export function InfoBlock({ f, patch, provider, onCover, uploading }: { f: CourseForm; patch: Patch; provider: string | null | undefined; onCover: (file: File) => void; uploading: boolean }) {
  return (
    <div className="card p-6 flex flex-col gap-[18px]">
      <div className="font-bold text-[15px]">Thông tin</div>
      <div className="flex gap-5 flex-col md:flex-row">
        <div className="md:w-[280px] flex-shrink-0"><CoverPicker title={f.title} coverUrl={f.coverUrl} coverColor={f.coverColor} onColor={(c) => patch({ coverColor: c, coverUrl: null, coverFileId: null })} onFile={onCover} uploading={uploading} /></div>
        <div className="flex-grow flex flex-col gap-3.5 min-w-0">
          <Field label="Tên khóa học" hint={`${f.title.length}/80 ký tự · hiện trên thẻ và trang bán`}><Input maxLength={80} value={f.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Ví dụ: AI Agent cho chủ shop" /></Field>
          <Field label="Mô tả ngắn" hint="1 câu, hiện dưới tên"><Input maxLength={200} value={f.shortDescription} onChange={(e) => patch({ shortDescription: e.target.value })} placeholder="Khóa này giúp học viên làm được gì?" /></Field>
          <Field label="Video giới thiệu" hint="Dán link YouTube, TikTok, Facebook, Loom hoặc Bunny">
            <Input left={<Video size={16} style={{ color: T.ink3 }} />} value={f.introVideoUrl} onChange={(e) => patch({ introVideoUrl: e.target.value })} placeholder="youtube.com/watch?v=…" right={f.introVideoUrl ? (provider ? <Tag tone="teal"><Check size={11} />{PROVIDER_LABEL[provider] ?? provider}</Tag> : provider === null ? <Tag tone="danger">Không nhận diện</Tag> : null) : null} />
          </Field>
        </div>
      </div>
      <Field label="Mô tả đầy đủ"><MdEditor value={f.descriptionMd} onChange={(v) => patch({ descriptionMd: v })} placeholder="Học xong bạn làm được gì? Dành cho ai? Cần chuẩn bị gì trước khi học?" /></Field>
    </div>
  );
}

function PriceInput({ label, value, onChange, strong }: { label: string; value: number | null; onChange: (v: number | null) => void; strong?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="muted text-[12px]">{label}</span>
      <span className="input" style={{ width: 160, height: 36, fontWeight: strong ? 600 : 400 }}>
        <input inputMode="numeric" value={value === null ? '' : value.toLocaleString('vi-VN')} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '')); onChange(e.target.value.trim() ? n : null); }} placeholder="0" />
        <span className="muted">đ</span>
      </span>
    </div>
  );
}

export function AccessBlock({ f, patch }: { f: CourseForm; patch: Patch }) {
  const sells = f.accessMode === 'store_only' || f.accessMode === 'premium_and_store';
  return (
    <div className="card p-6 flex flex-col gap-3.5">
      <div><div className="font-bold text-[15px]">Ai được học</div><div className="muted text-[13px]">Chọn một, đổi được sau. Quyền truy cập tính theo tier (mục Giá và gói).</div></div>
      <div className="grid-2" style={{ gap: 10 }}>
        <OptionCard on={f.accessMode === 'all_members'} onClick={() => patch({ accessMode: 'all_members' })} title="Mọi thành viên" sub="Ai vào hội cũng học được, kể cả gói Tiêu chuẩn" />
        <OptionCard on={f.accessMode === 'premium'} onClick={() => patch({ accessMode: 'premium' })} title="Thành viên Premium" sub="Người gói Tiêu chuẩn thấy khóa nhưng bị khóa, có nút nâng cấp" />
        <OptionCard on={f.accessMode === 'store_only'} onClick={() => patch({ accessMode: 'store_only' })} title="Bán lẻ trong Cửa hàng" sub="Ai cũng mua được, kể cả người ngoài hội" />
        <OptionCard on={f.accessMode === 'premium_and_store'} onClick={() => patch({ accessMode: 'premium_and_store' })} title="Premium miễn phí + bán lẻ cho người khác" sub="Cách thường dùng: Premium học luôn, người khác mua lẻ" />
      </div>
      {sells && (
        <div className="flex gap-2.5 flex-wrap items-end">
          <PriceInput label="Giá bán lẻ" value={f.priceMinor} onChange={(v) => patch({ priceMinor: v })} strong />
          <PriceInput label="Giá gốc (gạch)" value={f.compareAtMinor} onChange={(v) => patch({ compareAtMinor: v })} />
          <span className="muted text-[12px] pb-2.5">Giá hiện trên thẻ và trang bán trong Cửa hàng</span>
        </div>
      )}
      <ToggleRow className="pt-2.5" label="Cho xem thử module đầu tiên với người chưa có quyền" on={f.previewFirstModule} onChange={(v) => patch({ previewFirstModule: v })} />
      <ToggleRow label="Cộng sự được nhận hoa hồng khi bán lẻ khóa này" on={f.affiliateEnabled && sells} onChange={(v) => patch({ affiliateEnabled: v })} />
    </div>
  );
}

export function AdvancedBlock({ f, patch }: { f: CourseForm; patch: Patch }) {
  return (
    <div className="card px-6 py-5 flex flex-col gap-3.5">
      <div className="font-semibold">Nâng cao</div>
      <div className="grid-2 text-[13px]" style={{ gap: '14px 24px' }}>
        <ToggleRow label="Mở bài theo lịch (nhỏ giọt)"><Select style={{ width: 140, height: 28 }} value={f.dripEnabled ? 'on' : 'off'} onChange={(e) => patch({ dripEnabled: e.target.value === 'on' })}><option value="off">Tắt</option><option value="on">Bật, đặt số ngày ở từng bài</option></Select></ToggleRow>
        <ToggleRow label="Cấp chứng nhận khi hoàn thành" on={f.certificateEnabled} onChange={(v) => patch({ certificateEnabled: v })} />
        <ToggleRow label="Bắt buộc học theo thứ tự" on={f.sequential} onChange={(v) => patch({ sequential: v })} />
        <ToggleRow label="Ẩn khỏi Cửa hàng và trang giới thiệu" on={f.hiddenFromStore} onChange={(v) => patch({ hiddenFromStore: v })} />
      </div>
    </div>
  );
}

export function CourseRail({ f, lessonCount, provider }: { f: CourseForm; lessonCount: number; provider: string | null | undefined }) {
  const sells = f.accessMode === 'store_only' || f.accessMode === 'premium_and_store';
  const meta = `${lessonCount} bài · ${ACCESS_LABEL[f.accessMode]}${sells && f.priceMinor ? ` · ${money(f.priceMinor)}` : ''}`;
  return (
    <>
      <div className="card p-4 flex flex-col gap-2.5">
        <div className="font-semibold text-[13px]">Xem trước thẻ</div>
        <div className="card overflow-hidden flex flex-col">
          <div className="relative flex items-end p-4" style={{ height: 160, background: f.coverUrl ? `url(${f.coverUrl}) center/cover` : f.coverColor }}>
            {!f.coverUrl && <span className="serif font-extrabold leading-[1.15]" style={{ color: T.invertInk, fontSize: 22, maxWidth: 240 }}>{f.title || 'Tên khóa học'}</span>}
            <span className="tag absolute" style={{ top: 12, left: 12, background: T.bg, color: T.ink3 }}>Nháp</span>
          </div>
          <div className="px-4 pt-3.5 pb-4 flex flex-col gap-2.5"><div className="font-semibold text-[15px] truncate">{f.title || 'Tên khóa học'}</div><div className="muted text-[12px]">{meta}</div></div>
        </div>
      </div>
      <div className="card p-4 flex flex-col gap-2">
        <div className="font-semibold text-[13px]">Trước khi đăng</div>
        <Checklist items={[{ label: 'Tên và ảnh bìa', done: f.title.trim().length >= 3 }, { label: 'Mô tả ngắn', done: f.shortDescription.trim().length > 0 }, { label: 'Chọn quyền truy cập', done: !sells || Boolean(f.priceMinor) }, { label: 'Ít nhất 1 module, 1 bài', done: lessonCount > 0 }, { label: 'Video giới thiệu (nên có)', done: Boolean(provider) }]} />
      </div>
      <div className="muted text-[12px] flex gap-2 items-start"><Sparkles size={14} className="flex-shrink-0 mt-0.5" /><span>Mẹo: đăng khi có 1 module đầy đủ, thêm dần các module sau. Thành viên được báo mỗi khi có bài mới.</span></div>
    </>
  );
}
