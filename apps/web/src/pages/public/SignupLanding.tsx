// Tạo hội của bạn (signupBody trong build.mjs): nền tối, tiêu đề, băng chuyền 3 thẻ hội, chấm trang, nút TẠO HỘI CỦA BẠN.
import { CommunityMark, T } from '@hoiminh/ui';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fmtCount } from '@/lib/format';
import { COVER_RATIO, useDiscover, type DiscoverCommunity } from './Discovery';
import { SignupPage, withRef } from './SignupParts';

/**
 * Thẻ hội trong băng chuyền. Hội có ảnh bìa: ảnh hiện trọn 16:9, tên hội nằm ở dải riêng bên dưới
 * (ảnh bìa thường đã có chữ, đè tên lên thì cả hai đều không đọc được). Chưa có ảnh: nền màu, tên đè lên.
 */
function Showcase({ c, side }: { c: DiscoverCommunity; side: boolean }) {
  if (c.coverUrl) {
    if (side) return <img src={c.coverUrl} alt="" className="block flex-shrink-0 rounded-[20px]" style={{ width: 260, maxWidth: '28vw', aspectRatio: COVER_RATIO, objectFit: 'cover', background: c.coverColor, opacity: 0.45, filter: 'blur(0.5px)' }} />;
    return (
      <div className="overflow-hidden flex-shrink-0 rounded-[20px]" style={{ width: 560, maxWidth: '92vw', background: 'rgba(255,255,255,0.08)', boxShadow: '0 30px 60px rgba(0,0,0,0.45)' }}>
        <img src={c.coverUrl} alt={`Ảnh bìa ${c.name}`} className="block w-full" style={{ aspectRatio: COVER_RATIO, objectFit: 'cover', background: c.coverColor }} />
        <div className="flex items-center gap-3 text-left" style={{ padding: '14px 18px', color: T.invertInk }}>
          <CommunityMark mark={c.logoMark} color={T.side} url={c.logoUrl} size={48} radius={13} />
          <div className="min-w-0 flex-1">
            <div className="font-bold text-[17px] leading-[1.25] truncate">{c.name}</div>
            <div className="text-[14px] truncate" style={{ color: T.sideText }}>{fmtCount(c.memberCount)} thành viên{c.shortDescription ? ` · ${c.shortDescription}` : ''}</div>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden flex-shrink-0 rounded-[20px] transition-all" style={{ width: side ? 260 : 560, maxWidth: side ? '28vw' : '92vw', height: side ? 240 : 320, background: c.coverColor, opacity: side ? 0.45 : 1, filter: side ? 'blur(0.5px)' : undefined, boxShadow: side ? undefined : '0 30px 60px rgba(0,0,0,0.45)' }}>
      <div className="absolute left-6 bottom-6 text-left" style={{ color: T.invertInk }}>
        <div className="serif font-extrabold leading-[1.1]" style={{ fontSize: side ? 20 : 34 }}>{side ? c.logoMark : c.name}</div>
        {!side && <div className="text-[14px] mt-1.5" style={{ opacity: 0.85 }}>{c.shortDescription}</div>}
      </div>
      {!side && (
        <div className="absolute rounded-[12px]" style={{ top: -18, right: -18, padding: '12px 16px', paddingTop: 30, paddingRight: 34, background: '#1E8A5A', color: T.invertInk, boxShadow: '0 10px 30px rgba(0,0,0,0.3)' }}>
          <div className="font-bold">{c.name}</div>
          <div className="text-[13px]">{fmtCount(c.memberCount)} thành viên</div>
        </div>
      )}
    </div>
  );
}

function Carousel({ items }: { items: DiscoverCommunity[] }) {
  const [i, setI] = useState(0);
  const n = items.length;
  const at = (k: number) => items[((k % n) + n) % n]!;
  const prev = () => setI((v) => (v - 1 + n) % n);
  const next = () => setI((v) => (v + 1) % n);
  return (
    <>
      <div className="flex items-center justify-center gap-6 pt-3 w-full overflow-hidden">
        {n > 1 && <div className="hidden md:block"><Showcase c={at(i - 1)} side /></div>}
        <Showcase c={at(i)} side={false} />
        {n > 2 && <div className="hidden md:block"><Showcase c={at(i + 1)} side /></div>}
      </div>
      {n > 1 && (
        <div className="flex items-center gap-[18px]" style={{ color: T.sideMuted }}>
          <button type="button" aria-label="Trước" onClick={prev} style={{ color: 'inherit' }}><ChevronLeft size={20} /></button>
          <span className="flex gap-2.5">
            {items.map((c, k) => <button key={c.id} type="button" aria-label={c.name} onClick={() => setI(k)} className="rounded-full" style={{ width: 10, height: 10, background: k === i ? T.gold : T.sideMuted }} />)}
          </span>
          <button type="button" aria-label="Sau" onClick={next} style={{ color: 'inherit' }}><ChevronRight size={20} /></button>
        </div>
      )}
    </>
  );
}

export default function Page() {
  const [params] = useSearchParams();
  const ref = params.get('ref');
  const list = useDiscover(null, '', 3);
  return (
    <SignupPage>
      <div className="flex-grow flex flex-col items-center gap-7 text-center px-4 md:px-16" style={{ paddingTop: 48, paddingBottom: 40 }}>
        <div className="flex flex-col gap-2.5">
          <h1 className="serif m-0 font-extrabold leading-[1.15] text-[32px] md:text-[44px]" style={{ maxWidth: 820 }}>Xây một hội quanh đam mê của bạn</h1>
          <div className="font-semibold text-[18px] md:text-[22px]" style={{ color: T.gold }}>Dạy học, bán khóa học và nhận tiền bằng chuyển khoản Việt Nam</div>
          <div className="text-[15px]" style={{ color: T.sideText }}>Bắt đầu miễn phí, không thu phí trên doanh thu ở mọi gói</div>
        </div>
        {list.data && list.data.length > 0 && <Carousel items={list.data} />}
        <Link to={withRef('/tao-hoi/goi', ref)} className="btn btn-primary w-full uppercase" style={{ maxWidth: 560, height: 56, fontSize: 16, letterSpacing: '0.04em', borderRadius: 12 }}>Tạo hội của bạn</Link>
        <div className="text-[13px]" style={{ color: T.sideMuted }}>Hội đầu tiên miễn phí, dùng vĩnh viễn · không cần thẻ</div>
      </div>
    </SignupPage>
  );
}
