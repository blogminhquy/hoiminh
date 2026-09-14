// Tiện ích Markdown phía server: trích đoạn, đếm ký tự thuần, tìm @mention, kiểm tra điều kiện nền màu.
import { BUSINESS } from '@hoiminh/config';

/** Bỏ ký hiệu Markdown để lấy văn bản thuần. */
export function plainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Trích đoạn ngắn cho thẻ bài viết. */
export function excerptOf(md: string, max = 220): string {
  const t = plainText(md);
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

/** Tìm @handle trong nội dung. */
export function mentions(md: string): string[] {
  return [...new Set([...md.matchAll(/(^|\s)@([a-z0-9][a-z0-9-]{2,31})/g)].map((m) => m[2]!))];
}

/** Status ngắn: dưới 130 ký tự, không ảnh, không tiêu đề thì được dùng nền màu. */
export function canUseStatusBg(md: string, imageCount: number, title: string): boolean {
  return imageCount === 0 && !title.trim() && !/!\[/.test(md) && plainText(md).length <= BUSINESS.statusMaxChars;
}

/** Ảnh trong bài (markdown image URL). */
export function imageUrls(md: string): string[] {
  return [...md.matchAll(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g)].map((m) => m[1]!);
}
