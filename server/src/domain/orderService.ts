import { randomUUID } from 'node:crypto';
import {
  CANCEL_WINDOW_MS,
  FREE_DELIVERY_THRESHOLD_CENTS,
  MIN_ADDRESS_LENGTH,
} from '../config.js';
import type { Db } from '../db/connection.js';
import { execute, queryAll, queryOne, withTransaction } from '../db/connection.js';
import { AppError } from '../errors.js';
import { removeDishesFromCart } from './cartService.js';
import { totalsFor } from './pricing.js';
import { assertTransition, cancelRemainingMs, isCancellable, nextStatus } from './statusMachine.js';
import {
  ORDER_STATUS_LABELS,
  type DishStatus,
  type OrderItemRow,
  type OrderStatus,
  type OrderView,
  type OrderRow,
  type StatusLogRow,
  type TimelineEntry,
} from './types.js';

export interface CreateOrderInput {
  address: string;
  remark?: string | null;
}

interface CartLineRow {
  dish_id: string;
  qty: number;
  name: string;
  price_cents: number;
  status: DishStatus;
  stall_id: string;
  stall_name: string;
}

const BASE_TIMELINE: OrderStatus[] = ['paid', 'preparing', 'ready', 'completed'];

const MAX_REMARK_LENGTH = 100;

/**
 * 提交订单：跨档口拆单 + 服务端重算金额 + 菜名/单价快照（SPEC R4~R6、AC-05~AC-10）。
 * 客户端不参与任何金额计算，入参里即使带了 totalCents 也不会被读取。
 */
export function createOrders(
  db: Db,
  userId: string,
  input: CreateOrderInput,
  now: Date = new Date(),
): OrderView[] {
  const address = input.address.trim();
  if (address.length < MIN_ADDRESS_LENGTH) {
    throw new AppError('ADDRESS_REQUIRED', '请填写配送地址（至少 5 个字）', 400, {
      minLength: MIN_ADDRESS_LENGTH,
    });
  }

  const remarkRaw = input.remark?.trim() ?? '';
  const remark = remarkRaw ? remarkRaw.slice(0, MAX_REMARK_LENGTH) : null;

  const lines = queryAll<CartLineRow>(
    db,
    `SELECT c.dish_id, c.qty, d.name, d.price_cents, d.status,
            d.stall_id, s.name AS stall_name
     FROM cart_items c
     JOIN dishes d ON d.id = c.dish_id
     JOIN stalls s ON s.id = d.stall_id
     WHERE c.user_id = ?
     ORDER BY s.sort ASC, d.sort ASC`,
    userId,
  );

  if (lines.length === 0) {
    throw new AppError('CART_EMPTY', '购物车是空的，先挑点吃的吧', 400);
  }

  const unavailable = lines.filter((line) => line.status !== 'on_sale');
  if (unavailable.length > 0) {
    throw new AppError(
      'CART_HAS_UNAVAILABLE_DISH',
      '购物车里有已售罄或已下架的菜品，请先移除',
      409,
      unavailable.map((line) => ({
        dishId: line.dish_id,
        name: line.name,
        status: line.status,
        reason: line.status === 'sold_out' ? '已售罄' : '已下架',
      })),
    );
  }

  const groups = new Map<string, CartLineRow[]>();
  for (const line of lines) {
    const list = groups.get(line.stall_id);
    if (list) list.push(line);
    else groups.set(line.stall_id, [line]);
  }

  const nowMs = now.getTime();
  const createdAt = now.toISOString();
  const cancelDeadline = new Date(nowMs + CANCEL_WINDOW_MS).toISOString();
  const createdIds: string[] = [];

  withTransaction(db, () => {
    for (const [stallId, stallLines] of groups) {
      const itemsTotalCents = stallLines.reduce(
        (sum, line) => sum + line.price_cents * line.qty,
        0,
      );
      const totals = totalsFor(itemsTotalCents);
      const orderId = randomUUID();
      const code = buildOrderCode(orderId);
      const stallName = stallLines[0]?.stall_name ?? '';

      execute(
        db,
        `INSERT INTO orders (id, code, user_id, stall_id, stall_name, status,
                             items_total_cents, delivery_fee_cents, total_cents,
                             address, remark, paid_at, cancel_deadline, cancelled_at, created_at)
         VALUES (?, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
        orderId,
        code,
        userId,
        stallId,
        stallName,
        totals.itemsTotalCents,
        totals.deliveryFeeCents,
        totals.totalCents,
        address,
        remark,
        createdAt,
        cancelDeadline,
        createdAt,
      );

      for (const line of stallLines) {
        execute(
          db,
          `INSERT INTO order_items (id, order_id, dish_id, name_snapshot, price_cents_snapshot, qty)
           VALUES (?, ?, ?, ?, ?, ?)`,
          randomUUID(),
          orderId,
          line.dish_id,
          line.name,
          line.price_cents,
          line.qty,
        );
      }

      execute(
        db,
        `INSERT INTO order_status_logs (order_id, from_status, to_status, at)
         VALUES (?, NULL, 'paid', ?)`,
        orderId,
        createdAt,
      );

      createdIds.push(orderId);
    }

    removeDishesFromCart(
      db,
      userId,
      lines.map((line) => line.dish_id),
    );
  });

  return createdIds.map((id) => getOrder(db, userId, id, now));
}

export function listOrders(db: Db, userId: string, now: Date = new Date()): OrderView[] {
  const rows = queryAll<OrderRow>(
    db,
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, code DESC',
    userId,
  );
  const nowMs = now.getTime();
  return rows.map((row) => buildOrderView(db, syncStatus(db, row, nowMs), nowMs));
}

export function getOrder(
  db: Db,
  userId: string,
  orderId: string,
  now: Date = new Date(),
): OrderView {
  const row = queryOne<OrderRow>(db, 'SELECT * FROM orders WHERE id = ?', orderId);
  if (!row) throw new AppError('ORDER_NOT_FOUND', '订单不存在', 404, { orderId });
  if (row.user_id !== userId) {
    throw new AppError('FORBIDDEN_ORDER', '不能查看他人的订单', 403, { orderId });
  }
  const nowMs = now.getTime();
  return buildOrderView(db, syncStatus(db, row, nowMs), nowMs);
}

export function cancelOrder(
  db: Db,
  userId: string,
  orderId: string,
  now: Date = new Date(),
): OrderView {
  const row = queryOne<OrderRow>(db, 'SELECT * FROM orders WHERE id = ?', orderId);
  if (!row) throw new AppError('ORDER_NOT_FOUND', '订单不存在', 404, { orderId });
  if (row.user_id !== userId) {
    throw new AppError('FORBIDDEN_ORDER', '不能取消他人的订单', 403, { orderId });
  }

  const nowMs = now.getTime();
  const synced = syncStatus(db, row, nowMs);
  const paidAtMs = Date.parse(synced.paid_at);

  if (!isCancellable(synced.status, paidAtMs, nowMs)) {
    if (synced.status !== 'paid') {
      const windowClosed = nowMs >= paidAtMs + CANCEL_WINDOW_MS;
      throw new AppError(
        windowClosed ? 'CANCEL_WINDOW_CLOSED' : 'ORDER_NOT_CANCELLABLE',
        windowClosed ? '已超过 25 秒可取消时间' : `订单当前状态为「${ORDER_STATUS_LABELS[synced.status]}」，不可取消`,
        409,
        { status: synced.status, cancelDeadline: synced.cancel_deadline },
      );
    }
    throw new AppError('ORDER_NOT_CANCELLABLE', '订单当前状态不可取消', 409, {
      status: synced.status,
    });
  }

  const cancelledAt = new Date(nowMs).toISOString();
  withTransaction(db, () => {
    execute(
      db,
      'UPDATE orders SET status = ?, cancelled_at = ? WHERE id = ?',
      'cancelled',
      cancelledAt,
      orderId,
    );
    execute(
      db,
      `INSERT INTO order_status_logs (order_id, from_status, to_status, at)
       VALUES (?, ?, 'cancelled', ?)`,
      orderId,
      synced.status,
      cancelledAt,
    );
  });

  return getOrder(db, userId, orderId, now);
}

/**
 * 读时收敛：把「按时间本应达到」的状态逐级落库（ADR-004）。
 * 逐级推进保证不可跳步；重复调用不会重复写日志。
 */
function syncStatus(db: Db, row: OrderRow, nowMs: number): OrderRow {
  const paidAtMs = Date.parse(row.paid_at);
  let status = row.status;
  let changed = false;

  for (;;) {
    const step = nextStatus(status, paidAtMs, nowMs);
    if (!step) break;
    assertTransition(status, step.to);
    execute(db, 'UPDATE orders SET status = ? WHERE id = ?', step.to, row.id);
    execute(
      db,
      `INSERT INTO order_status_logs (order_id, from_status, to_status, at)
       VALUES (?, ?, ?, ?)`,
      row.id,
      status,
      step.to,
      step.at,
    );
    status = step.to;
    changed = true;
  }

  return changed ? { ...row, status } : row;
}

function buildOrderView(db: Db, row: OrderRow, nowMs: number): OrderView {
  const items = queryAll<OrderItemRow>(
    db,
    'SELECT * FROM order_items WHERE order_id = ? ORDER BY name_snapshot ASC',
    row.id,
  );
  const logs = queryAll<StatusLogRow>(
    db,
    'SELECT * FROM order_status_logs WHERE order_id = ? ORDER BY id ASC',
    row.id,
  );

  const logByStatus = new Map<OrderStatus, string>();
  for (const log of logs) {
    if (!logByStatus.has(log.to_status)) logByStatus.set(log.to_status, log.at);
  }

  const timeline: TimelineEntry[] = BASE_TIMELINE.map((status) => ({
    status,
    label: ORDER_STATUS_LABELS[status],
    at: status === 'paid' ? row.paid_at : logByStatus.get(status) ?? null,
  }));

  if (row.status === 'cancelled') {
    timeline.push({
      status: 'cancelled',
      label: ORDER_STATUS_LABELS.cancelled,
      at: row.cancelled_at,
    });
  }

  const paidAtMs = Date.parse(row.paid_at);

  return {
    id: row.id,
    code: row.code,
    stallId: row.stall_id,
    stallName: row.stall_name,
    status: row.status,
    statusLabel: ORDER_STATUS_LABELS[row.status],
    itemsTotalCents: row.items_total_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.total_cents,
    address: row.address,
    remark: row.remark,
    paidAt: row.paid_at,
    cancelDeadline: row.cancel_deadline,
    cancellable: isCancellable(row.status, paidAtMs, nowMs),
    cancelRemainingMs: cancelRemainingMs(row.status, paidAtMs, nowMs),
    items: items.map((item) => ({
      dishId: item.dish_id,
      name: item.name_snapshot,
      priceCents: item.price_cents_snapshot,
      qty: item.qty,
    })),
    timeline,
    freeDeliveryThresholdCents: FREE_DELIVERY_THRESHOLD_CENTS,
  };
}

function buildOrderCode(orderId: string): string {
  return `TK${orderId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}
