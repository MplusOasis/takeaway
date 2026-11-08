import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Db } from '../db/connection.js';
import { getUserByToken, type SessionUser } from '../domain/authService.js';
import { AppError } from '../errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: SessionUser;
      token?: string;
    }
  }
}

function readBearer(req: Request): string | null {
  const header = req.header('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match?.[1]?.trim() ?? null;
}

/** 解析 token 并挂载 req.user（不阻断未登录请求，供 logout 等场景使用） */
export function attachUser(db: Db): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const token = readBearer(req);
    if (token) {
      const user = getUserByToken(db, token);
      if (user) {
        req.user = user;
        req.token = token;
      }
    }
    next();
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError('UNAUTHENTICATED', '请先登录', 401));
    return;
  }
  next();
}

/** 在 requireAuth 之后使用，把可选类型收窄为确定值 */
export function currentUser(req: Request): SessionUser {
  if (!req.user) throw new AppError('UNAUTHENTICATED', '请先登录', 401);
  return req.user;
}
