import { CANCEL_WINDOW_MS, STATUS_MILESTONES_MS } from '../config.js';
import { AppError } from '../errors.js';
import type { OrderStatus } from './types.js';

/**
 * 状态机白名单：每个状态只允许一个后继（SPEC R7 / AC-12）。
 * 这张表就是「不可跳步、不可逆向」的唯一实现，任何状态变更都必须经过 assertTransition。
 */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  paid: 'preparing',
  preparing: 'ready',
  ready: 'completed',
  completed: null,
  cancelled: null,
};

export interface Milestone {
  from: OrderStatus;
  to: OrderStatus;
  afterMs: number;
}

/** 里程碑按时间先后排列，推进时逐级判断（ADR-004 读时收敛） */
export const MILESTONES: Milestone[] = [
  { from: 'paid', to: 'preparing', afterMs: STATUS_MILESTONES_MS.preparing },
  { from: 'preparing', to: 'ready', afterMs: STATUS_MILESTONES_MS.ready },
  { from: 'ready', to: 'completed', afterMs: STATUS_MILESTONES_MS.completed },
];

export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (NEXT_STATUS[from] !== to) {
    throw new AppError(
      'ORDER_NOT_CANCELLABLE',
      `非法的状态流转：${from} → ${to}`,
      409,
      { from, to, allowed: NEXT_STATUS[from] },
    );
  }
}

/**
 * 返回当前状态应当推进到的下一个状态；未到时间阈值时返回 null。
 * 一次只返回一步，调用方循环调用，因此永远不会跨级。
 */
export function nextStatus(
  status: OrderStatus,
  paidAtMs: number,
  nowMs: number,
): { to: OrderStatus; at: string } | null {
  if (status === 'cancelled' || status === 'completed') return null;
  const milestone = MILESTONES.find((item) => item.from === status);
  if (!milestone) return null;
  const milestoneAt = paidAtMs + milestone.afterMs;
  if (nowMs < milestoneAt) return null;
  return { to: milestone.to, at: new Date(milestoneAt).toISOString() };
}

/** 取消窗口：仅「已支付」且未超过 25 秒（AC-13 / AC-14） */
export function isCancellable(status: OrderStatus, paidAtMs: number, nowMs: number): boolean {
  return status === 'paid' && nowMs < paidAtMs + CANCEL_WINDOW_MS;
}

export function cancelRemainingMs(status: OrderStatus, paidAtMs: number, nowMs: number): number {
  if (status !== 'paid') return 0;
  return Math.max(0, paidAtMs + CANCEL_WINDOW_MS - nowMs);
}
