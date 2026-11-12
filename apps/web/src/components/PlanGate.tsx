// Khóa theo gói của hội (kế hoạch 11/11/2026). Tính năng trả phí vẫn hiện cho chủ hội gói thấp biết là có, nhưng
// bấm vào thì thấy lời mời nâng gói thay vì mở tính năng. Máy chủ vẫn là nơi chặn thật (lỗi plan_locked, member_cap);
// phần này chỉ để người dùng không phải đụng vào lỗi mới biết.
import { useQuery } from '@tanstack/react-query';
import { PLAN_FEATURE_LABEL, lowestPlanWith, type PlanDef, type PlanFeature } from '@hoiminh/contracts';
import { T, money } from '@hoiminh/ui';
import { Lock, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, api } from '@/lib/api';
import { useShell, type Shell } from '@/lib/community';
import { capLabel, featureInline } from '@/lib/platform-plan';

const PLANS_QUERY = { queryKey: ['plans'], queryFn: () => api.get<PlanDef[]>('/v1/plans'), staleTime: 300_000 } as const;

/** Tính năng trả phí giúp được gì, nói bằng lời của chủ hội. */
export const FEATURE_PITCH: Record<PlanFeature, { short: string; long: string }> = {
  automation: { short: 'Thẻ và quy tắc KHI... THÌ...', long: 'Tự cho khách vào hội, mở khóa học, gửi email khi có đơn từ landing bắn về. Bạn không phải làm tay từng người.' },
  custom_domain: { short: 'Hội chạy trên tên miền của bạn', long: 'Thành viên vào hội bằng địa chỉ của riêng bạn thay vì địa chỉ của Hội Mình.' },
  affiliate: { short: 'Người khác giới thiệu và nhận hoa hồng', long: 'Mỗi cộng sự có link riêng, Hội Mình ghi nhận đơn và tính hoa hồng theo mức bạn đặt.' },
  api: { short: 'Nối hội với hệ thống khác', long: 'Đọc và ghi dữ liệu của hội từ công cụ bên ngoài bằng khóa API, nhận sự kiện qua webhook.' },
};

/** Hội đang mở có tính năng này không. Người không quản lý hội (không có dữ liệu gói) thì coi như có, máy chủ tự chặn. */
export function hasPlanFeature(shell: Shell, feature: PlanFeature): boolean {
  return shell.plan ? shell.plan.features.includes(feature) : true;
}

const planUrl = (slug: string, planKey?: string | null) => `/admin/goi?hoi=${slug}${planKey ? `&goi=${planKey}` : ''}`;

/** Thẻ mời nâng gói dùng chung: tiêu đề, lời giải thích, một nút chính. */
function UpgradeCard({ icon, title, children, action, secondary }: { icon: ReactNode; title: string; children: ReactNode; action: ReactNode; secondary?: ReactNode }) {
  return (
    <div className="card flex flex-col gap-3 p-5 md:p-6" style={{ borderColor: T.gold }} role="region" aria-label={title}>
      <div className="flex items-center gap-2.5">
        <span className="w-9 h-9 rounded-full inline-flex items-center justify-center flex-shrink-0" style={{ background: T.goldSoft, color: T.goldText }}>{icon}</span>
        <span className="font-bold text-[17px]">{title}</span>
      </div>
      <div className="flex flex-col gap-2 text-[15px]" style={{ color: T.ink2 }}>{children}</div>
      <div className="flex gap-2 flex-wrap justify-end pt-1">{secondary}{action}</div>
    </div>
  );
}

/** Trang của một tính năng trả phí khi gói của hội chưa có: lời mời nâng gói thay cho nội dung trang. */
export function FeatureLock({ feature }: { feature: PlanFeature }) {
  const shell = useShell();
  const plans = useQuery(PLANS_QUERY);
  const from = plans.data ? lowestPlanWith(plans.data, feature) : null;
  const plan = plans.data?.find((p) => p.key === from?.key);
  const name = from?.name ?? 'Chuyên nghiệp';
  const label = PLAN_FEATURE_LABEL[feature];
  const isOwner = shell.viewer.role === 'owner';
  return (
    <>
      <div>
        <h1 className="serif m-0 text-[28px] font-extrabold">{label}</h1>
        <div className="muted">{shell.community.name}, gói {shell.plan?.name ?? 'Miễn phí'}.</div>
      </div>
      <UpgradeCard
        icon={<Lock size={18} />}
        title={`${label} có từ gói ${name}`}
        action={isOwner ? <Link to={planUrl(shell.community.slug, from?.key)} className="btn btn-primary">Nâng lên {name}</Link> : <span className="text-[14px]" style={{ color: T.ink3 }}>Chỉ chủ hội nâng gói được.</span>}
        secondary={isOwner ? <Link to={planUrl(shell.community.slug)} className="btn btn-ghost">Xem các gói</Link> : undefined}
      >
        <span>{FEATURE_PITCH[feature].long}</span>
        {plan && <span>Gói {plan.name}: {money(plan.monthlyMinor)} mỗi tháng, {capLabel(plan.memberCap).toLocaleLowerCase('vi')}, mở cả {plan.features.map(featureInline).join(', ')}.</span>}
        <span className="text-[14px]" style={{ color: T.ink3 }}>Dữ liệu đã có của tính năng này vẫn được giữ nguyên.</span>
      </UpgradeCard>
    </>
  );
}

/** Bọc một trang cài đặt thuộc tính năng trả phí: gói có thì hiện trang, chưa có thì hiện lời mời nâng gói. */
export function FeatureGate({ feature, children }: { feature: PlanFeature; children: ReactNode }) {
  const shell = useShell();
  return hasPlanFeature(shell, feature) ? <>{children}</> : <FeatureLock feature={feature} />;
}

/** Nhãn nhỏ "Chuyên nghiệp" kèm ổ khóa, gắn cạnh tên tính năng bị khóa. */
export function LockTag({ feature }: { feature: PlanFeature }) {
  const plans = useQuery(PLANS_QUERY);
  const name = (plans.data ? lowestPlanWith(plans.data, feature)?.name : null) ?? 'Chuyên nghiệp';
  return <span className="tag inline-flex items-center gap-1" style={{ background: T.goldSoft, color: T.goldText }}><Lock size={12} />{name}</span>;
}

export interface MemberCapDetails { planKey?: string; planName?: string; cap?: number | null; members?: number; nextPlanKey?: string | null; nextPlanName?: string | null }

/** Lỗi chạm trần thành viên từ API (bấm Duyệt khi hội đã đủ), kèm số liệu để dựng màn nâng gói. */
export function memberCapOf(err: unknown): MemberCapDetails | null {
  return err instanceof ApiError && err.code === 'member_cap' ? ((err.details ?? {}) as MemberCapDetails) : null;
}

/** Màn nâng gói hiện ra khi chủ hội bấm Duyệt lúc hội đã chạm trần. */
export function MemberCapCard({ details, who, onClose }: { details: MemberCapDetails; who?: string; onClose?: () => void }) {
  const shell = useShell();
  const plans = useQuery(PLANS_QUERY);
  const current = plans.data?.find((p) => p.key === details.planKey);
  const higher = (plans.data ?? []).filter((p) => p.key !== 'free' && (p.memberCap === null || p.memberCap > (details.members ?? 0)) && (!current || plans.data!.indexOf(p) > plans.data!.indexOf(current))).slice(0, 2);
  const isOwner = shell.viewer.role === 'owner';
  const cap = (details.cap ?? 0).toLocaleString('vi-VN');
  return (
    <UpgradeCard
      icon={<Users size={18} />}
      title={who ? `Nâng gói để duyệt ${who}` : 'Nâng gói để nhận thêm thành viên'}
      action={isOwner ? <Link to={planUrl(shell.community.slug, details.nextPlanKey)} className="btn btn-primary">{details.nextPlanName ? `Nâng lên ${details.nextPlanName}` : 'Xem các gói'}</Link> : <span className="text-[14px]" style={{ color: T.ink3 }}>Chỉ chủ hội nâng gói được.</span>}
      secondary={onClose ? <button type="button" className="btn btn-ghost" onClick={onClose}>Để sau</button> : undefined}
    >
      <span>Gói {details.planName ?? 'đang dùng'} tối đa {cap} thành viên và hội đã đủ. Nâng gói xong, bạn quay lại duyệt {who ?? 'người này'} và những người đang chờ. Không ai bị xóa.</span>
      {higher.map((p) => (
        <div key={p.key} className="flex flex-col rounded-[12px] px-4 py-2.5" style={{ background: T.bg }}>
          <span className="font-bold" style={{ color: T.ink }}>{p.name}</span>
          <span className="text-[14px]">{capLabel(p.memberCap)} · {money(p.monthlyMinor)} mỗi tháng</span>
        </div>
      ))}
    </UpgradeCard>
  );
}

/** Dải báo ở đầu trang Thành viên khi hội đã chạm trần của gói. */
export function MemberCapBanner() {
  const shell = useShell();
  const p = shell.plan;
  if (!p || !p.full || p.needsPlan || p.memberCap === null) return null;
  const cap = p.memberCap.toLocaleString('vi-VN');
  return (
    <div className="card flex flex-col gap-2.5 p-4 md:p-5" style={{ background: T.goldSoft, borderColor: 'transparent' }} role="status">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="font-bold text-[16px]" style={{ color: T.goldText }}>Hội đã đủ {shell.community.memberCount.toLocaleString('vi-VN')} trên {cap} thành viên</span>
        <span className="flex-grow" />
        {shell.viewer.role === 'owner' && <Link to={planUrl(shell.community.slug)} className="btn btn-primary btn-sm">Nâng gói</Link>}
      </div>
      <span className="text-[14px]" style={{ color: T.goldText }}>Người mới vẫn xin vào được và nằm ở hàng chờ duyệt. Không ai bị xóa, dữ liệu của hội giữ nguyên.</span>
    </div>
  );
}
