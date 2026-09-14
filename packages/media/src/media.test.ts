import { describe, expect, it } from 'vitest';
import { LocalMediaProvider, createMediaProvider, validateUpload } from './index';

describe('media', () => {
  it('local provider ký và xác minh URL', async () => {
    const p = new LocalMediaProvider('http://localhost:8787', 'secret');
    const up = await p.presignUpload('img/a.png', 'image/png');
    const u = new URL(up.url);
    expect(await p.verify('img/a.png', u.searchParams.get('expires')!, u.searchParams.get('sig')!)).toBe(true);
    expect(await p.verify('img/b.png', u.searchParams.get('expires')!, u.searchParams.get('sig')!)).toBe(false);
  });
  it('chọn local khi thiếu cấu hình R2', () => {
    expect(createMediaProvider({ r2: {}, apiUrl: 'http://x', secret: 's' }).kind).toBe('local');
  });
  it('validate loại tệp', () => {
    expect(validateUpload('image/png', 100).ok).toBe(true);
    expect(validateUpload('video/mp4', 100).ok).toBe(false);
  });
});
