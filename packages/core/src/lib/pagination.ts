// Phân trang cursor: mã hóa (createdAt, id) thành chuỗi base64url.
export interface Cursor {
  at: string;
  id: string;
}

export function encodeCursor(at: Date, id: string): string {
  return btoa(`${at.toISOString()}|${id}`).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeCursor(cursor?: string | null): Cursor | null {
  if (!cursor) return null;
  try {
    const raw = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'));
    const [at, id] = raw.split('|');
    if (!at || !id) return null;
    return { at, id };
  } catch {
    return null;
  }
}

/** Cắt mảng lấy limit phần tử và tính cursor tiếp theo từ phần tử cuối. */
export function paginate<T extends { createdAt: Date; id: string }>(rows: T[], limit: number): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit);
  const last = items[items.length - 1];
  return { items, nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null };
}
