// Lỗi nghiệp vụ chuẩn: mọi lớp giao tiếp (API, MCP) map về { code, message }.
import type { ErrorCode } from '@hoiminh/contracts';

export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly status: number = statusOf(code),
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function statusOf(code: ErrorCode): number {
  switch (code) {
    case 'unauthorized':
      return 401;
    case 'forbidden':
    case 'plan_locked':
    case 'feature_disabled':
      return 403;
    case 'not_found':
      return 404;
    case 'conflict':
    case 'invalid_state':
    case 'insufficient_balance':
      return 409;
    case 'validation_error':
      return 422;
    case 'rate_limited':
      return 429;
    case 'payment_error':
      return 402;
    default:
      return 500;
  }
}

export const notFound = (what = 'Không tìm thấy') => new AppError('not_found', what);
export const forbidden = (why = 'Bạn không có quyền thực hiện thao tác này') => new AppError('forbidden', why);
export const unauthorized = (why = 'Cần đăng nhập') => new AppError('unauthorized', why);
export const invalid = (why: string, details?: unknown) => new AppError('validation_error', why, 422, details);
export const conflict = (why: string) => new AppError('conflict', why);
export const invalidState = (why: string) => new AppError('invalid_state', why);
