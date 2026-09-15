// Tải tệp từ API có kèm Bearer token (thẻ <a> không gắn được header), rồi lưu qua Blob.
import { ApiError, api, tokens } from './api';

/** Tải một đường dẫn API (CSV/JSON) về máy với tên tệp cho trước. */
export async function downloadFromApi(path: string, fileName: string): Promise<void> {
  const res = await fetch(`${api.url}${path}`, { headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {} });
  if (!res.ok) throw new ApiError('download_failed', 'Không tải được tệp', res.status);
  saveBlob(await res.blob(), fileName);
}

/** Lưu Blob thành tệp tải về. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Chuyển mảng bản ghi thành CSV có BOM để Excel đọc tiếng Việt. */
export function toCsvBlob(rows: string[][]): Blob {
  const text = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  return new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
}
