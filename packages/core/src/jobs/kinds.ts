// Tên `kind` của các dòng scheduled_jobs. Nằm ở file riêng (không import gì) để cả service lẫn jobs/scheduled dùng
// mà không tạo vòng import.

/** Xóa một tệp trên R2, payload `{ objectKey }`. */
export const FILE_DELETE_JOB = 'file.delete';
