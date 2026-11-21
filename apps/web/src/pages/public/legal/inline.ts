// Tách chữ của trang pháp lý thành các mảnh: chữ thường, chữ đậm (`**...**`) và link (`[chữ](đường dẫn)`).
// Là hàm thuần để test được trên Node; phần dựng thành thẻ nằm ở `LegalDocument.tsx`.

export type InlinePart = { kind: 'text'; text: string } | { kind: 'bold'; text: string } | { kind: 'link'; text: string; href: string };

const TOKEN = /\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)\s]+)\)/g;

export function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ kind: 'text', text: text.slice(last, at) });
    if (m[1] !== undefined) parts.push({ kind: 'bold', text: m[1] });
    else parts.push({ kind: 'link', text: m[2]!, href: m[3]! });
    last = at + m[0].length;
  }
  if (last < text.length) parts.push({ kind: 'text', text: text.slice(last) });
  return parts;
}
