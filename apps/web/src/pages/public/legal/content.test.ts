// Kiểm chữ của hai trang pháp lý: đủ phần bắt buộc, neo không trùng, link trỏ tới trang có thật,
// không có gạch ngang dài và không sót chữ giữ chỗ.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { legalContact } from './contact';
import { parseInline } from './inline';
import { PRIVACY } from './privacy';
import { TERMS } from './terms';
import type { LegalDoc } from './types';

const DOCS: LegalDoc[] = [TERMS, PRIVACY];
// Các ký tự gạch ngang dài (U+2012 tới U+2015), ghi bằng mã để chính tệp này cũng không chứa ký tự đó.
const LONG_DASH = new RegExp(`[${String.fromCharCode(0x2012, 0x2013, 0x2014, 0x2015)}]`);
const ROUTER = readFileSync(fileURLToPath(new URL('../../../app/router.tsx', import.meta.url)), 'utf8');

/** Mọi chuỗi chữ của một trang, gồm cả mục Liên hệ (ở cả hai trạng thái: chưa có và đã có email hỗ trợ). */
function textsOf(doc: LegalDoc): string[] {
  const out = [doc.title, doc.updatedAt, ...doc.intro];
  for (const s of doc.sections) {
    out.push(s.title);
    for (const b of s.blocks) {
      if (b.type === 'list') out.push(...b.items);
      else if (b.type === 'contact') for (const c of [legalContact(null), legalContact('hotro@example.com')]) out.push(c.lead, ...c.items);
      else out.push(b.text);
    }
  }
  return out;
}

describe('parseInline', () => {
  it('tách chữ thường, chữ đậm và link', () => {
    expect(parseInline('Xem **kỹ** ở [Bảng giá](/tao-hoi/goi) nhé.')).toEqual([
      { kind: 'text', text: 'Xem ' },
      { kind: 'bold', text: 'kỹ' },
      { kind: 'text', text: ' ở ' },
      { kind: 'link', text: 'Bảng giá', href: '/tao-hoi/goi' },
      { kind: 'text', text: ' nhé.' },
    ]);
  });

  it('chữ không có ký hiệu thì giữ nguyên một mảnh', () => {
    expect(parseInline('Chữ thường (có ngoặc) và dấu * lẻ.')).toEqual([{ kind: 'text', text: 'Chữ thường (có ngoặc) và dấu * lẻ.' }]);
  });
});

describe.each(DOCS)('trang $path', (doc) => {
  const texts = textsOf(doc);

  it('có tiêu đề, ngày cập nhật dạng ngày/tháng/năm, lời mở đầu và mục Liên hệ ở cuối', () => {
    expect(doc.title.length).toBeGreaterThan(5);
    expect(doc.updatedAt).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(doc.intro.length).toBeGreaterThan(0);
    const last = doc.sections[doc.sections.length - 1]!;
    expect(last.id).toBe('lien-he');
    expect(last.blocks).toEqual([{ type: 'contact' }]);
  });

  it('neo của các phần không trùng nhau, viết thường không dấu, và phần nào cũng có nội dung', () => {
    const ids = doc.sections.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of doc.sections) {
      expect(s.id, s.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(s.title.trim().length, s.id).toBeGreaterThan(0);
      expect(s.blocks.length, s.id).toBeGreaterThan(0);
    }
    // "muc-luc" là neo của mục lục trên trang.
    expect(ids).not.toContain('muc-luc');
  });

  it('tiêu đề phần không tự ghi số (số do trang đánh)', () => {
    for (const s of doc.sections) expect(s.title, s.id).not.toMatch(/^\d/);
  });

  it('không dùng gạch ngang dài', () => {
    for (const t of texts) expect(t).not.toMatch(LONG_DASH);
  });

  it('không sót chữ giữ chỗ', () => {
    for (const t of texts) {
      expect(t).not.toMatch(/\[[^\]]*\](?!\()/);
      expect(t).not.toMatch(/TODO|lorem|xxx|\.\.\.\.|\bTBD\b/i);
    }
  });

  it('link trong bài trỏ tới trang có trong router, neo trỏ tới phần có thật', () => {
    const anchors: Record<string, string[]> = Object.fromEntries(DOCS.map((d) => [d.path, d.sections.map((s) => s.id)]));
    const links = texts.flatMap((t) => parseInline(t)).filter((p) => p.kind === 'link');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      if (link.kind !== 'link' || link.href.startsWith('mailto:')) continue;
      expect(link.href, link.href).toMatch(/^\//);
      const [path, hash] = link.href.split('#') as [string, string | undefined];
      expect(ROUTER.includes(`path: '${path}'`), `router thiếu ${path}`).toBe(true);
      if (hash) expect(anchors[path] ?? [], link.href).toContain(hash);
    }
  });

  it('dẫn sang trang pháp lý còn lại ngay trong bài', () => {
    const other = DOCS.find((d) => d.path !== doc.path)!;
    expect(texts.some((t) => t.includes(`](${other.path}`))).toBe(true);
  });
});

describe('mục Liên hệ', () => {
  it('chưa có email hỗ trợ: nói rõ là chưa công bố hộp thư, không bịa địa chỉ', () => {
    const c = legalContact(null);
    expect(c.items.join(' ')).not.toMatch(/@/);
    expect(c.items.join(' ')).toMatch(/chưa công bố hộp thư/);
  });

  it('có email hỗ trợ: hiện email lên đầu và bỏ dòng "chưa công bố"', () => {
    const c = legalContact('hotro@example.com');
    expect(c.items[0]).toContain('[hotro@example.com](mailto:hotro@example.com)');
    expect(c.items.join(' ')).not.toMatch(/chưa công bố hộp thư/);
  });
});

describe('router', () => {
  it('có route cho cả hai trang, nằm trước route /:slug của hội', () => {
    for (const doc of DOCS) {
      const at = ROUTER.indexOf(`path: '${doc.path}'`);
      expect(at, doc.path).toBeGreaterThan(-1);
      expect(at, doc.path).toBeLessThan(ROUTER.indexOf("path: '/:slug'"));
    }
  });
});
