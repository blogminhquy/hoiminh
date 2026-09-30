// hoiminh-jobs đọc secret của hoiminh-api qua service binding: chỉ chia sẻ biến cấu hình dạng chuỗi,
// giá trị riêng của jobs luôn thắng, hỏi lỗi thì dùng bản cache hoặc env riêng.
import { afterEach, describe, expect, it } from 'vitest';
import { mergeSharedEnv, pickSharedEnv, resetSharedEnvCache, withSharedEnv, type SharedEnvSource } from '../shared-env';

afterEach(() => resetSharedEnvCache());

describe('pickSharedEnv (phía hoiminh-api)', () => {
  it('chỉ lấy biến có trong schema, dạng chuỗi, khác rỗng; bỏ binding và token phát hành', () => {
    const out = pickSharedEnv({
      AUTH_JWT_SECRET: 'jwt-secret-that-is-long-enough-123456',
      ENCRYPTION_KEY: 'a2V5',
      RESEND_API_KEY: '',
      CF_RELEASE_API_TOKEN: 'cf-token',
      CF_RELEASE_ACCOUNT_ID: 'acc',
      KHONG_CO_TRONG_SCHEMA: 'x',
      HYPERDRIVE: { connectionString: 'postgres://x' },
      JOBS: { send: () => undefined },
    });
    expect(out).toEqual({ AUTH_JWT_SECRET: 'jwt-secret-that-is-long-enough-123456', ENCRYPTION_KEY: 'a2V5' });
  });
});

describe('mergeSharedEnv (phía hoiminh-jobs)', () => {
  it('giá trị riêng của jobs thắng, thiếu hoặc rỗng mới lấy từ hoiminh-api, binding giữ nguyên', () => {
    const jobs = { APP_ENV: 'production', ENCRYPTION_KEY: '', JOBS: { send: () => undefined } };
    const out = mergeSharedEnv(jobs, { APP_ENV: 'staging', ENCRYPTION_KEY: 'a2V5', AUTH_JWT_SECRET: 's' });
    expect(out.APP_ENV).toBe('production');
    expect(out.ENCRYPTION_KEY).toBe('a2V5');
    expect((out as Record<string, unknown>).AUTH_JWT_SECRET).toBe('s');
    expect(out.JOBS).toBe(jobs.JOBS);
  });
});

describe('withSharedEnv', () => {
  const source = (values: Record<string, string> | Error) => {
    let calls = 0;
    const s: SharedEnvSource & { calls: () => number } = {
      strings: async () => {
        calls++;
        if (values instanceof Error) throw values;
        return values;
      },
      calls: () => calls,
    };
    return s;
  };

  it('không có binding (máy dev) thì trả env như cũ', async () => {
    const env = { A: '1' };
    expect(await withSharedEnv(env, undefined)).toBe(env);
  });

  it('cache 5 phút: các lần chạy liên tiếp không hỏi lại hoiminh-api', async () => {
    const s = source({ ENCRYPTION_KEY: 'k1' });
    const t = 1_000_000;
    expect((await withSharedEnv<Record<string, unknown>>({}, s, t)).ENCRYPTION_KEY).toBe('k1');
    await withSharedEnv({}, s, t + 60_000);
    expect(s.calls()).toBe(1);
    await withSharedEnv({}, s, t + 5 * 60_000 + 1);
    expect(s.calls()).toBe(2);
  });

  it('hỏi lỗi: còn cache thì dùng bản cũ, chưa có thì chạy bằng env riêng', async () => {
    const t = 2_000_000;
    expect(await withSharedEnv({ A: '1' }, source(new Error('down')), t)).toEqual({ A: '1' });
    await withSharedEnv({}, source({ ENCRYPTION_KEY: 'k1' }), t);
    const out = await withSharedEnv<Record<string, unknown>>({}, source(new Error('down')), t + 10 * 60_000);
    expect(out.ENCRYPTION_KEY).toBe('k1');
  });
});
