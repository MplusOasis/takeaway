import { describe, expect, it } from 'vitest';
import { AppError } from '../src/errors.js';
import {
  NEXT_STATUS,
  assertTransition,
  cancelRemainingMs,
  isCancellable,
  nextStatus,
} from '../src/domain/statusMachine.js';
import type { OrderStatus } from '../src/domain/types.js';

const PAID_AT = Date.parse('2026-11-08T03:40:00.000Z');

describe('statusMachine · 不可跳步与不可逆向（SPEC R7 / AC-12）', () => {
  it('白名单只允许 paid → preparing → ready → completed', () => {
    expect(NEXT_STATUS.paid).toBe('preparing');
    expect(NEXT_STATUS.preparing).toBe('ready');
    expect(NEXT_STATUS.ready).toBe('completed');
    expect(NEXT_STATUS.completed).toBeNull();
    expect(NEXT_STATUS.cancelled).toBeNull();
  });

  it('跳步流转被拒绝（paid → ready）', () => {
    expect(() => assertTransition('paid', 'ready')).toThrowError(AppError);
    try {
      assertTransition('paid', 'ready');
    } catch (error) {
      expect((error as AppError).code).toBe('ORDER_NOT_CANCELLABLE');
    }
  });

  it('逆向流转被拒绝（ready → preparing）', () => {
    expect(() => assertTransition('ready', 'preparing')).toThrowError(AppError);
  });

  it('已取消的订单不能再流转', () => {
    expect(() => assertTransition('cancelled', 'preparing')).toThrowError(AppError);
  });
});

describe('statusMachine · 读时收敛的时间阈值（AC-11）', () => {
  it('未到 25 秒保持 paid', () => {
    expect(nextStatus('paid', PAID_AT, PAID_AT + 24_999)).toBeNull();
  });

  it('到 25 秒推进到 preparing，且时间戳落在阈值上', () => {
    const step = nextStatus('paid', PAID_AT, PAID_AT + 25_000);
    expect(step?.to).toBe('preparing');
    expect(step?.at).toBe(new Date(PAID_AT + 25_000).toISOString());
  });

  it('一次只推进一级：paid 在第 200 秒只返回 preparing', () => {
    expect(nextStatus('paid', PAID_AT, PAID_AT + 200_000)?.to).toBe('preparing');
  });

  it('preparing → ready → completed 各自按里程碑推进', () => {
    expect(nextStatus('preparing', PAID_AT, PAID_AT + 74_999)).toBeNull();
    expect(nextStatus('preparing', PAID_AT, PAID_AT + 75_000)?.to).toBe('ready');
    expect(nextStatus('ready', PAID_AT, PAID_AT + 179_999)).toBeNull();
    expect(nextStatus('ready', PAID_AT, PAID_AT + 180_000)?.to).toBe('completed');
  });

  it('终态不再推进', () => {
    const terminal: OrderStatus[] = ['completed', 'cancelled'];
    for (const status of terminal) {
      expect(nextStatus(status, PAID_AT, PAID_AT + 10_000_000)).toBeNull();
    }
  });
});

describe('statusMachine · 25 秒取消窗口（AC-13 / AC-14）', () => {
  it('第 24 秒仍可取消', () => {
    expect(isCancellable('paid', PAID_AT, PAID_AT + 24_000)).toBe(true);
  });

  it('第 25 秒起不可取消（窗口与备餐开始不重叠）', () => {
    expect(isCancellable('paid', PAID_AT, PAID_AT + 25_000)).toBe(false);
  });

  it('已进入备餐中不可取消', () => {
    expect(isCancellable('preparing', PAID_AT, PAID_AT + 26_000)).toBe(false);
  });

  it('剩余时间不会被算成负数', () => {
    expect(cancelRemainingMs('paid', PAID_AT, PAID_AT + 10_000)).toBe(15_000);
    expect(cancelRemainingMs('paid', PAID_AT, PAID_AT + 40_000)).toBe(0);
    expect(cancelRemainingMs('cancelled', PAID_AT, PAID_AT + 1_000)).toBe(0);
  });
});
