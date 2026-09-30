// Một bộ secret cho hai Worker: hoiminh-api giữ secret, hoiminh-jobs đọc lại qua service binding
// (kênh nội bộ Cloudflare, không đi qua Internet), nên chỉ phải đặt và đổi secret ở một chỗ.
import { envSchema } from '@hoiminh/config';

/** Không chia sẻ: token phát hành web chỉ hoiminh-api dùng (nút Cập nhật). */
const NOT_SHARED = new Set(['CF_RELEASE_API_TOKEN', 'CF_RELEASE_ACCOUNT_ID', 'CF_RELEASE_WEB_SCRIPT']);
const SHARED_KEYS = Object.keys(envSchema.shape).filter((k) => !NOT_SHARED.has(k));

/** Phía hoiminh-api: chỉ các biến có trong schema, dạng chuỗi, khác rỗng. Binding (Hyperdrive, R2...) không đi kèm. */
export function pickSharedEnv(env: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of SHARED_KEYS) {
    const v = env[k];
    if (typeof v === 'string' && v !== '') out[k] = v;
  }
  return out;
}

/** Phía hoiminh-jobs: giá trị của chính Worker (vars trong wrangler.toml, secret riêng nếu có) luôn thắng, còn thiếu mới lấy từ hoiminh-api. */
export function mergeSharedEnv<T extends Record<string, unknown>>(own: T, shared: Record<string, string>): T {
  const out: Record<string, unknown> = { ...own };
  for (const [k, v] of Object.entries(shared)) {
    const mine = own[k];
    if (typeof mine !== 'string' || mine === '') out[k] = v;
  }
  return out as T;
}

/** Service binding tới entrypoint SharedEnv của hoiminh-api (apps/api/src/worker.ts). */
export interface SharedEnvSource {
  strings(): Promise<Record<string, string>>;
}

// Secret đổi rất hiếm; cache theo isolate để các lần cron và batch Queue liên tiếp không phải hỏi hoiminh-api.
const CACHE_MS = 5 * 60_000;
let cache: { at: number; values: Record<string, string> } | null = null;

/**
 * Bổ sung secret còn thiếu của hoiminh-jobs từ hoiminh-api. Không có binding (máy dev) thì dùng env như cũ.
 * Hỏi lỗi mà còn bản cache cũ thì dùng tạm bản cũ; chưa từng có thì chạy bằng env riêng và để loadEnv báo thiếu.
 */
export async function withSharedEnv<T extends Record<string, unknown>>(env: T, source: SharedEnvSource | undefined, now = Date.now()): Promise<T> {
  if (!source) return env;
  if (!cache || now - cache.at > CACHE_MS) {
    try {
      cache = { at: now, values: await source.strings() };
    } catch (err) {
      console.error('shared_env.fetch_failed', String(err));
      if (!cache) return env;
    }
  }
  return mergeSharedEnv(env, cache.values);
}

/** Chỉ dùng trong test. */
export function resetSharedEnvCache(): void {
  cache = null;
}
