// Xác minh access token ở mỗi request: phiên và người dùng lấy trong một câu truy vấn (xem auth/service.ts).
import { eq } from 'drizzle-orm';
import { users } from '@hoiminh/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as auth from '../auth/service';
import { signAccessToken } from '../auth/tokens';
import { createTestApp, type TestApp } from './setup';

let app: TestApp;
beforeAll(async () => {
  app = await createTestApp();
}, 180_000);
afterAll(async () => {
  await app.close();
});

const SECRET = 'test-secret-test-secret-test-secret';
const login = async (email: string) => {
  const r = await auth.login(app.anon(), app.auth, { email, password: 'hoiminh123', remember: true });
  if (!('accessToken' in r)) throw new Error('tài khoản mẫu không bật xác thực hai lớp');
  return r;
};

describe('authenticate', () => {
  it('token hợp lệ trả về đúng người dùng và phiên', async () => {
    const s = await login('congtran@gmail.com');
    const got = await auth.authenticate(app.anon(), app.auth, s.accessToken);
    expect(got?.userId).toBe(await app.ids('user:cong'));
    expect(got?.user.email).toBe('congtran@gmail.com');
    expect(got?.sessionId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('token sai chữ ký hoặc rác thì từ chối, không hỏi database', async () => {
    expect(await auth.authenticate(app.anon(), app.auth, 'khong-phai-token')).toBeNull();
    const forged = await signAccessToken('bi-mat-khac-bi-mat-khac-bi-mat-khac', { sub: await app.ids('user:cong'), email: 'congtran@gmail.com', sid: '00000000-0000-4000-8000-000000000000', sa: false }, 60);
    expect(await auth.authenticate(app.anon(), app.auth, forged.token)).toBeNull();
  });

  it('phiên đã đăng xuất thì token cũ bị từ chối, phiên khác của cùng người vẫn dùng được', async () => {
    const first = await login('duynguyen@gmail.com');
    const second = await login('duynguyen@gmail.com');
    const a = await auth.authenticate(app.anon(), app.auth, first.accessToken);
    await auth.logout(app.anon(), a!.sessionId);
    expect(await auth.authenticate(app.anon(), app.auth, first.accessToken)).toBeNull();
    expect((await auth.authenticate(app.anon(), app.auth, second.accessToken))?.userId).toBe(a!.userId);
  });

  it('phiên không tồn tại thì từ chối dù người dùng có thật', async () => {
    const ghost = await signAccessToken(SECRET, { sub: await app.ids('user:cong'), email: 'congtran@gmail.com', sid: '00000000-0000-4000-8000-000000000000', sa: false }, 60);
    expect(await auth.authenticate(app.anon(), app.auth, ghost.token)).toBeNull();
  });

  it('tài khoản bị tạm khóa thì token còn hạn cũng bị từ chối', async () => {
    const s = await login('kienbui@gmail.com');
    expect(await auth.authenticate(app.anon(), app.auth, s.accessToken)).not.toBeNull();
    await app.ctx.db.update(users).set({ status: 'suspended' }).where(eq(users.email, 'kienbui@gmail.com'));
    expect(await auth.authenticate(app.anon(), app.auth, s.accessToken)).toBeNull();
  });
});
