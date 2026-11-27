// Hợp đồng thương mại: sản phẩm, offer, checkout, thanh toán, hoàn tiền, gói nền tảng.
import { z } from 'zod';
import { amountMinorSchema, billingCycleSchema, currencySchema, emailSchema, idSchema, paymentProviderSchema } from './common';
import { bankCodeSchema } from './affiliate';
import { paidPlanKeySchema, planCycleSchema } from './plans';

/**
 * Luật hoàn tiền mà người mua TỰ BẤM được cho sản phẩm mua lẻ trong Cửa hàng: trong `days` ngày kể từ lúc thanh toán;
 * nếu sản phẩm là một khóa học thì phải xem chưa quá `maxCourseProgressPercent` phần trăm nội dung. Máy chủ chặn theo
 * BUSINESS.courseRefundDays và BUSINESS.courseRefundMaxProgressPercent (`requestRefund`); test ở packages/core kiểm hai
 * nơi khớp nhau. Mọi câu chữ về hoàn tiền trên web lấy từ đây, để lời hứa không lệch khỏi luật đang chạy (trước đây
 * có chỗ ghi "chưa học quá nửa khóa", có chỗ thiếu điều kiện tiến độ).
 */
export const SELF_REFUND = { days: 7, maxCourseProgressPercent: 20 } as const;

/** Một câu cam kết hoàn tiền mặc định cho trang sản phẩm. Điều kiện tiến độ chỉ áp dụng cho khóa học. */
export function selfRefundRule(kind: 'course' | 'bundle' | 'digital'): string {
  return kind === 'course'
    ? `Hoàn tiền trong ${SELF_REFUND.days} ngày nếu bạn xem chưa quá ${SELF_REFUND.maxCourseProgressPercent}% nội dung.`
    : `Hoàn tiền trong ${SELF_REFUND.days} ngày kể từ khi thanh toán.`;
}

/** Điều kiện hiện ở hộp thoại "Yêu cầu hoàn tiền", lúc chưa biết đơn có phải khóa học hay không. */
export function selfRefundConditions(): string {
  return `Áp dụng trong ${SELF_REFUND.days} ngày kể từ khi thanh toán. Nếu là khóa học, bạn phải xem chưa quá ${SELF_REFUND.maxCourseProgressPercent}% nội dung.`;
}

/**
 * Tiền hoàn về bằng đường nào: `gateway` là cổng thanh toán tự hoàn về phương thức đã trả; `seller_transfer` là chủ
 * hội tự chuyển lại (đơn trả thẳng chủ hội bằng chuyển khoản hoặc VNPAY, là các cách không có lệnh hoàn tự động);
 * `platform_transfer` là Hội Mình tự chuyển lại (đơn gói Hội Mình trả bằng chuyển khoản).
 */
export type RefundRoute = 'gateway' | 'seller_transfer' | 'platform_transfer';

/** Câu báo cho người mua biết tiền hoàn về thế nào. Không hứa số ngày: việc đó tùy người chuyển, cổng và ngân hàng. */
export function refundRouteNote(route: RefundRoute): string {
  if (route === 'seller_transfer') return 'Đơn này bạn đã trả thẳng cho chủ hội, nên chủ hội sẽ tự chuyển lại tiền cho bạn. Chờ lâu chưa thấy thì bạn nhắn chủ hội trong mục Tin nhắn.';
  if (route === 'platform_transfer') return 'Hội Mình sẽ chuyển khoản lại số tiền này cho bạn.';
  return 'Tiền được hoàn về đúng phương thức bạn đã trả. Thời gian tiền về tùy cổng thanh toán và ngân hàng của bạn.';
}

export const productKindSchema = z.enum(['course', 'bundle', 'digital']);
export type ProductKind = z.infer<typeof productKindSchema>;
export const salesModeSchema = z.enum(['native', 'external_landing']);
export const ctaTextSchema = z.enum(['Mua ngay', 'Đăng ký', 'Tham gia', 'Xem chi tiết', 'Tìm hiểu thêm']);

export const createProductSchema = z.object({
  kind: productKindSchema,
  name: z.string().trim().min(3).max(120),
  slug: z.string().min(3).max(64).optional(),
  shortDescription: z.string().trim().max(200).default(''),
  coverFileId: idSchema.nullable().optional(),
  coverColor: z.string().max(16).optional(),
  priceMinor: amountMinorSchema,
  compareAtMinor: amountMinorSchema.nullable().optional(),
  currency: currencySchema.default('VND'),
  courseId: idSchema.nullable().optional(),
  bundleItemProductIds: z.array(idSchema).max(30).default([]),
  digitalFileIds: z.array(idSchema).max(20).default([]),
  page: z
    .object({
      headline: z.string().max(160).default(''),
      subheadline: z.string().max(200).default(''),
      introVideoUrl: z.string().url().nullable().optional(),
      benefits: z.array(z.string().max(160)).max(12).default([]),
      faq: z.array(z.object({ q: z.string().max(200), a: z.string().max(1000) })).max(12).default([]),
      instructor: z.object({ name: z.string().max(80), bio: z.string().max(500) }).nullable().optional(),
      ctaText: ctaTextSchema.default('Mua ngay'),
      guarantee: z.string().max(300).default(selfRefundRule('course')),
      salesMode: salesModeSchema.default('native'),
      externalLandingUrl: z.string().url().nullable().optional(),
    })
    .default({}),
  status: z.enum(['draft', 'published', 'archived']).default('published'),
  launchDiscountEndsAt: z.string().datetime().nullable().optional(),
});
export type CreateProductInput = z.infer<typeof createProductSchema>;
export const updateProductSchema = createProductSchema.partial();

export const storeQuerySchema = z.object({
  kind: productKindSchema.optional(),
  q: z.string().max(80).optional(),
  sort: z.enum(['newest', 'bestselling', 'price_asc', 'price_desc']).default('newest'),
});

/** Đích của một checkout: tier hội, sản phẩm cửa hàng, hoặc gói nền tảng. */
export const checkoutTargetSchema = z.discriminatedUnion('type', [
  // `months`: kỳ hạn người mua chọn (1 đến 36 tháng). Thiếu thì suy từ `cycle` như trước: monthly là 1 tháng, yearly là 12 tháng.
  z.object({ type: z.literal('tier'), communityId: idSchema, tierKey: z.enum(['premium', 'vip', 'standard']), cycle: billingCycleSchema, months: z.number().int().min(1).max(36).optional() }),
  z.object({ type: z.literal('product'), productId: idSchema }),
  z.object({ type: z.literal('platform'), communityId: idSchema, planKey: paidPlanKeySchema, cycle: planCycleSchema }),
]);
export type CheckoutTarget = z.infer<typeof checkoutTargetSchema>;

export const createCheckoutSchema = z.object({
  target: checkoutTargetSchema,
  couponCode: z.string().max(32).optional(),
  /** Không gửi thì dùng cách chủ hội (hoặc quản trị, với gói Hội Mình) đặt làm mặc định. */
  provider: paymentProviderSchema.optional(),
  /** Một mã giới thiệu hoặc danh sách mã cách nhau bằng dấu phẩy (xem refCodes). */
  ref: z.string().max(700).optional(),
  returnUrl: z.string().url().optional(),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

/**
 * Mua khi chưa đăng nhập (mua trước, tạo tài khoản sau): như checkout thường, thêm email và tên người mua. Chỉ cho gói
 * thành viên của hội và sản phẩm cửa hàng; gói Hội Mình cho hội thì chủ hội phải đăng nhập.
 */
export const guestCheckoutSchema = createCheckoutSchema.extend({
  email: emailSchema,
  name: z.string().trim().min(2).max(80),
});
export type GuestCheckoutInput = z.infer<typeof guestCheckoutSchema>;

/**
 * Tạo tài khoản cho người đã mua bằng email. Một trong hai bằng chứng: `token` là link trong email (chứng minh được email),
 * hoặc `orderId` + `orderToken` là mã đơn mà chính trình duyệt này vừa tạo (màn thanh toán xong).
 */
export const claimAccountSchema = z.object({
  token: z.string().max(200).optional(),
  orderId: idSchema.optional(),
  orderToken: z.string().max(200).optional(),
  name: z.string().trim().min(2).max(80).optional(),
  password: z.string().min(8).max(128),
}).refine((v) => Boolean(v.token) || Boolean(v.orderId && v.orderToken), { message: 'Thiếu link tạo tài khoản' });
export type ClaimAccountInput = z.infer<typeof claimAccountSchema>;

/** Hướng dẫn thanh toán trả về cho client theo từng cổng. */
export const paymentInstructionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('bank_qr'),
    qrImageUrl: z.string(),
    bankName: z.string(),
    bankCode: z.string(),
    accountNumber: z.string(),
    accountHolder: z.string(),
    amountMinor: amountMinorSchema,
    transferContent: z.string(),
    /** Tiền về tài khoản của ai: 'owner' = thẳng tài khoản chủ hội (đơn của hội); không có = tài khoản Hội Mình (đơn gói). */
    payee: z.literal('owner').optional(),
    /** Với đơn trả thẳng chủ hội: 'auto' = tự xác nhận khi tiền về, 'manual' = chủ hội bấm "Đã nhận tiền". */
    confirmMode: z.enum(['manual', 'auto']).optional(),
  }),
  // `payee: 'owner'`: người mua trả qua cổng (MoMo, VNPAY, PayPal, Stripe) của chính chủ hội, tiền không qua Hội Mình.
  z.object({ kind: z.literal('redirect'), url: z.string(), deeplink: z.string().optional(), payee: z.literal('owner').optional() }),
]);
export type PaymentInstruction = z.infer<typeof paymentInstructionSchema>;

export const checkoutSessionSchema = z.object({
  orderId: idSchema,
  paymentId: idSchema,
  reference: z.string(),
  provider: paymentProviderSchema,
  status: z.string(),
  amountMinor: amountMinorSchema,
  discountMinor: amountMinorSchema,
  currency: currencySchema,
  instruction: paymentInstructionSchema,
  summary: z.object({ title: z.string(), subtitle: z.string(), lines: z.array(z.object({ label: z.string(), amountMinor: z.number() })) }),
  referredBy: z.string().nullable(),
});
export type CheckoutSession = z.infer<typeof checkoutSessionSchema>;

export const refundRequestSchema = z.object({
  orderId: idSchema,
  reason: z.string().max(500).default(''),
});

export const couponSchema = z.object({
  code: z.string().trim().min(3).max(32).toUpperCase(),
  percentOff: z.number().int().min(1).max(100).nullable().optional(),
  amountOffMinor: amountMinorSchema.nullable().optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  appliesTo: z.enum(['all', 'tier', 'product']).default('all'),
});

/** Chủ hội cài tài khoản nhận tiền của chính mình: tiền bán hàng của hội về thẳng tài khoản này. */
export const payoutConfirmModeSchema = z.enum(['manual', 'auto']);
export type PayoutConfirmMode = z.infer<typeof payoutConfirmModeSchema>;
export const payoutAccountInputSchema = z.object({
  bankCode: bankCodeSchema,
  accountNumber: z.string().trim().regex(/^\d{6,20}$/, 'Số tài khoản gồm 6 tới 20 chữ số'),
  accountHolder: z.string().trim().min(3, 'Tên chủ tài khoản cần ít nhất 3 ký tự').max(80).transform((v) => v.toUpperCase()),
  confirmMode: payoutConfirmModeSchema.default('manual'),
  /** Bật hoặc tắt cách chuyển khoản QR cùng lúc lưu. Không gửi là giữ nguyên (lưu lần đầu là bật). */
  enabled: z.boolean().optional(),
});
export type PayoutAccountInput = z.infer<typeof payoutAccountInputSchema>;

/**
 * Cổng thanh toán riêng của chủ hội, ngoài chuyển khoản QR: người mua trả qua cổng của chính chủ hội, tiền về tài khoản
 * cổng của chủ hội, không qua Hội Mình. Chủ hội nhập khóa của mình ở Cài đặt, Nhận tiền.
 */
export const OWNER_GATEWAYS = ['momo', 'vnpay', 'paypal', 'stripe'] as const;
export const ownerGatewaySchema = z.enum(OWNER_GATEWAYS);
export type OwnerGateway = z.infer<typeof ownerGatewaySchema>;

export interface OwnerGatewayField {
  key: string;
  label: string;
  /** Ô bí mật: lưu mã hóa, không bao giờ hiện lại, chỉ hiện 4 ký tự cuối. */
  secret: boolean;
  placeholder: string;
  /**
   * Ô của bước webhook: chỉ có sau khi dán địa chỉ webhook của hội vào trang của cổng, mà địa chỉ đó chỉ có sau lần lưu
   * đầu. Nên lưu lần đầu không cần ô này; cổng chỉ hiện cho người mua khi đã điền đủ.
   */
  webhookStep?: true;
}

/** Các ô khóa chủ hội nhập cho từng cổng, đúng tên gọi trong trang quản lý của cổng đó. */
export const OWNER_GATEWAY_FIELDS: Record<OwnerGateway, OwnerGatewayField[]> = {
  momo: [
    { key: 'partnerCode', label: 'Partner Code', secret: false, placeholder: 'MOMOXXXX' },
    { key: 'accessKey', label: 'Access Key', secret: true, placeholder: 'Access Key trong trang M4B' },
    { key: 'secretKey', label: 'Secret Key', secret: true, placeholder: 'Secret Key trong trang M4B' },
  ],
  vnpay: [
    { key: 'tmnCode', label: 'Mã website (vnp_TmnCode)', secret: false, placeholder: '8 ký tự VNPAY cấp' },
    { key: 'hashSecret', label: 'Chuỗi bí mật (vnp_HashSecret)', secret: true, placeholder: 'Chuỗi bí mật VNPAY gửi qua email' },
  ],
  paypal: [
    { key: 'clientId', label: 'Client ID', secret: false, placeholder: 'Client ID của ứng dụng PayPal' },
    { key: 'clientSecret', label: 'Secret', secret: true, placeholder: 'Secret của ứng dụng PayPal' },
    { key: 'webhookId', label: 'Webhook ID', secret: false, placeholder: 'Mã webhook sau khi thêm địa chỉ của hội', webhookStep: true },
  ],
  stripe: [
    { key: 'secretKey', label: 'Secret key', secret: true, placeholder: 'sk_live_...' },
    { key: 'webhookSecret', label: 'Signing secret của webhook', secret: true, placeholder: 'whsec_...', webhookStep: true },
  ],
};

/** Chủ hội lưu một cổng: ô khóa để trống là giữ nguyên khóa đã lưu. */
export const ownerGatewayInputSchema = z.object({
  mode: z.enum(['sandbox', 'production']).optional(),
  enabled: z.boolean().optional(),
  credentials: z.record(z.string().trim().max(500)).optional(),
});
export type OwnerGatewayInput = z.infer<typeof ownerGatewayInputSchema>;

/** Bật tắt chuyển khoản QR và chọn cách thanh toán mặc định cho người mua. */
export const paymentMethodsUpdateSchema = z.object({
  defaultMethod: paymentProviderSchema.nullable().optional(),
  bankEnabled: z.boolean().optional(),
});
export type PaymentMethodsUpdate = z.infer<typeof paymentMethodsUpdateSchema>;

/** Cổng đã điền đủ mọi ô (kể cả bước webhook) chưa, xét theo phần tóm tắt không bí mật đã lưu. */
export function gatewayComplete(provider: OwnerGateway, summary: Record<string, string>): boolean {
  return OWNER_GATEWAY_FIELDS[provider].every((f) => Boolean(summary[f.key]));
}
