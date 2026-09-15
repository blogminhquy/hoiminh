// Hợp đồng xác thực: đăng ký, đăng nhập, xác minh email, đặt lại mật khẩu.
import { z } from 'zod';
import { emailSchema, idSchema } from './common';

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: emailSchema,
  password: z.string().min(8).max(128),
  /** Mã cộng sự đọc từ cookie/ref khi đăng ký (ghi nhận người giới thiệu). */
  ref: z.string().max(32).optional(),
  /** Slug hội mà người dùng đang đăng ký để tham gia (nếu đến từ link hội). */
  communitySlug: z.string().max(48).optional(),
  acceptTerms: z.literal(true),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  remember: z.boolean().optional().default(true),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({ code: z.string().regex(/^\d{6}$/) });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(16),
  password: z.string().min(8).max(128),
  logoutOthers: z.boolean().optional().default(true),
});

/** Đổi mật khẩu khi đang đăng nhập: phải nhập đúng mật khẩu hiện tại. */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Nhập mật khẩu hiện tại'),
    newPassword: z.string().min(8, 'Mật khẩu mới tối thiểu 8 ký tự').max(128),
    logoutOthers: z.boolean().optional().default(true),
  })
  .refine((v) => v.currentPassword !== v.newPassword, { message: 'Mật khẩu mới phải khác mật khẩu hiện tại', path: ['newPassword'] });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export const authUserSchema = z.object({
  id: idSchema,
  email: z.string(),
  name: z.string(),
  handle: z.string(),
  avatarUrl: z.string().nullable(),
  emailVerifiedAt: z.string().nullable(),
  isSuperAdmin: z.boolean(),
  locale: z.string(),
  timezone: z.string(),
});
export type AuthUser = z.infer<typeof authUserSchema>;

export const authSessionSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  expiresAt: z.string(),
  user: authUserSchema,
});
export type AuthSession = z.infer<typeof authSessionSchema>;
