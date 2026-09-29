import { describe, expect, it } from 'vitest';
import { SINGLE_PHOTO_MAX_HEIGHT, singlePhotoBox } from './photo-layout';

describe('singlePhotoBox', () => {
  it('ảnh vuông: 360×360, không bị kéo thành dải rộng', () => {
    expect(SINGLE_PHOTO_MAX_HEIGHT).toBe(360);
    expect(singlePhotoBox({ width: 1254, height: 1254 }, 360)).toEqual({ width: 'min(100%, 360px)', aspectRatio: '1' });
  });

  it('ảnh ngang 16:9: rộng tối đa theo chiều cao, không vượt thẻ', () => {
    expect(singlePhotoBox({ width: 1920, height: 1080 }, 360)).toEqual({ width: 'min(100%, 640px)', aspectRatio: '1.7778' });
  });

  it('ảnh dọc 3:4: hẹp lại thay vì cao vọt lên', () => {
    expect(singlePhotoBox({ width: 900, height: 1200 }, 360)).toEqual({ width: 'min(100%, 270px)', aspectRatio: '0.75' });
  });

  it('bản thu gọn dùng chiều cao nhỏ hơn', () => {
    expect(singlePhotoBox({ width: 1000, height: 1000 }, 216)).toEqual({ width: 'min(100%, 216px)', aspectRatio: '1' });
  });

  it('chưa biết kích thước ảnh (dữ liệu cũ) thì dùng 4:3', () => {
    const expected = { width: 'min(100%, 480px)', aspectRatio: '1.3333' };
    expect(singlePhotoBox({}, 360)).toEqual(expected);
    expect(singlePhotoBox({ width: null, height: null }, 360)).toEqual(expected);
    expect(singlePhotoBox({ width: 800, height: null }, 360)).toEqual(expected);
  });
});
