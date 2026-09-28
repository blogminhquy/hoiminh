// Khóa hạ tầng nhập ở Hệ thống · Hạ tầng (email Resend, phát hành web qua Cloudflare).
//
// Lưu mã hóa trong provider_accounts (provider = infra_email / infra_release, như credential cổng thanh
// toán) nên không cần migration. Giá trị đã lưu được ưu tiên hơn secret của Worker; ô nào chưa lưu thì
// vẫn dùng secret như trước. Không cho sửa DATABASE_URL, AUTH_JWT_SECRET, ENCRYPTION_KEY ở đây: sai một
// trong ba thì chính trang này cũng không mở được để sửa lại.
import { decryptJson, type Env } from '@hoiminh/config';
import { providerAccounts, type Database, type DbExecutor } from '@hoiminh/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Logger } from '../context';

export type InfraSection = 'email' | 'release';

export interface InfraField {
  env: keyof Env;
  /** Bí mật: không bao giờ trả lại giá trị, chỉ 4 ký tự cuối. */
  secret: boolean;
}

export const INFRA_FIELDS: Record<InfraSection, Record<string, InfraField>> = {
  email: {
    apiKey: { env: 'RESEND_API_KEY', secret: true },
    from: { env: 'EMAIL_FROM', secret: false },
  },
  release: {
    apiToken: { env: 'CF_RELEASE_API_TOKEN', secret: true },
    accountId: { env: 'CF_RELEASE_ACCOUNT_ID', secret: false },
    webScript: { env: 'CF_RELEASE_WEB_SCRIPT', secret: false },
  },
};

export const INFRA_PROVIDER: Record<InfraSection, string> = { email: 'infra_email', release: 'infra_release' };
const SECTION_OF = Object.fromEntries(Object.entries(INFRA_PROVIDER).map(([s, p]) => [p, s as InfraSection])) as Record<string, InfraSection>;

export type InfraValues = Partial<Record<InfraSection, Record<string, string>>>;

export interface StoredInfra {
  values: InfraValues;
  updatedAt: Partial<Record<InfraSection, Date>>;
}

/** Đọc và giải mã các khóa đã lưu. Dòng không giải mã được (đổi ENCRYPTION_KEY) thì bỏ qua và ghi log. */
export async function readInfra(db: DbExecutor, env: Env, log?: Logger): Promise<StoredInfra> {
  const rows = await db.query.providerAccounts.findMany({ where: and(eq(providerAccounts.scopeType, 'platform'), inArray(providerAccounts.provider, Object.values(INFRA_PROVIDER))) });
  const out: StoredInfra = { values: {}, updatedAt: {} };
  for (const row of rows) {
    const section = SECTION_OF[row.provider];
    if (!section || !row.credentialsEncrypted) continue;
    try {
      out.values[section] = await decryptJson<Record<string, string>>(row.credentialsEncrypted, env.ENCRYPTION_KEY);
      out.updatedAt[section] = row.updatedAt;
    } catch (err) {
      log?.error('infra.settings_unreadable', { section, err: String(err) });
    }
  }
  return out;
}

/** Env thật sự dùng: mỗi khóa hạ tầng lấy giá trị đã lưu nếu có, không thì giá trị gốc (secret của Worker). */
export function mergeInfraEnv(base: Env, values: InfraValues): Env {
  const merged: Record<string, unknown> = { ...base };
  for (const [section, fields] of Object.entries(INFRA_FIELDS) as [InfraSection, Record<string, InfraField>][]) {
    for (const [name, f] of Object.entries(fields)) {
      const v = values[section]?.[name]?.trim();
      merged[f.env] = v || base[f.env];
    }
  }
  return merged as Env;
}

// Worker dựng App mới cho mỗi request, nên giữ bản đã giải mã trong isolate một lúc thay vì đọc DB mỗi
// lần. Lưu ở trang Hạ tầng thì xóa cache của isolate đó; isolate khác nhận giá trị mới trong CACHE_MS.
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; stored: StoredInfra }>();

export function invalidateInfraCache(): void {
  cache.clear();
}

/**
 * Khóa đã lưu, dùng khi khởi tạo App. Đọc trong transaction có `app.bypass = on` để vẫn chạy khi đã bật
 * FORCE ROW LEVEL SECURITY. Lỗi thì trả rỗng: thiếu khóa đã lưu vẫn tốt hơn API không khởi động được.
 */
export async function loadInfra(db: Database, env: Env, log: Logger): Promise<StoredInfra> {
  // PGlite (dev, test) mỗi App một database riêng, không cache để test này không thấy khóa của test khác.
  const key = env.DATABASE_URL.startsWith('pglite') ? null : env.DATABASE_URL;
  const hit = key ? cache.get(key) : undefined;
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.stored;
  try {
    const stored = await db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.bypass', 'on', true)`);
      return readInfra(tx, env, log);
    });
    if (key) cache.set(key, { at: Date.now(), stored });
    return stored;
  } catch (err) {
    log.error('infra.settings_load_failed', { err: String(err) });
    return { values: {}, updatedAt: {} };
  }
}

/** 4 ký tự cuối của bí mật, đủ để nhận ra key nào đang dùng. */
export function secretHint(value: string): string | null {
  const v = value.trim();
  return v ? `••••${v.slice(-4)}` : null;
}
