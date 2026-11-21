// Hợp đồng hội (community), gói (tier), thành viên, cài đặt.
import { z } from 'zod';
import { amountMinorSchema, handleSchema, idSchema, slugSchema } from './common';
import { MAX_TIER_TERMS, pricingPromoSchema, tierTermSchema } from './membership';

export const pricingModeSchema = z.enum(['free', 'freemium', 'subscription', 'one_time']);
export type PricingMode = z.infer<typeof pricingModeSchema>;

export const communityCategorySchema = z.enum([
  'kinh-doanh', 'cong-nghe-ai', 'sang-tao-noi-dung', 'suc-khoe', 'phat-trien-ban-than', 'hoc-tap', 'ngoai-ngu',
]);
export const COMMUNITY_CATEGORY_LABELS: Record<z.infer<typeof communityCategorySchema>, string> = {
  'kinh-doanh': 'Kinh doanh',
  'cong-nghe-ai': 'Công nghệ và AI',
  'sang-tao-noi-dung': 'Sáng tạo nội dung',
  'suc-khoe': 'Sức khỏe',
  'phat-trien-ban-than': 'Phát triển bản thân',
  'hoc-tap': 'Học tập',
  'ngoai-ngu': 'Ngoại ngữ',
};

export const memberStatusSchema = z.enum(['active', 'cancelling', 'churned', 'banned', 'pending']);
export type MemberStatus = z.infer<typeof memberStatusSchema>;
export const memberRoleSchema = z.enum(['owner', 'admin', 'moderator', 'member']);
export type MemberRole = z.infer<typeof memberRoleSchema>;

export const createCommunitySchema = z.object({
  workspaceId: idSchema.optional(),
  name: z.string().trim().min(3).max(80),
  slug: slugSchema,
  shortDescription: z.string().trim().max(160).default(''),
  description: z.string().trim().max(2000).default(''),
  pricingMode: pricingModeSchema.default('freemium'),
  category: communityCategorySchema.default('kinh-doanh'),
  template: z.enum(['course', 'coaching', 'membership', 'blank']).default('course'),
  premiumMonthlyMinor: amountMinorSchema.optional(),
  premiumYearlyMinor: amountMinorSchema.optional(),
  oneTimeMinor: amountMinorSchema.optional(),
});
export type CreateCommunityInput = z.infer<typeof createCommunitySchema>;

/** Hội kín ('private'): chỉ thành viên xem được bên trong. Hội mở ('public'): ai cũng xem được, chỉ thành viên mới đăng bài, bình luận, học. */
export const communityVisibilitySchema = z.enum(['private', 'public']);
export type CommunityVisibility = z.infer<typeof communityVisibilitySchema>;

export const updateCommunityGeneralSchema = z.object({
  name: z.string().trim().min(3).max(80).optional(),
  slug: slugSchema.optional(),
  shortDescription: z.string().trim().max(160).optional(),
  description: z.string().trim().max(5000).optional(),
  category: communityCategorySchema.optional(),
  rules: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
  logoFileId: idSchema.nullable().optional(),
  coverFileId: idSchema.nullable().optional(),
  introVideoUrl: z.string().url().nullable().optional(),
  customDomain: z.string().max(253).nullable().optional(),
  discoverable: z.boolean().optional(),
  visibility: communityVisibilitySchema.optional(),
  links: z.array(z.object({ label: z.string().max(60), url: z.string().url() })).max(6).optional(),
});

/** Số ảnh và video tối đa trong bộ sưu tập trang giới thiệu hội. */
export const ABOUT_MEDIA_MAX = 12;
/** Bộ ảnh và video trang giới thiệu, gửi đủ cả danh sách theo đúng thứ tự muốn hiện. Ảnh trỏ tới tệp đã tải lên, video là link dán vào. */
export const updateAboutMediaSchema = z.object({
  items: z.array(z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('image'), fileId: idSchema }),
    z.object({ kind: z.literal('video'), url: z.string().trim().url().max(500) }),
  ])).max(ABOUT_MEDIA_MAX),
});
export type UpdateAboutMediaInput = z.infer<typeof updateAboutMediaSchema>;
export interface AboutMediaItem { id: string; kind: 'image' | 'video'; url: string; fileId: string | null }

export const tierInputSchema = z.object({
  id: idSchema.optional(),
  key: z.enum(['standard', 'premium', 'vip']),
  name: z.string().trim().min(1).max(40),
  description: z.string().trim().max(200).default(''),
  benefits: z.array(z.string().max(120)).max(12).default([]),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  monthlyMinor: amountMinorSchema.nullable().optional(),
  yearlyMinor: amountMinorSchema.nullable().optional(),
  oneTimeMinor: amountMinorSchema.nullable().optional(),
  /** Kỳ hạn bán (số tháng và giá). Có trường này thì nó là nguồn chính; giá tháng và giá năm ở trên tự suy theo. */
  terms: z.array(tierTermSchema).max(MAX_TIER_TERMS).optional(),
});
export const updatePricingSchema = z.object({
  pricingMode: pricingModeSchema,
  doorsOpen: z.boolean(),
  /** Khuyến mãi giá gói thành viên. null là tắt; không gửi thì giữ nguyên khuyến mãi đang có. */
  promo: pricingPromoSchema.nullable().optional(),
  tiers: z.array(tierInputSchema).min(1).max(3),
  enabledProviders: z.array(z.enum(['sepay', 'momo', 'vnpay', 'paypal'])).default(['sepay', 'momo', 'vnpay']),
  migrateExistingPaidToTierKey: z.enum(['standard', 'premium', 'vip']).optional(),
});
export type UpdatePricingInput = z.infer<typeof updatePricingSchema>;

export const joinCommunitySchema = z.object({
  answers: z.array(z.object({ questionId: idSchema, answer: z.string().max(500) })).max(3).default([]),
  /** Một mã giới thiệu hoặc danh sách mã cách nhau bằng dấu phẩy (xem refCodes). */
  ref: z.string().max(700).optional(),
});

export const memberFilterSchema = z.object({
  status: memberStatusSchema.default('active'),
  q: z.string().max(80).optional(),
  tierKey: z.string().optional(),
  role: memberRoleSchema.optional(),
  source: z.enum(['invite', 'affiliate', 'discovery', 'direct']).optional(),
  /** Lọc theo thẻ của liên hệ trùng email (thẻ đồng bộ từ landing hoặc gắn tay). */
  tag: z.string().max(60).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export const updateMemberSchema = z.object({
  role: z.enum(['admin', 'moderator', 'member']).optional(),
  tierKey: z.enum(['standard', 'premium', 'vip']).optional(),
});

export const pluginKeySchema = z.enum(['welcome_dm', 'instant_approval', 'links', 'webhook', 'meta_pixel']);
export type PluginKey = z.infer<typeof pluginKeySchema>;
/** Biến dùng được trong mẫu tin nhắn chào: tên tiếng Anh, viết liền bằng gạch dưới (giống biến của Quy tắc tự động). */
export const WELCOME_DM_VARIABLES = ['full_name', 'community_name', 'start_link'] as const;
export type WelcomeDmVariable = (typeof WELCOME_DM_VARIABLES)[number];
export const WELCOME_DM_TEMPLATE_MAX = 1000;
export const WELCOME_DM_DEFAULT_TEMPLATE = 'Chào {{full_name}}, chào mừng bạn đến với {{community_name}}. Bạn bắt đầu ở mục “Bắt đầu tại đây” nhé, có gì cứ nhắn mình ở đây.';
/** {{first_name}} (chỉ tên gọi) không còn trong gợi ý nhưng mẫu nào đang dùng thì vẫn chạy. */
const WELCOME_DM_HIDDEN_VARIABLES = ['first_name'];
/** Tên biến tiếng Việt dùng trước khi đổi sang tiếng Anh. Mẫu đã lưu bằng tên cũ vẫn chạy và được đổi sang tên mới khi đọc, khi lưu. */
const WELCOME_DM_LEGACY_VARIABLES: Record<string, WelcomeDmVariable> = { 'tên': 'full_name', 'cộng đồng': 'community_name', 'link bắt đầu': 'start_link' };
/** Đổi biến tên cũ ({{tên}}, {{cộng đồng}}, {{link bắt đầu}}) sang tên mới và viết gọn biến tên mới ({{ Full_Name }} → {{full_name}}). Biến lạ giữ nguyên. */
export function normalizeWelcomeTemplate(template: string): string {
  return template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (whole, inner: string) => {
    const key = inner.normalize('NFC').toLowerCase().replace(/\s+/g, ' ');
    const name = WELCOME_DM_LEGACY_VARIABLES[key] ?? [...WELCOME_DM_VARIABLES, ...WELCOME_DM_HIDDEN_VARIABLES].find((v) => v === key);
    return name ? `{{${name}}}` : whole;
  });
}
export const welcomeDmConfigSchema = z.object({
  senderUserId: idSchema.optional(),
  template: z.string().max(WELCOME_DM_TEMPLATE_MAX).default(WELCOME_DM_DEFAULT_TEMPLATE),
  delayMinutes: z.number().int().min(0).max(1440).default(2),
  includeStartLink: z.boolean().default(true),
});
export const updatePluginSchema = z.object({
  enabled: z.boolean(),
  config: z.record(z.unknown()).default({}),
});

export const feedSettingsSchema = z.object({
  tabs: z.record(z.boolean()).optional(),
  requireSpace: z.boolean().optional(),
  moderateNewMembersDays: z.number().int().min(0).max(30).optional(),
  spaces: z
    .array(
      z.object({
        id: idSchema.optional(),
        name: z.string().trim().min(1).max(40),
        postPermission: z.enum(['everyone', 'admins_only', 'premium']),
        sortOrder: z.number().int().default(0),
      }),
    )
    .optional(),
});

export const affiliateSettingsSchema = z.object({
  enabled: z.boolean(),
  commissionRateBps: z.number().int().min(0).max(5000),
  holdDays: z.number().int().min(0).max(90).default(14),
  minWithdrawalMinor: amountMinorSchema.default(500_000),
  leaderboardVisibility: z.enum(['members', 'affiliates_only', 'hidden']).default('members'),
  leaderboardShowMoney: z.boolean().default(true),
});

export const joinQuestionSchema = z.object({
  id: idSchema.optional(),
  question: z.string().trim().min(3).max(200),
  required: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
});

export const userHandleParam = z.object({ handle: handleSchema });
