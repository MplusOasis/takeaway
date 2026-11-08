import type { Request } from 'express';
import { AppError } from '../errors.js';

export function body(req: Request): Record<string, unknown> {
  const value: unknown = req.body;
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AppError('INVALID_PAYLOAD', '请求体必须是 JSON 对象', 400);
  }
  return value as Record<string, unknown>;
}

export function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError('INVALID_PAYLOAD', `字段 ${field} 必填`, 400, { field });
  }
  return value;
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') {
    throw new AppError('INVALID_PAYLOAD', `字段 ${field} 必须是字符串`, 400, { field });
  }
  return value;
}

export function requiredInt(value: unknown, field: string): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    throw new AppError('INVALID_PAYLOAD', `字段 ${field} 必须是整数`, 400, { field });
  }
  return parsed;
}

export function optionalEnum<T extends string>(
  value: unknown,
  field: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new AppError('INVALID_PAYLOAD', `字段 ${field} 取值不合法`, 400, { field, allowed });
  }
  return value as T;
}
