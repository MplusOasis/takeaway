export type ErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_STUDENT_NO'
  | 'INVALID_PAYLOAD'
  | 'STALL_NOT_FOUND'
  | 'DISH_NOT_FOUND'
  | 'DISH_NOT_AVAILABLE'
  | 'CART_ITEM_NOT_FOUND'
  | 'CART_EMPTY'
  | 'CART_HAS_UNAVAILABLE_DISH'
  | 'ADDRESS_REQUIRED'
  | 'ORDER_NOT_FOUND'
  | 'FORBIDDEN_ORDER'
  | 'CANCEL_WINDOW_CLOSED'
  | 'ORDER_NOT_CANCELLABLE'
  | 'INTERNAL';

/** 业务错误：携带机器可判定的 code，前端据此决定提示文案与跳转 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details: unknown;

  constructor(code: ErrorCode, message: string, status = 400, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
