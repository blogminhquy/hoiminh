// Lấy tên, mô tả, thời lượng video YouTube: đọc đúng từ oEmbed và trang xem, YouTube lỗi thì vẫn trả kết quả an toàn.
import { describe, expect, it, vi } from 'vitest';
import { descriptionToMarkdown, fetchVideoMeta, parseYoutubePage } from './video-meta';

const ID = 'q1sMd3Pk90U';
const DESCRIPTION = 'Dòng một "có nháy kép"\nDòng hai: https://hoiminh.com\n\n00:00 Mở đầu\n05:30 Kết nối công cụ';

/** Trang xem video rút gọn: videoDetails của video đang xem đứng sau một khối dữ liệu của video khác. */
function watchPage(id = ID): string {
  const other = { videoId: 'zzzzzzzzzzz', title: 'Video gợi ý', lengthSeconds: '9', shortDescription: 'không phải mô tả này' };
  const details = { videoId: id, title: 'Javis Agent: bài 1 "giao việc"', lengthSeconds: '754', keywords: ['ai', 'agent'], channelId: 'UC123', shortDescription: DESCRIPTION, isCrawlable: true };
  return `<html><head><meta name="title" content="Tên từ thẻ meta"></head><body><script>var ytInitialData = {"related":${JSON.stringify(other)}};</script><script>var ytInitialPlayerResponse = {"playabilityStatus":{"status":"OK"},"videoDetails":${JSON.stringify(details)}};</script></body></html>`;
}

function fakeYoutube(opts: { oembed?: Response | Error; page?: Response | Error } = {}) {
  return vi.fn(async (url: string) => {
    const hit = url.includes('/oembed') ? opts.oembed ?? new Response(JSON.stringify({ title: '  Javis Agent:   bài 1  ', author_name: 'Minh Quý' })) : opts.page ?? new Response(watchPage());
    if (hit instanceof Error) throw hit;
    return hit;
  });
}

describe('fetchVideoMeta', () => {
  it('YouTube: tên từ oEmbed, mô tả và thời lượng từ trang xem', async () => {
    const fetchMock = fakeYoutube();
    const r = await fetchVideoMeta(`https://youtu.be/${ID}?si=abc`, { fetch: fetchMock });
    expect(r.embed?.externalId).toBe(ID);
    expect(r.meta).toEqual({ title: 'Javis Agent: bài 1', description: DESCRIPTION, durationSeconds: 754 });
    // Chỉ gọi youtube.com, với id đã nhận diện chứ không dùng nguyên link người dùng dán.
    const urls = fetchMock.mock.calls.map((c) => c[0]);
    expect(urls).toHaveLength(2);
    expect(urls.every((u) => u.startsWith('https://www.youtube.com/'))).toBe(true);
    expect(urls.some((u) => u === `https://www.youtube.com/watch?v=${ID}`)).toBe(true);
  });
  it('trang xem lỗi → vẫn có tên, mô tả trống', async () => {
    const r = await fetchVideoMeta(`https://www.youtube.com/watch?v=${ID}`, { fetch: fakeYoutube({ page: new Error('bị chặn') }) });
    expect(r.meta).toEqual({ title: 'Javis Agent: bài 1', description: '', durationSeconds: null });
  });
  it('oEmbed lỗi → lấy tên từ trang xem', async () => {
    const r = await fetchVideoMeta(`https://www.youtube.com/watch?v=${ID}`, { fetch: fakeYoutube({ oembed: new Response('Unauthorized', { status: 401 }) }) });
    expect(r.meta?.title).toBe('Javis Agent: bài 1 "giao việc"');
    expect(r.meta?.durationSeconds).toBe(754);
  });
  it('cả hai lỗi → meta null, vẫn nhận diện được link', async () => {
    const r = await fetchVideoMeta(`https://www.youtube.com/watch?v=${ID}`, { fetch: fakeYoutube({ oembed: new Response('', { status: 404 }), page: new Response('', { status: 429 }) }) });
    expect(r.embed?.provider).toBe('youtube');
    expect(r.meta).toBeNull();
  });
  it('không phải YouTube hoặc link lạ → không gọi ra ngoài', async () => {
    const fetchMock = fakeYoutube();
    expect(await fetchVideoMeta('https://vimeo.com/123456789', { fetch: fetchMock })).toMatchObject({ embed: { provider: 'vimeo' }, meta: null });
    expect(await fetchVideoMeta('https://example.com/watch?v=abc', { fetch: fetchMock })).toEqual({ embed: null, meta: null });
    expect(await fetchVideoMeta('không phải link', { fetch: fetchMock })).toEqual({ embed: null, meta: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('trang xem bị chuyển sang trang kiểm tra robot → không đi theo, vẫn có tên', async () => {
    const fetchMock = fakeYoutube({ page: new Response(null, { status: 302, headers: { Location: 'https://www.google.com/sorry/index' } }) });
    const r = await fetchVideoMeta(`https://youtu.be/${ID}`, { fetch: fetchMock });
    expect(r.meta).toEqual({ title: 'Javis Agent: bài 1', description: '', durationSeconds: null });
    const pageCall = fetchMock.mock.calls.find((c) => String(c[0]).includes('/watch')) as unknown as [string, RequestInit];
    expect(pageCall[1].redirect).toBe('manual');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('có API key: một lượt gọi YouTube Data API, key nằm trong header chứ không trong URL', async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify({ items: [{ snippet: { title: ' Tên từ API ', description: 'Mô tả từ API\r\nDòng 2' }, contentDetails: { duration: 'PT1H2M3S' } }] })));
    const r = await fetchVideoMeta(`https://youtu.be/${ID}`, { fetch: fetchMock, apiKey: 'khoa-bi-mat' });
    expect(r.meta).toEqual({ title: 'Tên từ API', description: 'Mô tả từ API\nDòng 2', durationSeconds: 3723 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${ID}`);
    expect(url).not.toContain('khoa-bi-mat');
    expect((init?.headers as Record<string, string>)['X-Goog-Api-Key']).toBe('khoa-bi-mat');
  });
  it('API key sai hoặc hết hạn mức → cảnh báo rồi lấy theo cách không cần key', async () => {
    const base = fakeYoutube();
    const warn = vi.fn();
    const fetchMock = vi.fn(async (url: string) => (url.includes('googleapis.com') ? new Response('{"error":{"code":403}}', { status: 403 }) : base(url)));
    const r = await fetchVideoMeta(`https://youtu.be/${ID}`, { fetch: fetchMock, apiKey: 'sai', warn });
    expect(r.meta).toEqual({ title: 'Javis Agent: bài 1', description: DESCRIPTION, durationSeconds: 754 });
    expect(warn).toHaveBeenCalledWith('video_meta.youtube_api_failed', { error: 'HTTP 403' });
  });
  it('API không thấy video (riêng tư, đã xóa) → thử cách không cần key, không cảnh báo', async () => {
    const warn = vi.fn();
    const fetchMock = vi.fn(async (url: string) => (url.includes('googleapis.com') ? new Response('{"items":[]}') : new Response('', { status: 404 })));
    const r = await fetchVideoMeta(`https://youtu.be/${ID}`, { fetch: fetchMock, apiKey: 'k', warn });
    expect(r.meta).toBeNull();
    expect(warn).not.toHaveBeenCalled();
  });
  it('tên quá dài bị cắt còn 160 ký tự', async () => {
    const r = await fetchVideoMeta(`https://youtu.be/${ID}`, { fetch: fakeYoutube({ oembed: new Response(JSON.stringify({ title: 'a'.repeat(300) })) }) });
    expect(r.meta?.title).toHaveLength(160);
  });
});

describe('parseYoutubePage', () => {
  it('chỉ đọc videoDetails của đúng video đang xem', () => {
    expect(parseYoutubePage(watchPage(), ID)).toEqual({ title: 'Javis Agent: bài 1 "giao việc"', description: DESCRIPTION, durationSeconds: 754 });
  });
  it('không có videoDetails → đọc thẻ meta và attributedDescription', () => {
    const html = `<meta name="title" content="Tom &amp; Jerry &#39;2026&#39;"><meta itemprop="duration" content="PT1H2M3S"><script>var ytInitialData = {"attributedDescription":{"content":"Mô tả đầy đủ\\nDòng 2","commandRuns":[]}};</script>`;
    expect(parseYoutubePage(html, ID)).toEqual({ title: "Tom & Jerry '2026'", description: 'Mô tả đầy đủ\nDòng 2', durationSeconds: 3723 });
  });
  it('trang không có gì dùng được → toàn null', () => {
    expect(parseYoutubePage('<html><body>Sign in to confirm you are not a bot</body></html>', ID)).toEqual({ title: null, description: null, durationSeconds: null });
  });
  it('phát trực tiếp (lengthSeconds 0) → không có thời lượng', () => {
    const html = `{"videoDetails":{"videoId":"${ID}","title":"Live","lengthSeconds":"0","shortDescription":""}}`;
    expect(parseYoutubePage(html, ID)).toEqual({ title: 'Live', description: '', durationSeconds: null });
  });
});

describe('descriptionToMarkdown', () => {
  it('tách dòng kẻ khỏi dòng chữ phía trên, gộp dòng trống thừa', () => {
    expect(descriptionToMarkdown('Liên hệ\r\n-----\nZalo: 0900\n\n\n\n===\n#ai #agent  ')).toBe('Liên hệ\n\n-----\nZalo: 0900\n\n===\n#ai #agent');
  });
  it('mô tả trống → chuỗi rỗng', () => {
    expect(descriptionToMarkdown('  \n ')).toBe('');
  });
});
