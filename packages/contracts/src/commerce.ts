// Hợp đồng thương mại: sản phẩm, offer, checkout, thanh toán, hoàn tiền, gói nền tảng.
import { z } from 'zod';
import { amountMinorSchema, billingCycleSchema, currencySchema, idSchema, paymentProviderSchema } from './common';

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
      guarantee: z.string().max(300).default('Hoàn tiền trong 7 ngày nếu bạn xem chưa quá 20% nội dung.'),
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
  z.object({ type: z.literal('tier'), communityId: idSchema, tierKey: z.enum(['premium', 'vip', 'standard']), cycle: billingCycleSchema }),
  z.object({ type: z.literal('product'), productId: idSchema }),
  z.object({ type: z.literal('platform'), workspaceId: idSchema, cycle: z.enum(['monthly', 'yearly']) }),
]);
export type CheckoutTarget = z.infer<typeof checkoutTargetSchema>;

export const createCheckoutSchema = z.object({
  target: checkoutTargetSchema,
  couponCode: z.string().max(32).optional(),
  provider: paymentProviderSchema.default('sepay'),
  ref: z.string().max(32).optional(),
  returnUrl: z.string().url().optional(),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

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
  }),
  z.object({ kind: z.literal('redirect'), url: z.string(), deeplink: z.string().optional() }),
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
