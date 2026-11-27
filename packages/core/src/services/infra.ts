// Hệ thống · Hạ tầng: xem hạ tầng đang dùng thật và đổi khóa (Resend, Cloudflare) ngay trên web.
import { encryptJson, envSchema, systemSecretStatus, type Env } from '@hoiminh/config';
import { providerAccounts } from '@hoiminh/db';
import { emailProviderLabel } from '@hoiminh/email';
import { and, eq } from 'drizzle-orm';
import type { Ctx } from '../context';
import { invalid } from '../errors';
import { INFRA_FIELDS, INFRA_PROVIDER, invalidateInfraCache, readInfra, secretHint, type InfraSection } from '../lib/infra-settings';
import { requireSuperAdmin } from '../permissions';
import { audit } from './audit';
import { listReleases } from './releases';

const DEFAULTS: Env = envSchema.parse({});

/** Nguồn của một giá trị: nhập ở trang này, secret của Worker, mặc định trong mã, hoặc chưa có. */
export type InfraSource = 'saved' | 'worker' | 'default' | 'none';

export interface InfraFieldView {
  source: InfraSource;
  /** Giá trị đang dùng; với bí mật luôn là null. */
  value: string | null;
  /** 4 ký tự cuối của bí mật đang dùng. */
  hint: string | null;
}

/** Kiểm tra định dạng trước khi lưu, để lỗi gõ nhầm hiện ngay chứ không đợi tới lần gửi email kế tiếp. */
const RULES: Record<InfraSection, Record<string, [RegExp, string]>> = {
  email: {
    apiKey: [/^re_[A-Za-z0-9_]{8,}$/, 'API key Resend bắt đầu bằng "re_", dán nguyên chuỗi từ trang API Keys của Resend.'],
    from: [/^([^<>]+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>|[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+)$/, 'Địa chỉ gửi có dạng Tên <email@tenmien.com> hoặc email@tenmien.com.'],
  },
  release: {
    apiToken: [/^\S{20,}$/, 'Token Cloudflare là một chuỗi dài, không có khoảng trắng.'],
    accountId: [/^[a-f0-9]{32}$/i, 'Account ID gồm 32 ký tự chữ và số, xem ở trang Overview của Cloudflare (cột phải).'],
    webScript: [/^[a-z0-9][a-z0-9-]{0,62}$/, 'Tên Worker chỉ gồm chữ thường, số và dấu gạch nối.'],
  },
  gif: {
    apiKey: [/^[A-Za-z0-9]{20,64}$/, 'API key GIPHY là một chuỗi chữ và số (thường 32 ký tự), sao chép ở trang Dashboard của developers.giphy.com.'],
  },
};

function fieldView(ctx: Ctx, saved: Record<string, string> | undefined, name: string, section: InfraSection): InfraFieldView {
  const f = INFRA_FIELDS[section][name]!;
  const base = ctx.infra?.base ?? ctx.env;
  const savedValue = saved?.[name]?.trim() ?? '';
  const baseValue = String(base[f.env] ?? '');
  const source: InfraSource = savedValue ? 'saved' : !baseValue ? 'none' : baseValue === String(DEFAULTS[f.env] ?? '') ? 'default' : 'worker';
  const current = savedValue || baseValue;
  return { source, value: f.secret ? null : current || null, hint: f.secret ? secretHint(current) : null };
}

/** Toàn cảnh hạ tầng cho trang Hệ thống · Hạ tầng. Không bao giờ trả về bí mật. */
export async function getInfra(ctx: Ctx) {
  requireSuperAdmin(ctx);
  const stored = await readInfra(ctx.db, ctx.env, ctx.log);
  const section = (s: InfraSection) => ({
    fields: Object.fromEntries(Object.keys(INFRA_FIELDS[s]).map((name) => [name, fieldView(ctx, stored.values[s], name, s)])) as Record<string, InfraFieldView>,
    updatedAt: stored.updatedAt[s]?.toISOString() ?? null,
  });
  const secrets = systemSecretStatus(ctx.infra?.base ?? ctx.env);
  return {
    env: ctx.env.APP_ENV,
    email: { ...section('email'), provider: emailProviderLabel(ctx.email) },
    release: { ...section('release'), configured: Boolean(ctx.env.CF_RELEASE_API_TOKEN && ctx.env.CF_RELEASE_ACCOUNT_ID) },
    gif: { ...section('gif'), configured: Boolean(ctx.env.GIPHY_API_KEY?.trim()) },
    storage: { label: ctx.media.label, kind: ctx.media.kind, bucket: ctx.env.R2_BUCKET, publicBaseUrl: ctx.env.R2_PUBLIC_BASE_URL || null },
    secrets,
  };
}

/**
 * Lưu khóa của một phần. Ô để trống nghĩa là giữ nguyên; tên nằm trong `clear` thì xóa giá trị đã lưu để
 * quay về secret của Worker. Áp ngay vào App đang chạy nên "Gửi email thử" ngay sau đó đã dùng key mới.
 */
export async function updateInfra(ctx: Ctx, section: InfraSection, input: { values?: Record<string, string>; clear?: string[] }) {
  requireSuperAdmin(ctx);
  const spec = INFRA_FIELDS[section];
  if (!spec) throw invalid('Phần cấu hình không tồn tại');
  const incoming = Object.entries(input.values ?? {}).map(([k, v]) => [k, v.trim()] as const).filter(([, v]) => v);
  const clear = input.clear ?? [];
  for (const [name] of [...incoming, ...clear.map((c) => [c, ''] as const)]) if (!spec[name]) throw invalid(`Không có ô "${name}" trong phần này`);
  for (const [name, value] of incoming) {
    const [re, msg] = RULES[section][name]!;
    if (!re.test(value)) throw invalid(msg, { field: name });
  }

  const provider = INFRA_PROVIDER[section];
  const stored = await readInfra(ctx.db, ctx.env, ctx.log);
  const next: Record<string, string> = { ...(stored.values[section] ?? {}) };
  for (const name of clear) delete next[name];
  for (const [name, value] of incoming) next[name] = value;

  const existing = await ctx.db.query.providerAccounts.findFirst({ where: and(eq(providerAccounts.provider, provider), eq(providerAccounts.scopeType, 'platform')) });
  const credentialsEncrypted = Object.keys(next).length ? await encryptJson(next, ctx.env.ENCRYPTION_KEY, ctx.env.ENCRYPTION_KEY_VERSION) : null;
  const values = { provider, scopeType: 'platform' as const, mode: 'production' as const, enabled: true, credentialsEncrypted, updatedAt: ctx.now() };
  if (existing) await ctx.db.update(providerAccounts).set(values).where(eq(providerAccounts.id, existing.id));
  else await ctx.db.insert(providerAccounts).values(values);

  // Chỉ ghi tên ô đã đổi, không ghi giá trị.
  await audit(ctx, { action: 'infra.update', resourceType: 'infra', resourceId: section, metadata: { changed: incoming.map(([k]) => k), cleared: clear } });
  invalidateInfraCache();
  ctx.infra?.apply({ ...stored.values, [section]: next });
  return getInfra(ctx);
}

/** Thử token Cloudflare bằng cách đọc danh sách phiên bản của Worker web. */
export async function testRelease(ctx: Ctx) {
  requireSuperAdmin(ctx);
  if (!ctx.env.CF_RELEASE_API_TOKEN || !ctx.env.CF_RELEASE_ACCOUNT_ID) return { ok: false, message: 'Chưa có token hoặc Account ID.' };
  try {
    const s = await listReleases(ctx);
    return { ok: true, message: `Kết nối được: Worker ${s.script} có ${s.versions.length} bản gần đây.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : String(err) };
  }
}
