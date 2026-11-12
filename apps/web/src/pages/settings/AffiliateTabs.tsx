// Chip chuyển giữa ba chỗ của affiliate: Yêu cầu rút (trang Affiliate), Xếp hạng, Mức hoa hồng (Cài đặt).
import { Link } from 'react-router-dom';

export function AffiliateTabs({ slug, active, awaiting, affiliates }: { slug: string; active: 'config' | 'payouts'; awaiting?: number; affiliates?: number }) {
  return (
    <div className="chip-row">
      <Link to={`/${slug}/cong-su`} className={`chip${active === 'payouts' ? ' on' : ''}`}>Yêu cầu rút{awaiting ? ` · ${awaiting}` : ''}</Link>
      <Link to={`/${slug}/xep-hang`} className="chip">Xếp hạng{affiliates ? ` · ${affiliates}` : ''}</Link>
      <Link to={`/${slug}/cai-dat/cong-su`} className={`chip${active === 'config' ? ' on' : ''}`}>Mức hoa hồng</Link>
    </div>
  );
}
