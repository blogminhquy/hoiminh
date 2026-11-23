import { describe, expect, it } from 'vitest';
import { QUALITY_AUTO, YT_PLAYER_VARS, formatClock, frameScale, isMissingYoutubeThumb, isVerticalVideoUrl, learnGain, nearEnd, qualityHeight, qualityLabel, qualityOptions, qualityTarget, speedLabel, speedOptions, youtubeErrorMessage, youtubePoster, youtubePosterCandidates } from './youtube';

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

  it('mục Chất lượng: bỏ mức trên 4K và mức lạ, vì trang không xin được các mức đó', () => {
    expect(qualityOptions(['highres', 'hd2880', 'hd2160', 'hd1440', 'hd1080', 'hd4320'])).toEqual(['auto', 'hd2160', 'hd1440', 'hd1080']);
    expect(qualityHeight('hd1080')).toBe(1080);
    expect(qualityHeight('tiny')).toBe(144);
    expect(qualityHeight(QUALITY_AUTO)).toBe(0);
  });

  it('mức muốn phát tới: chọn tay là đúng mức đó; "Tự động" theo điểm ảnh thật của vùng video, thấp nhất 720p, cao nhất 4K', () => {
    expect(qualityTarget('hd1080', 340, 1)).toBe(1080);
    expect(qualityTarget('medium', 1080, 2)).toBe(360);
    // Laptop: video cao 340px. YouTube tự chọn thì chỉ 360p; "Tự động" của trang cho tới 720p.
    expect(qualityTarget(QUALITY_AUTO, 340, 1)).toBe(720);
    // Điện thoại: video cao 211px, mật độ điểm ảnh 3 (633 điểm ảnh thật) vẫn được 720p.
    expect(qualityTarget(QUALITY_AUTO, 211, 3)).toBe(720);
    // Toàn màn hình 1080px trên màn hình mật độ 2: 2160 điểm ảnh thật.
    expect(qualityTarget(QUALITY_AUTO, 1080, 2)).toBe(2160);
    expect(qualityTarget(QUALITY_AUTO, 2000, 2)).toBe(2160);
    expect(qualityTarget('highres', 500, 1)).toBe(2160);
  });

  it('cỡ khung YouTube: phóng để YouTube thấy khung đúng cỡ của mức muốn có, dư 2% cho làm tròn', () => {
    // Trình phát cao 340px, chọn 1080p: khung YouTube dựng cao 1101px rồi thu về 340px.
    expect(340 * frameScale(1080, 340)).toBeCloseTo(1101.6, 1);
    // "Tự động" không bao giờ thu khung nhỏ hơn cỡ đang hiện.
    expect(frameScale(720, 1080)).toBe(1);
    // Chọn tay 360p ở toàn màn hình: dựng khung nhỏ rồi phóng lên, YouTube chỉ thấy khung 367px.
    expect(1080 * frameScale(360, 1080, 1, true)).toBeCloseTo(367.2, 1);
    // YouTube đã nhân cỡ khung với mật độ điểm ảnh 2: khung chỉ cần một nửa.
    expect(340 * frameScale(1080, 340, 2)).toBeCloseTo(550.8, 1);
    // Chưa đo được trình phát: giữ nguyên cỡ.
    expect(frameScale(1080, 0)).toBe(1);
  });

  it('học hệ số: YouTube phát vượt cả khung lớn nhất trang đưa thì tính theo điểm ảnh thật', () => {
    const levels = ['hd1080', 'hd720', 'large', 'medium', 'small', 'tiny'];
    // Khung 734px mà YouTube phát 1080p trên màn hình mật độ 2: YouTube đã nhân cỡ khung lên 2 lần.
    expect(learnGain(1, 'hd1080', 734, levels, 2)).toBe(2);
    // Phát trong cỡ khung: không kết luận gì.
    expect(learnGain(1, 'hd720', 734, levels, 2)).toBe(1);
    // Màn hình mật độ 1: không có gì để học.
    expect(learnGain(1, 'hd1080', 734, levels, 1)).toBe(1);
    // Video không có mức nào vừa khung: YouTube buộc phải phát mức thấp nhất nó có, không phải bằng chứng.
    expect(learnGain(1, 'hd1080', 734, ['hd1080'], 2)).toBe(1);
    // Khung quá nhỏ hoặc mức vượt dưới 720p: chưa đủ chắc để kết luận.
    expect(learnGain(1, 'hd720', 245, levels, 3)).toBe(1);
    expect(learnGain(1, 'large', 367, levels, 3)).toBe(1);
    // Đã học rồi thì giữ nguyên.
    expect(learnGain(2, 'hd1080', 400, levels, 2)).toBe(2);
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

  it('ảnh bìa ở khung phát thử bản nét nhất trước, lùi dần về bản luôn có', () => {
    expect(youtubePosterCandidates('dQw4w9WgXcQ')).toEqual([
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/sddefault.jpg',
      'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
    ]);
  });

  it('ảnh xám 120x90 của YouTube là "không có bản này"', () => {
    expect(isMissingYoutubeThumb(120)).toBe(true);
    expect(isMissingYoutubeThumb(1280)).toBe(false);
    expect(isMissingYoutubeThumb(480)).toBe(false);
    expect(isMissingYoutubeThumb(0)).toBe(false);
  });

  it('lời báo lỗi theo mã của YouTube', () => {
    expect(youtubeErrorMessage(100)).toMatch(/riêng tư/);
    expect(youtubeErrorMessage(150)).toMatch(/chưa cho phép/);
    expect(youtubeErrorMessage(5)).toBe('Không phát được video này.');
  });
});
