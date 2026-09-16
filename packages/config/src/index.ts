// Cấu hình dùng chung: đọc biến môi trường, validate bằng Zod, cung cấp hằng số nghiệp vụ.
import { z } from 'zod';

export * from './crypto';
export * from './totp';

const bool = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes'].includes(v.toLowerCase())));

const mode = z.enum(['sandbox', 'production']).default('sandbox');

/** Schema biến môi trường của toàn hệ thống. */
export const envSchema = z.object({
  APP_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:8787'),
  API_PORT: z.coerce.number().int().default(8787),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  DATABASE_URL: z.string().default('pglite://./.data/hoiminh'),
  DATABASE_DIRECT_URL: z.string().optional().default(''),

  AUTH_PROVIDER: z.enum(['local', 'supabase']).default('local'),
  AUTH_JWT_SECRET: z.string().min(16).default('hoiminh-dev-secret-doi-o-production-32'),
  SUPABASE_URL: z.string().default(''),
  SUPABASE_ANON_KEY: z.string().default(''),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default(''),
  SUPABASE_JWT_SECRET: z.string().default(''),

  ENCRYPTION_KEY: z.string().default(''),
  ENCRYPTION_KEY_VERSION: z.coerce.number().int().default(1),

  RESEND_API_KEY: z.string().default(''),
  EMAIL_FROM: z.string().default('Hội Mình <no-reply@hoiminh.vn>'),

  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET: z.string().default('hoiminh-files'),
  R2_PUBLIC_BASE_URL: z.string().default(''),

  SEPAY_MODE: mode,
  SEPAY_API_KEY: z.string().default('sepay-sandbox-key'),
  SEPAY_BANK_CODE: z.string().default('VCB'),
  SEPAY_BANK_ACCOUNT: z.string().default('0071000123456'),
  SEPAY_ACCOUNT_HOLDER: z.string().default('HOI MINH JSC'),
  SEPAY_QR_TEMPLATE: z.string().default('compact'),

  MOMO_MODE: mode,
  MOMO_PARTNER_CODE: z.string().default('MOMOTEST'),
  MOMO_ACCESS_KEY: z.string().default('momo-sandbox-access'),
  MOMO_SECRET_KEY: z.string().default('momo-sandbox-secret'),
  MOMO_ENDPOINT: z.string().default('https://test-payment.momo.vn'),

  VNPAY_MODE: mode,
  VNPAY_TMN_CODE: z.string().default('HOIMINH1'),
  VNPAY_HASH_SECRET: z.string().default('vnpay-sandbox-secret'),
  VNPAY_ENDPOINT: z.string().default('https://sandbox.vnpayment.vn/paymentv2/vpcpay.html'),

  PAYPAL_MODE: mode,
  PAYPAL_CLIENT_ID: z.string().default(''),
  PAYPAL_CLIENT_SECRET: z.string().default(''),
  PAYPAL_WEBHOOK_ID: z.string().default(''),
  PAYPAL_USD_RATE: z.coerce.number().default(25000),

  DEV_FAKE_EMAIL: bool.default(true),
});

export type Env = z.infer<typeof envSchema>;

/** Đọc và validate biến môi trường từ một object bất kỳ (process.env hoặc Worker env). */
export function loadEnv(source: Record<string, string | undefined> = {}): Env {
  const cleaned: Record<string, string> = {};
  for (const [k, v] of Object.entries(source)) if (v !== undefined && v !== '') cleaned[k] = v;
  return envSchema.parse(cleaned);
}

/** Hằng số nghiệp vụ đã chốt trong kiến trúc. */
export const BUSINESS = {
  /** Số ngày giữ hoa hồng cộng sự trong hội (mục 201). */
  communityHoldDays: 14,
  /** Số ngày giữ hoa hồng cộng sự nền tảng (mục 201). */
  platformHoldDays: 30,
  /** Mức rút tối thiểu mặc định, đơn vị đồng. */
  minWithdrawalMinor: 500_000,
  /** Cookie attribution affiliate, số ngày (mục 108). */
  affiliateCookieDays: 30,
  /** Dùng thử gói nền tảng, số ngày (mục 202). */
  platformTrialDays: 14,
  /** Giá gói nền tảng theo tháng, đồng. */
  platformMonthlyMinor: 499_000,
  /** Giá gói nền tảng theo năm = 10 tháng, đồng. */
  platformYearlyMinor: 4_990_000,
  /** Hoàn tiền khóa học mua lẻ trong 7 ngày nếu xem chưa quá 20%. */
  courseRefundDays: 7,
  courseRefundMaxProgressPercent: 20,
  /** Tin nhắn chào tự động: độ trễ mặc định (phút). */
  welcomeDmDelayMinutes: 2,
  /** Status ngắn: tối đa ký tự để dùng nền màu. */
  statusMaxChars: 130,
  /** Polling tin nhắn (giây). */
  messagePollSeconds: 15,
  /** Snapshot xếp hạng cộng sự (phút). */
  leaderboardSnapshotMinutes: 10,
  /** Số câu hỏi khi tham gia tối đa. */
  maxJoinQuestions: 3,
  /** Nhắc gia hạn gói nền tảng trước N ngày. */
  trialReminderDays: [7, 3, 1],
  /** Tiền tệ mặc định. */
  defaultCurrency: 'VND',
  defaultTimezone: 'Asia/Ho_Chi_Minh',
  defaultLocale: 'vi-VN',
} as const;

/** Slug bị cấm dùng cho hội (trùng route hệ thống). */
export const RESERVED_SLUGS = new Set([
  'admin', 'he-thong', 'api', 'v1', 'kham-pha', 'dang-nhap', 'dang-ky', 'quen-mat-khau', 'dat-lai-mat-khau',
  'xac-minh-email', 'tao-hoi', 'tai-khoan', 'tin-nhan', 'thong-bao', 'u', 'r', 'thanh-toan', 'auth', 'assets',
  'static', 'hoiminh', 'www', 'app', 'mail', 'support', 'help',
]);
