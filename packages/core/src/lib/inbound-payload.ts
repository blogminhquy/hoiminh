// Đọc dữ liệu một nguồn bên ngoài (form landing Webcake, công cụ khác) gửi về: tìm email, tên, số điện thoại và thẻ.
// Mỗi bên đặt tên trường một kiểu nên có hai cách: chủ hội chỉ rõ trường (mapping), hoặc để trống thì tự dò theo
// tên trường quen thuộc. Hàm thuần, không gọi database.
import type { InboundMapping } from '@hoiminh/db';

export const MAX_TAGS_PER_EVENT = 20;
export const MAX_TAG_LENGTH = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const EMAIL_KEYS = ['email', 'e_mail', 'mail', 'email_address', 'customer_email', 'buyer_email'];
const NAME_KEYS = ['full_name', 'fullname', 'name', 'customer_name', 'buyer_name', 'ho_ten', 'hoten', 'ten'];
const PHONE_KEYS = ['phone_number', 'phone', 'phonenumber', 'mobile', 'tel', 'sdt', 'so_dien_thoai', 'customer_phone'];
const TAG_KEYS = ['tag', 'tags'];
const REMOVE_TAG_KEYS = ['remove_tag', 'remove_tags', 'untag'];

export interface InboundExtract {
  email: string | null;
  name: string;
  phone: string;
  tags: string[];
  removeTags: string[];
}

/** Tên thẻ chuẩn: chữ thường không dấu, số, gạch dưới, gạch nối. "Đã Thanh Toán" thành `da_thanh_toan`. */
export function normalizeTagName(raw: string): string {
  return String(raw)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^[_-]+|[_-]+$/g, '')
    .slice(0, MAX_TAG_LENGTH);
}

/** Thẻ có thể đến dưới dạng chuỗi "a, b", mảng, chuỗi JSON của mảng, hoặc mảng object có `name`. */
export function parseTags(value: unknown): string[] {
  const out: string[] = [];
  const push = (v: unknown): void => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) { v.forEach(push); return; }
    if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      push(o.name ?? o.tag ?? o.value ?? null);
      return;
    }
    const text = String(v).trim();
    if (!text) return;
    if (text.startsWith('[')) {
      try { push(JSON.parse(text)); return; } catch { /* không phải JSON thì coi như chuỗi thường */ }
    }
    for (const part of text.split(/[,;|\n]/)) {
      const name = normalizeTagName(part);
      if (name && !out.includes(name)) out.push(name);
    }
  };
  push(value);
  return out.slice(0, MAX_TAGS_PER_EVENT);
}

/** Trải dữ liệu lồng nhau thành danh sách "đường.dẫn → giá trị" để chủ hội nhìn và chọn trường. */
export function flattenPayload(value: unknown, limit = 80): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (v: unknown, path: string, depth: number): void => {
    if (Object.keys(out).length >= limit) return;
    if (v === null || v === undefined) return;
    if (typeof v === 'object' && depth < 6) {
      const entries = Array.isArray(v) ? v.map((x, i) => [String(i), x] as const) : Object.entries(v as Record<string, unknown>);
      for (const [k, x] of entries) walk(x, path ? `${path}.${k}` : k, depth + 1);
      return;
    }
    if (path) out[path] = (typeof v === 'object' ? JSON.stringify(v) : String(v)).slice(0, 300);
  };
  walk(value, '', 0);
  return out;
}

/** Giá trị tại một đường dẫn dạng `data.customer.email` (nhận cả chỉ số mảng). */
export function valueAt(payload: unknown, path: string): unknown {
  let cur: unknown = payload;
  for (const key of path.split('.').map((s) => s.trim()).filter(Boolean)) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

const keyOf = (k: string) => k.toLowerCase().replace(/[\s-]+/g, '_');

/** Gom mọi giá trị có tên trường nằm trong danh sách, ở bất kỳ tầng nào. */
function findByKeys(payload: unknown, keys: string[]): unknown[] {
  const found: unknown[] = [];
  const walk = (v: unknown, depth: number): void => {
    if (v === null || typeof v !== 'object' || depth > 6) return;
    if (Array.isArray(v)) { v.forEach((x) => walk(x, depth + 1)); return; }
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      if (keys.includes(keyOf(k))) found.push(x);
      else walk(x, depth + 1);
    }
  };
  walk(payload, 0);
  return found;
}

const text = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v).trim() : '');
const asEmail = (v: unknown): string | null => {
  const s = text(v).toLowerCase();
  return EMAIL_RE.test(s) && s.length <= 254 ? s : null;
};

/** Tìm email, tên, số điện thoại, thẻ cần gắn và thẻ cần gỡ trong một lượt dữ liệu gửi về. */
export function extractInbound(payload: unknown, mapping: Partial<InboundMapping> = {}): InboundExtract {
  const mapped = (path: string | undefined) => (path?.trim() ? valueAt(payload, path) : undefined);

  let email = asEmail(mapped(mapping.emailPath));
  if (!email) email = findByKeys(payload, EMAIL_KEYS).map(asEmail).find(Boolean) ?? null;
  // Không có trường nào tên là email: lấy giá trị đầu tiên trông giống một địa chỉ email.
  if (!email) email = Object.values(flattenPayload(payload)).map(asEmail).find(Boolean) ?? null;

  const name = text(mapped(mapping.namePath)) || findByKeys(payload, NAME_KEYS).map(text).find(Boolean) || '';
  const phone = text(mapped(mapping.phonePath)) || findByKeys(payload, PHONE_KEYS).map(text).find(Boolean) || '';

  const tagSource = mapping.tagPath?.trim() ? [mapped(mapping.tagPath)] : findByKeys(payload, TAG_KEYS);
  const tags = parseTags([...(mapping.defaultTags ?? []), ...tagSource]);
  const removeSource = mapping.removeTagPath?.trim() ? [mapped(mapping.removeTagPath)] : findByKeys(payload, REMOVE_TAG_KEYS);
  const removeTags = parseTags(removeSource).filter((t) => !tags.includes(t));
  return { email, name: name.slice(0, 120), phone: phone.slice(0, 30), tags, removeTags };
}
