// Tên miền đang phục vụ web, lấy từ VITE_APP_URL lúc build (production: hoiminh.com).
// Dùng khi hiện đường dẫn hội cho người dùng, thay vì chuỗi cứng.
const APP_URL = (import.meta.env.VITE_APP_URL as string | undefined) ?? (typeof window !== 'undefined' ? window.location.origin : 'https://hoiminh.com');

/** "hoiminh.com" (không có giao thức). */
export const SITE_HOST = APP_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
