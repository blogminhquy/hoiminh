// Khách xem hội mở (chưa là thành viên): dải báo "đang xem với tư cách khách" ở đầu mọi trang và hộp mời tham gia
// hiện ra khi khách bấm một nút cần là thành viên (thả tim, bình luận, bình chọn, đăng ký sự kiện).
import { Modal, T } from '@hoiminh/ui';
import { Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Shell } from '@/lib/community';

/** Dải ở đầu trang: nói rõ đang xem hội mở và việc cần làm để tham gia. Một nút duy nhất dẫn về trang giới thiệu (nơi có nút tham gia, giá và câu hỏi). */
export function GuestBanner({ shell }: { shell: Shell }) {
  return (
    <div className="card flex items-center gap-3 flex-wrap mb-4" style={{ padding: '12px 16px', borderColor: T.gold, background: T.goldSoft }}>
      <span className="flex-shrink-0" style={{ color: T.goldText }}><Globe size={20} /></span>
      <div className="flex-grow min-w-0" style={{ flexBasis: 220 }}>
        <div className="font-semibold text-[15px]" style={{ color: T.ink }}>Bạn đang xem hội mở</div>
        <div className="text-[14px]" style={{ color: T.ink2 }}>Tham gia để đăng bài, bình luận và học cùng mọi người.</div>
      </div>
      <Link to={`/${shell.community.slug}`} className="btn btn-primary flex-shrink-0">Tham gia hội</Link>
    </div>
  );
}

/** Hộp mời tham gia khi khách bấm vào việc chỉ thành viên mới làm được. */
export function JoinPrompt({ shell, open, onClose }: { shell: Shell; open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title={`Tham gia ${shell.community.name}`} width={440} footer={(
      <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: `1px solid ${T.line}` }}>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Để sau</button>
        <Link to={`/${shell.community.slug}`} className="btn btn-primary" onClick={onClose}>Tham gia hội</Link>
      </div>
    )}>
      <p className="m-0 px-5 py-5 text-[15px] leading-[1.6]" style={{ color: T.ink2 }}>
        Hội này mở cho mọi người xem. Để thả tim, bình luận, đăng bài, đăng ký sự kiện và học, bạn cần là thành viên của hội.
      </p>
    </Modal>
  );
}
