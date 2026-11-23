// Lời mời "Tạo hội của bạn, miễn phí" cho người chưa làm chủ hội nào (chủ dự án chốt ngày 23/11/2026): thành viên nào cũng
// có tài khoản Hội Mình, nên mỗi thành viên là một chủ hội tiềm năng. Đặt ở những lúc họ đang thấy giá trị của một hội:
// trang Tôi, khung Tài khoản, Khu học tập (sau khi mua khóa) và chân thanh bên của hội.
// Bấm vào thì tới trang giới thiệu /tao-hoi (đi tiếp bảng giá rồi tạo hội), không nhảy thẳng vào màn tạo hội.
import { T } from '@hoiminh/ui';
import { Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ownsCommunity } from '@/lib/addons';
import { useAuth } from '@/lib/auth';

const DISMISS_KEY = 'hm.createHoiInvite.dismissed';

function readDismissed(): boolean {
  try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
}

/** Người đang đăng nhập và chưa làm chủ hội nào. */
export function useShowsCreateInvite(): boolean {
  const { user, communities } = useAuth();
  return Boolean(user) && !ownsCommunity(communities);
}

/**
 * Thẻ lời mời. `dismissible`: có nút đóng (nhớ trên máy này), dùng ở chỗ người dùng ghé thường xuyên như Khu học tập.
 * Trang Tôi thì không có nút đóng vì đó là danh mục, người dùng tự tìm tới.
 */
export function CreateHoiInvite({ dismissible = false }: { dismissible?: boolean }) {
  const shows = useShowsCreateInvite();
  const [dismissed, setDismissed] = useState(() => dismissible && readDismissed());
  if (!shows || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* chế độ riêng tư: chỉ ẩn trong phiên này */ }
  };
  return (
    <section className="card relative flex flex-col gap-3 p-5" style={{ borderColor: T.gold }} aria-labelledby="create-hoi-invite" data-testid="create-hoi-invite">
      {dismissible && (
        <button type="button" onClick={dismiss} aria-label="Ẩn lời mời tạo hội" className="absolute top-2 right-2 w-11 h-11 rounded-[10px] inline-flex items-center justify-center" style={{ color: T.ink3 }}><X size={20} /></button>
      )}
      <div className="flex items-start gap-3 pr-8">
        <span className="inline-flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 44, height: 44, background: T.goldSoft, color: T.goldText }}><Sparkles size={22} aria-hidden="true" /></span>
        <div className="flex flex-col gap-1 min-w-0">
          <h2 id="create-hoi-invite" className="m-0 text-[19px] font-extrabold" style={{ color: T.ink }}>Tạo hội của bạn, miễn phí</h2>
          <p className="m-0 text-[16px] leading-[1.55]" style={{ color: T.ink2 }}>Bạn có kiến thức hay kinh nghiệm muốn chia sẻ? Mở một hội như hội bạn đang tham gia: bán khóa học, sự kiện, tiền về thẳng tài khoản của bạn. Không cần thẻ, không phí trên doanh thu.</p>
        </div>
      </div>
      <Link to="/tao-hoi" className="btn btn-primary self-start" style={{ minHeight: 48, fontSize: 16 }}>Tạo hội của bạn</Link>
    </section>
  );
}
