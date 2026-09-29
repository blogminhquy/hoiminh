// Kích thước ảnh trong bài viết. Tách khỏi PhotoGrid.tsx để test được mà không cần dựng giao diện.

/** Chiều cao tối đa của ảnh đơn trong bài viết (px). Bản thu gọn (compact) dùng 60%. */
export const SINGLE_PHOTO_MAX_HEIGHT = 360;

/**
 * Khung cho bài có đúng 1 ảnh: đúng tỷ lệ ảnh nên không bị cắt hay phóng to, cao tối đa `maxHeight`,
 * không rộng quá thẻ. Khung có sẵn tỷ lệ nên trang không nhảy khi ảnh tải xong.
 * Chưa biết kích thước ảnh (dữ liệu cũ) thì dùng 4:3, ảnh nằm gọn trong khung.
 */
export function singlePhotoBox(img: { width?: number | null; height?: number | null }, maxHeight: number): { width: string; aspectRatio: string } {
  const ratio = img.width && img.height ? img.width / img.height : 4 / 3;
  return { width: `min(100%, ${Math.round(maxHeight * ratio)}px)`, aspectRatio: String(Math.round(ratio * 10_000) / 10_000) };
}
