// Chip chuyển giữa Cấu hình / Yêu cầu rút / Cộng sự (affiliateTabs trong build.mjs).
import { Link } from 'react-router-dom';

export function AffiliateTabs({ slug, active, awaiting, affiliates }: { slug: string; active: 'config' | 'payouts'; awaiting?: number; affiliates?: number }) {
  return (
    <div className="flex gap-2 flex-wrap">
      <Link to={`/${slug}/cai-dat/cong-su`} className={`chip${active === 'config' ? ' on' : ''}`}>Cấu hình</Link>
      <Link to={`/${slug}/cai-dat/cong-su/rut-tien`} className={`chip${active === 'payouts' ? ' on' : ''}`}>Yêu cầu rút{awaiting ? ` · ${awaiting}` : ''}</Link>
      <Link to={`/${slug}/xep-hang`} className="chip">Cộng sự{affiliates ? ` · ${affiliates}` : ''}</Link>
    </div>
  );
}
