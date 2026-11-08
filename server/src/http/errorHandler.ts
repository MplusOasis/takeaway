import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AppError } from '../errors.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `接口不存在：${req.method} ${req.path}` },
  });
};

/** 统一错误出口：业务错误原样透出 code，未知错误一律 500 且不泄露堆栈 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'INVALID_PAYLOAD', message: '请求体不是合法 JSON' } });
    return;
  }

  console.error('[unhandled]', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: '服务器开小差了，请稍后重试' } });
};
