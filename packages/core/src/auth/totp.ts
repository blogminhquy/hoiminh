// Xác thực hai lớp bằng ứng dụng (TOTP): bật, xác nhận, tắt, mã dự phòng, và bước kiểm
// tra khi đăng nhập. Bí mật mã hóa bằng ENCRYPTION_KEY, mã dự phòng chỉ lưu bản băm.
import { decryptJson, encryptJson, generateBackupCodes, generateTotpSecret, normalizeBackupCode, sha256Hex, totpUri, verifyTotp } from '@hoiminh/config';
import { templates } from '@hoiminh/email';
import { eq } from 'drizzle-orm';
import { userTotp, users } from '@hoiminh/db';
import type { Ctx } from '../context';
import { AppError, invalid, notFound, unauthorized } from '../errors';
import { requireUser } from '../permissions';
import { audit } from '../services/audit';
import type { AuthProvider } from './providers';

export interface TotpStatus {
  enabled: boolean;
  confirmedAt: string | null;
  backupCodesLeft: number;
}

async function row(ctx: Ctx, userId: string) {
  return ctx.db.query.userTotp.findFirst({ where: eq(userTotp.userId, userId) });
}

async function secretOf(ctx: Ctx, encrypted: string): Promise<string> {
  return decryptJson<string>(encrypted, ctx.env.ENCRYPTION_KEY);
}

/** Trạng thái hai lớp của chính mình. */
export async function status(ctx: Ctx): Promise<TotpStatus> {
  const r = await row(ctx, requireUser(ctx));
  return { enabled: Boolean(r?.confirmedAt), confirmedAt: r?.confirmedAt?.toISOString() ?? null, backupCodesLeft: r?.backupCodeHashes.length ?? 0 };
}

/**
 * Bước 1: sinh bí mật mới và trả về chuỗi otpauth để quét.
 * Chưa bật cho tới khi người dùng nhập đúng một mã (confirm), nên gọi lại nhiều lần vô hại —
 * mỗi lần thay bí mật chưa xác nhận, không đụng tới bí mật đang dùng.
 */
export async function startSetup(ctx: Ctx): Promise<{ secret: string; uri: string }> {
  const userId = requireUser(ctx);
  const existing = await row(ctx, userId);
  if (existing?.confirmedAt) throw invalid('Xác thực hai lớp đang bật. Tắt trước nếu muốn đổi thiết bị.');
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound();
  const secret = generateTotpSecret();
  const secretEncrypted = await encryptJson(secret, ctx.env.ENCRYPTION_KEY);
  const values = { userId, secretEncrypted, confirmedAt: null, lastStep: 0, backupCodeHashes: [], updatedAt: ctx.now() };
  await ctx.db.insert(userTotp).values(values).onConflictDoUpdate({ target: userTotp.userId, set: values });
  return { secret, uri: totpUri(secret, user.email) };
}

/** Bước 2: nhập mã từ ứng dụng để bật, nhận về danh sách mã dự phòng (chỉ hiện một lần). */
export async function confirmSetup(ctx: Ctx, code: string): Promise<{ backupCodes: string[] }> {
  const userId = requireUser(ctx);
  const r = await row(ctx, userId);
  if (!r) throw invalid('Chưa bắt đầu cài đặt xác thực hai lớp');
  if (r.confirmedAt) throw invalid('Xác thực hai lớp đã bật');
  const v = await verifyTotp(await secretOf(ctx, r.secretEncrypted), code, { at: ctx.now() });
  if (!v.ok) throw invalid('Mã không đúng. Kiểm tra giờ trên điện thoại rồi thử lại.');
  const backupCodes = generateBackupCodes();
  const backupCodeHashes = await Promise.all(backupCodes.map((c) => sha256Hex(normalizeBackupCode(c))));
  await ctx.db.update(userTotp).set({ confirmedAt: ctx.now(), lastStep: v.step, backupCodeHashes, updatedAt: ctx.now() }).where(eq(userTotp.userId, userId));
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (user) await ctx.email.send(templates.twoFactorChanged(user.email, user.name, true));
  await audit(ctx, { action: 'auth.2fa_enabled', resourceType: 'user', resourceId: userId });
  return { backupCodes };
}

/** Sinh lại mã dự phòng (mã cũ hết hiệu lực). Cần một mã hợp lệ từ ứng dụng. */
export async function regenerateBackupCodes(ctx: Ctx, code: string): Promise<{ backupCodes: string[] }> {
  const userId = requireUser(ctx);
  const r = await row(ctx, userId);
  if (!r?.confirmedAt) throw invalid('Xác thực hai lớp chưa bật');
  const v = await verifyTotp(await secretOf(ctx, r.secretEncrypted), code, { at: ctx.now(), minStep: r.lastStep });
  if (!v.ok) throw invalid('Mã không đúng hoặc vừa được dùng, chờ mã mới rồi thử lại.');
  const backupCodes = generateBackupCodes();
  const backupCodeHashes = await Promise.all(backupCodes.map((c) => sha256Hex(normalizeBackupCode(c))));
  await ctx.db.update(userTotp).set({ backupCodeHashes, lastStep: v.step, updatedAt: ctx.now() }).where(eq(userTotp.userId, userId));
  await audit(ctx, { action: 'auth.2fa_backup_regenerated', resourceType: 'user', resourceId: userId });
  return { backupCodes };
}

/** Tắt hai lớp: bắt buộc nhập lại mật khẩu, để người mượn máy không tắt được. */
export async function disable(ctx: Ctx, provider: AuthProvider, password: string): Promise<void> {
  const userId = requireUser(ctx);
  const user = await ctx.db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user) throw notFound();
  const identity = await provider.signIn(user.email, password, user.id);
  if (!identity) throw unauthorized('Mật khẩu không đúng');
  await ctx.db.delete(userTotp).where(eq(userTotp.userId, userId));
  await ctx.email.send(templates.twoFactorChanged(user.email, user.name, false));
  await audit(ctx, { action: 'auth.2fa_disabled', resourceType: 'user', resourceId: userId });
}

/** Người này có bật hai lớp không (dùng trong luồng đăng nhập, chưa có actor). */
export async function isEnabledFor(ctx: Ctx, userId: string): Promise<boolean> {
  const r = await row(ctx, userId);
  return Boolean(r?.confirmedAt);
}

/**
 * Kiểm tra mã ở bước hai của đăng nhập: chấp nhận mã 6 số từ ứng dụng hoặc một mã dự phòng.
 * Mã dự phòng dùng xong bị xóa khỏi danh sách.
 */
export async function verifyForLogin(ctx: Ctx, userId: string, code: string): Promise<void> {
  const r = await row(ctx, userId);
  if (!r?.confirmedAt) throw invalid('Tài khoản chưa bật xác thực hai lớp');
  const digits = code.replace(/\D/g, '');
  if (digits.length === 6) {
    const v = await verifyTotp(await secretOf(ctx, r.secretEncrypted), digits, { at: ctx.now(), minStep: r.lastStep });
    if (v.ok) {
      await ctx.db.update(userTotp).set({ lastStep: v.step, updatedAt: ctx.now() }).where(eq(userTotp.userId, userId));
      return;
    }
  }
  const hash = await sha256Hex(normalizeBackupCode(code));
  const left = r.backupCodeHashes.filter((h) => h !== hash);
  if (left.length !== r.backupCodeHashes.length) {
    await ctx.db.update(userTotp).set({ backupCodeHashes: left, updatedAt: ctx.now() }).where(eq(userTotp.userId, userId));
    await audit(ctx, { action: 'auth.2fa_backup_used', resourceType: 'user', resourceId: userId, metadata: { left: left.length } });
    return;
  }
  throw new AppError('unauthorized', 'Mã xác thực không đúng');
}
