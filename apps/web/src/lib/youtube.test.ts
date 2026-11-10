import { describe, expect, it } from 'vitest';
import { YT_PLAYER_VARS, formatClock, isVerticalVideoUrl, nearEnd, qualityLabel, qualityOptions, speedLabel, speedOptions, youtubeErrorMessage, youtubePoster } from './youtube';

describe('trình phát YouTube của bài học', () => {
  it('tắt điều khiển, phím tắt, toàn màn hình của YouTube và không gợi ý video kênh khác', () => {
    expect(YT_PLAYER_VARS).toMatchObject({ controls: 0, disablekb: 1, fs: 0, rel: 0, playsinline: 1 });
  });

  it('đồng hồ: phút:giây, có giờ khi video dài hơn một giờ', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(75.9)).toBe('1:15');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(-3)).toBe('0:00');
  });

  it('mục Tốc độ: 0,75x tới 2x, chỉ lấy tốc độ video cho phép, luôn có tốc độ đang phát', () => {
    expect(speedOptions([0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2])).toEqual([0.75, 1, 1.25, 1.5, 2]);
    expect(speedOptions([1, 2])).toEqual([1, 2]);
    expect(speedOptions([], 1)).toEqual([0.75, 1, 1.25, 1.5, 2]);
    expect(speedOptions([0.75, 1, 1.25, 1.5, 1.75, 2], 1.75)).toEqual([0.75, 1, 1.25, 1.5, 1.75, 2]);
    expect(speedLabel(1.25)).toBe('1,25x');
    expect(speedLabel(1)).toBe('1x');
  });

  it('mục Chất lượng: đổi mã của YouTube thành số dòng quen thuộc', () => {
    expect(qualityLabel('hd1080')).toBe('1080p');
    expect(qualityLabel('hd720')).toBe('720p');
    expect(qualityLabel('large')).toBe('480p');
    expect(qualityLabel('medium')).toBe('360p');
    expect(qualityLabel('auto')).toBe('Tự động');
    expect(qualityLabel('')).toBe('Tự động');
    expect(qualityLabel('hd4320')).toBe('hd4320');
  });

  it('mục Chất lượng: "Tự động" đứng đầu, giữ thứ tự cao xuống thấp, không lặp', () => {
    expect(qualityOptions(['hd1080', 'hd720', 'large', 'medium', 'auto'])).toEqual(['auto', 'hd1080', 'hd720', 'large', 'medium']);
    expect(qualityOptions(['hd720', 'hd720', 'unknown'])).toEqual(['auto', 'hd720']);
    expect(qualityOptions([])).toEqual(['auto']);
  });

  it('dừng ngay trước giây cuối để YouTube không bật màn hình gợi ý', () => {
    expect(nearEnd(590, 600)).toBe(false);
    expect(nearEnd(599.5, 600)).toBe(true);
    // Phát nhanh gấp đôi thì mỗi lượt đọc cách nhau nhiều giây video hơn, nên dừng sớm hơn.
    expect(nearEnd(599.1, 600, 1)).toBe(false);
    expect(nearEnd(599.1, 600, 2)).toBe(true);
  });

  it('buổi phát trực tiếp (chưa có thời lượng) không bị coi là sắp hết', () => {
    expect(nearEnd(0, 0)).toBe(false);
    expect(nearEnd(120, 0, 2)).toBe(false);
  });

  it('link /shorts/ là video dọc', () => {
    expect(isVerticalVideoUrl('https://www.youtube.com/shorts/abcdefghijk')).toBe(true);
    expect(isVerticalVideoUrl('https://www.youtube.com/watch?v=abcdefghijk')).toBe(false);
    expect(isVerticalVideoUrl(null)).toBe(false);
  });

  it('ảnh bìa lấy từ máy chủ ảnh của YouTube theo mã video', () => {
    expect(youtubePoster('dQw4w9WgXcQ')).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
  });

  it('lời báo lỗi theo mã của YouTube', () => {
    expect(youtubeErrorMessage(100)).toMatch(/riêng tư/);
    expect(youtubeErrorMessage(150)).toMatch(/chưa cho phép/);
    expect(youtubeErrorMessage(5)).toBe('Không phát được video này.');
  });
});
