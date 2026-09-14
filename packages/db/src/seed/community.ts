// Workspace, hội, tier, chuyên mục, plugin, thành viên, câu hỏi khi tham gia.
import type { Database } from '../client';
import {
  communities, communityJoinQuestions, communityMembers, communityPlugins, communityTiers, memberJoinAnswers, spaces,
  userCommunityPrefs, workspaceMembers, workspaces,
} from '../schema';
import { daysFrom, sid } from './ids';
import type { SeedUser } from './users';

export interface SeedCommunity {
  id: string;
  workspaceId: string;
  slug: string;
  name: string;
  tiers: Record<'standard' | 'premium' | 'vip', string>;
  spaces: Record<string, string>;
}

/** Hội chính "Kinh Doanh Online Cùng AI" của Minh Quý + các hội phụ cho Khám phá và Quản trị hệ thống. */
export async function seedCommunities(db: Database, base: Date, U: Record<string, SeedUser>): Promise<{ main: SeedCommunity; others: SeedCommunity[] }> {
  const main = await createCommunity(db, base, {
    key: 'kd', owner: U.minhquy!, workspaceKey: 'minhquy', name: 'Kinh Doanh Online Cùng AI', slug: 'minhquy',
    mark: 'KD', color: '#D4593A', coverColor: '#0E8E96', tagline: 'Doanh nghiệp\nmột người',
    short: 'Ứng dụng AI xây dựng doanh nghiệp một người.',
    description: 'Hội dành cho người muốn xây doanh nghiệp một người bằng AI: có lộ trình học rõ ràng, có người trả lời câu hỏi trong 24 giờ, và có cộng sự để cùng bán. Vào miễn phí, học 5 bài đầu, thấy hợp thì nâng cấp.',
    category: 'kinh-doanh', pricingMode: 'freemium', monthly: 249_000, yearly: 2_490_000, memberCount: 234, paidCount: 75,
    rules: ['Tôn trọng nhau, không công kích cá nhân', 'Không quảng cáo dịch vụ ngoài khi chưa được phép', 'Đặt câu hỏi đúng chuyên mục, có ngữ cảnh rõ ràng'],
    links: [
      { label: 'Fanpage MMO for Freedom', url: 'https://facebook.com/mmoforfreedom' },
      { label: 'Kênh YouTube', url: 'https://youtube.com/@minhquy' },
      { label: 'Zalo hỗ trợ', url: 'https://zalo.me/minhquy' },
    ],
    customDomain: 'hoc.minhquy.vn', workspaceStatus: 'active',
  });
  // Hội thứ hai và bản nháp của Minh Quý (màn "Hội của tôi").
  const congsu = await createCommunity(db, base, {
    key: 'congsu', owner: U.minhquy!, workspaceKey: 'minhquy', name: 'Cộng sự MMO', slug: 'cong-su-mmo', mark: 'AF', color: '#0E8E96',
    coverColor: '#25201B', tagline: 'Cộng sự', short: 'Nhóm kín cho cộng sự bán khóa học AI.', description: 'Nhóm kín cho cộng sự.',
    category: 'kinh-doanh', pricingMode: 'subscription', monthly: 199_000, yearly: 1_990_000, memberCount: 58, paidCount: 58, discoverable: false,
  });
  const draft = await createCommunity(db, base, {
    key: 'aiagent', owner: U.minhquy!, workspaceKey: 'minhquy', name: 'AI Agent cho chủ shop', slug: 'ai-agent-shop', mark: 'AI', color: '#7A5C3E',
    coverColor: '#3E5C7A', tagline: 'AI Agent', short: 'Chủ shop nhỏ muốn dựng trợ lý AI trả lời khách, chốt đơn và chăm sóc sau bán mà không cần thuê thêm người.',
    description: 'Đang soạn.', category: 'cong-nghe-ai', pricingMode: 'freemium', status: 'draft', memberCount: 0, paidCount: 0, discoverable: false,
  });
  const yt = await createCommunity(db, base, {
    key: 'yt', owner: U.huan!, workspaceKey: 'huan', name: 'Faceless YouTube Foundation', slug: 'faceless-yt', mark: 'YT', color: '#0E8E96', coverColor: '#D4593A',
    tagline: 'Faceless\nYouTube', short: 'Xây kênh không lộ mặt từ ý tưởng đến kiếm tiền.', description: 'Xây kênh YouTube không lộ mặt.',
    category: 'sang-tao-noi-dung', pricingMode: 'subscription', monthly: 199_000, yearly: 1_990_000, memberCount: 1204, paidCount: 1204, workspaceStatus: 'active',
  });
  const qt = await createCommunity(db, base, {
    key: 'qt', owner: U.thanhlong!, workspaceKey: 'thanhlong', name: 'Quản trị cảm xúc', slug: 'quan-tri-cam-xuc', mark: 'QT', color: '#7A5C3E', coverColor: '#7A5C3E',
    tagline: 'Quản trị\ncảm xúc', short: 'Làm chủ cảm xúc để làm chủ cuộc đời, 23 bài theo lộ trình.', description: 'Làm chủ cảm xúc.',
    category: 'phat-trien-ban-than', pricingMode: 'one_time', oneTime: 990_000, memberCount: 176, paidCount: 176, workspaceStatus: 'active',
  });
  const yoga = await createCommunity(db, base, {
    key: 'yoga', owner: U.lehanh!, workspaceKey: 'lehanh', name: 'Yoga sáng 6 giờ', slug: 'yoga-6h', mark: 'YG', color: '#5C7A3E', coverColor: '#5C7A3E',
    tagline: 'Yoga sáng', short: 'Tập cùng nhau mỗi sáng 6 giờ, 21 ngày đổi thói quen.', description: 'Yoga buổi sáng.',
    category: 'suc-khoe', pricingMode: 'subscription', monthly: 99_000, yearly: 990_000, memberCount: 128, paidCount: 128, workspaceStatus: 'active',
  });
  const vy = await createCommunity(db, base, {
    key: 'vy', owner: U.thaovy!, workspaceKey: 'thaovy', name: 'Ngoại ngữ cùng Vy', slug: 'ngoai-ngu-vy', mark: 'NV', color: '#3E5C7A', coverColor: '#3E5C7A',
    tagline: 'Tiếng Anh\nmỗi ngày', short: 'Học tiếng Anh giao tiếp 15 phút mỗi ngày.', description: 'Tiếng Anh mỗi ngày.',
    category: 'ngoai-ngu', pricingMode: 'freemium', monthly: 149_000, yearly: 1_490_000, memberCount: 41, paidCount: 0, workspaceStatus: 'trial', trialDaysLeft: 3,
  });
  const shopee = await createCommunity(db, base, {
    key: 'shopee', owner: U.phamduc!, workspaceKey: 'phamduc', name: 'Shopee 0 đồng', slug: 'shopee-0d', mark: 'SH', color: '#5C3E7A', coverColor: '#5C3E7A',
    tagline: 'Shopee', short: 'Bán hàng Shopee không vốn.', description: 'Bán hàng Shopee.', category: 'kinh-doanh', pricingMode: 'free',
    memberCount: 12, paidCount: 0, workspaceStatus: 'trial', trialDaysLeft: 9, lockedReason: 'Bị báo cáo nội dung · đang xem xét',
  });
  const crypto = await createCommunity(db, base, {
    key: 'crypto', owner: U.phamduc!, workspaceKey: 'phamduc', name: 'Crypto x100', slug: 'crypto-x100', mark: 'CR', color: '#8C8478', coverColor: '#25201B',
    tagline: 'x100', short: 'Kèo x100.', description: 'Đã khóa.', category: 'kinh-doanh', pricingMode: 'free', memberCount: 380, paidCount: 0,
    status: 'locked', lockedReason: 'Vi phạm điều khoản: quảng cáo đầu tư rủi ro', discoverable: false,
  });
  await seedMainMembers(db, base, U, main);
  return { main, others: [congsu, draft, yt, qt, yoga, vy, shopee, crypto] };
}

interface CommunitySpec {
  key: string; owner: SeedUser; workspaceKey: string; name: string; slug: string; mark: string; color: string; coverColor: string; tagline: string;
  short: string; description: string; category: string; pricingMode: 'free' | 'freemium' | 'subscription' | 'one_time';
  monthly?: number; yearly?: number; oneTime?: number; memberCount: number; paidCount: number; status?: 'draft' | 'active' | 'locked';
  discoverable?: boolean; rules?: string[]; links?: Array<{ label: string; url: string }>; customDomain?: string;
  workspaceStatus?: 'trial' | 'active'; trialDaysLeft?: number; lockedReason?: string;
}

async function createCommunity(db: Database, base: Date, s: CommunitySpec): Promise<SeedCommunity> {
  const workspaceId = await sid(`workspace:${s.workspaceKey}`);
  const communityId = await sid(`community:${s.key}`);
  const isTrial = s.workspaceStatus === 'trial';
  await db
    .insert(workspaces)
    .values({
      id: workspaceId, ownerUserId: s.owner.id, name: `Workspace của ${s.owner.name}`, slug: s.workspaceKey,
      status: isTrial ? 'trial' : 'active', trialEndsAt: isTrial ? daysFrom(base, s.trialDaysLeft ?? 14) : daysFrom(base, -300),
      createdAt: daysFrom(base, -s.owner.joinedDaysAgo),
    })
    .onConflictDoNothing();
  await db.insert(workspaceMembers).values({ workspaceId, userId: s.owner.id, role: 'owner' }).onConflictDoNothing();
  await db
    .insert(communities)
    .values({
      id: communityId, workspaceId, name: s.name, slug: s.slug, shortDescription: s.short, description: s.description, category: s.category,
      logoMark: s.mark, logoColor: s.color, coverColor: s.coverColor, coverTagline: s.tagline, rules: s.rules ?? [], links: s.links ?? [],
      status: s.status ?? 'active', pricingMode: s.pricingMode, discoverable: s.discoverable ?? true, customDomain: s.customDomain ?? null,
      customDomainVerifiedAt: s.customDomain ? daysFrom(base, -10) : null, memberCount: s.memberCount, paidMemberCount: s.paidCount,
      lockedReason: s.lockedReason ?? null, createdAt: daysFrom(base, -Math.min(s.owner.joinedDaysAgo, 300)),
    })
    .onConflictDoNothing();

  const tiers = { standard: await sid(`tier:${s.key}:standard`), premium: await sid(`tier:${s.key}:premium`), vip: await sid(`tier:${s.key}:vip`) };
  const hasFree = s.pricingMode === 'free' || s.pricingMode === 'freemium';
  await db
    .insert(communityTiers)
    .values([
      { id: tiers.standard, communityId, key: 'standard', name: 'Tiêu chuẩn', description: 'Mặc định khi tham gia', benefits: ['Đọc và đăng bài trên Bảng tin', 'Module 1 của mọi khóa học'], isDefault: hasFree, isActive: hasFree, sortOrder: 0 },
      { id: tiers.premium, communityId, key: 'premium', name: 'Premium', description: 'Mở khóa toàn bộ', benefits: ['Mở khóa toàn bộ khóa học', 'Trở thành cộng sự, hoa hồng 50%', 'Q&A hàng tuần'], isDefault: !hasFree, isActive: s.pricingMode !== 'free', sortOrder: 1, monthlyMinor: s.monthly ?? null, yearlyMinor: s.yearly ?? null, oneTimeMinor: s.oneTime ?? null },
      { id: tiers.vip, communityId, key: 'vip', name: 'VIP', description: 'Coaching 1-1', benefits: ['Coaching 1-1 hàng tuần', 'Coaching nhóm hàng tuần'], isDefault: false, isActive: s.key === 'kd', sortOrder: 2, monthlyMinor: s.key === 'kd' ? 2_500_000 : null },
    ])
    .onConflictDoNothing();

  const spaceDefs: Array<[string, string, 'everyone' | 'admins_only' | 'premium', string, number]> = [
    ['Thông báo', 'thong-bao', 'admins_only', 'accent', 24], ['Hỏi đáp', 'hoi-dap', 'everyone', 'teal', 131], ['Chia sẻ', 'chia-se', 'everyone', 'accent', 87],
    ['Nhật ký', 'nhat-ky', 'everyone', 'gold', 56], ['Câu chuyện', 'cau-chuyen', 'premium', 'gold', 12],
  ];
  const spaceIds: Record<string, string> = {};
  for (const [i, [name, slug, perm, color, count]] of spaceDefs.entries()) {
    const id = await sid(`space:${s.key}:${slug}`);
    spaceIds[slug] = id;
    await db.insert(spaces).values({ id, communityId, name, slug, postPermission: perm, colorKey: color, sortOrder: i, postCount: s.key === 'kd' ? count : 0 }).onConflictDoNothing();
  }

  const plugins: Array<[string, boolean, Record<string, unknown>]> = [
    ['welcome_dm', true, { senderUserId: s.owner.id, template: 'Chào {{tên}}, chào mừng bạn đến với {{cộng đồng}}. Bạn bắt đầu ở mục “Bắt đầu tại đây” nhé, có gì cứ nhắn mình ở đây.', delayMinutes: 2, includeStartLink: true }],
    ['instant_approval', true, {}], ['links', true, {}], ['webhook', false, {}], ['meta_pixel', s.key === 'kd', { pixelId: s.key === 'kd' ? '1234567890' : '' }],
  ];
  for (const [pluginKey, enabled, config] of plugins) {
    await db.insert(communityPlugins).values({ id: await sid(`plugin:${s.key}:${pluginKey}`), communityId, pluginKey, enabled, config }).onConflictDoNothing();
  }

  // Chủ hội là thành viên owner của hội mình.
  await db
    .insert(communityMembers)
    .values({ id: await sid(`member:${s.key}:${s.owner.key}`), communityId, userId: s.owner.id, role: 'owner', status: 'active', tierId: tiers.premium, level: 7, joinedAt: daysFrom(base, -Math.min(s.owner.joinedDaysAgo, 300)), lastActiveAt: daysFrom(base, 0, 9) })
    .onConflictDoNothing();
  return { id: communityId, workspaceId, slug: s.slug, name: s.name, tiers, spaces: spaceIds };
}

/** Thành viên của hội chính: vai trò, gói, trạng thái, giới thiệu, LTV khớp demo. */
async function seedMainMembers(db: Database, base: Date, U: Record<string, SeedUser>, c: SeedCommunity): Promise<void> {
  const hv = await sid('affiliate:kd:hoangvu');
  const rows: Array<{ key: string; role?: 'admin' | 'moderator' | 'member'; tier: 'standard' | 'premium' | 'vip'; status?: 'active' | 'cancelling' | 'churned' | 'banned' | 'pending'; ltv?: number; ref?: string; level?: number; source?: 'invite' | 'affiliate' | 'discovery' | 'direct'; lastActiveHoursAgo?: number }> = [
    { key: 'hoangvu', role: 'admin', tier: 'premium', ltv: 2_490_000, level: 5, lastActiveHoursAgo: 1 },
    { key: 'hongkim', role: 'moderator', tier: 'premium', ltv: 2_490_000, level: 3, ref: hv, source: 'affiliate', lastActiveHoursAgo: 24 },
    { key: 'kienbui', tier: 'standard', ltv: 1_000_000, level: 1, lastActiveHoursAgo: 96 },
    { key: 'dien', tier: 'premium', ltv: 249_000, ref: hv, source: 'affiliate', level: 2, lastActiveHoursAgo: 3 },
    { key: 'duy', tier: 'standard', ltv: 249_000, level: 1, lastActiveHoursAgo: 15 },
    { key: 'cong', tier: 'standard', ltv: 0, level: 1, lastActiveHoursAgo: 14 },
    { key: 'thulan', tier: 'premium', ltv: 5_000_000, level: 2, status: 'cancelling', lastActiveHoursAgo: 40 },
  ];
  for (const r of rows) {
    const u = U[r.key]!;
    await db
      .insert(communityMembers)
      .values({
        id: await sid(`member:kd:${r.key}`), communityId: c.id, userId: u.id, role: r.role ?? 'member', status: r.status ?? 'active', tierId: c.tiers[r.tier],
        referredByAffiliateId: r.ref ?? null, source: r.source ?? 'direct', lifetimeValueCents: r.ltv ?? 0, level: r.level ?? 1,
        lastPaymentAt: r.ltv ? daysFrom(base, -1, 9, 3) : null, nextRenewalAt: r.tier === 'premium' ? daysFrom(base, 29) : null,
        joinedAt: daysFrom(base, -u.joinedDaysAgo, 10), lastActiveAt: new Date(base.getTime() + 9 * 3_600_000 - (r.lastActiveHoursAgo ?? 24) * 3_600_000),
      })
      .onConflictDoNothing();
    await db.insert(userCommunityPrefs).values({ id: await sid(`pref:kd:${r.key}`), userId: u.id, communityId: c.id, pinned: true }).onConflictDoNothing();
  }
  // 25 thành viên bổ sung: phần lớn Tiêu chuẩn, vài người Premium, vài người đã rời/bị chặn.
  for (let i = 1; i <= 25; i++) {
    const u = U[`member${i}`]!;
    const premium = i % 5 === 0;
    const status = i === 24 ? 'churned' : i === 25 ? 'banned' : i === 23 ? 'churned' : 'active';
    await db
      .insert(communityMembers)
      .values({
        id: await sid(`member:kd:member${i}`), communityId: c.id, userId: u.id, role: 'member', status, tierId: premium ? c.tiers.premium : c.tiers.standard,
        lifetimeValueCents: premium ? 249_000 : 0, source: i % 3 === 0 ? 'discovery' : 'direct', level: 1,
        joinedAt: daysFrom(base, -u.joinedDaysAgo, 11), lastActiveAt: daysFrom(base, -(i % 9), 8), nextRenewalAt: premium ? daysFrom(base, 12 + i) : null,
        bannedAt: status === 'banned' ? daysFrom(base, -2) : null, churnedAt: status === 'churned' ? daysFrom(base, -7) : null,
      })
      .onConflictDoNothing();
  }
  const q1 = await sid('joinq:kd:1');
  const q2 = await sid('joinq:kd:2');
  await db
    .insert(communityJoinQuestions)
    .values([
      { id: q1, communityId: c.id, question: 'Bạn đang bán gì hoặc định bán gì?', required: true, sortOrder: 0 },
      { id: q2, communityId: c.id, question: 'Bạn biết đến hội qua đâu?', required: false, sortOrder: 1 },
    ])
    .onConflictDoNothing();
  await db
    .insert(memberJoinAnswers)
    .values([
      { id: await sid('joina:kd:dien:1'), memberId: await sid('member:kd:dien'), questionId: q1, answer: 'Shop phụ kiện điện thoại trên Shopee và Facebook.' },
      { id: await sid('joina:kd:dien:2'), memberId: await sid('member:kd:dien'), questionId: q2, answer: 'Anh Hoàng Vũ giới thiệu.' },
    ])
    .onConflictDoNothing();
}
