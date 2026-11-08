import { randomUUID } from 'node:crypto';
import { MAX_ITEM_QTY, FREE_DELIVERY_THRESHOLD_CENTS } from '../config.js';
import type { Db } from '../db/connection.js';
import { execute, queryAll, queryOne } from '../db/connection.js';
import { AppError } from '../errors.js';
import { deliveryFeeFor, sumLines } from './pricing.js';
import type {
  CartGroupView,
  CartIssue,
  CartItemView,
  CartView,
  DishStatus,
} from './types.js';

interface CartJoinRow {
  dish_id: string;
  qty: number;
  name: string;
  price_cents: number;
  status: DishStatus;
  stall_id: string;
  stall_name: string;
  stall_sort: number;
}

const CART_JOIN_SQL = `
  SELECT c.dish_id, c.qty, d.name, d.price_cents, d.status,
         d.stall_id, s.name AS stall_name, s.sort AS stall_sort
  FROM cart_items c
  JOIN dishes d ON d.id = c.dish_id
  JOIN stalls s ON s.id = d.stall_id
  WHERE c.user_id = ?
  ORDER BY s.sort ASC, d.sort ASC
`;

/** 购物车视图：按档口分组，只有「可售」条目计入金额（SPEC R5、AC-06） */
export function getCart(db: Db, userId: string): CartView {
  const rows = queryAll<CartJoinRow>(db, CART_JOIN_SQL, userId);

  const groups = new Map<string, CartGroupView>();
  const issues: CartIssue[] = [];
  let count = 0;
  let itemsTotalCents = 0;
  let deliveryFeeCents = 0;

  for (const row of rows) {
    const available = row.status === 'on_sale';
    const item: CartItemView = {
      dishId: row.dish_id,
      name: row.name,
      priceCents: row.price_cents,
      qty: row.qty,
      subtotalCents: row.price_cents * row.qty,
      stallId: row.stall_id,
      stallName: row.stall_name,
      status: row.status,
      available,
    };

    let group = groups.get(row.stall_id);
    if (!group) {
      group = {
        stallId: row.stall_id,
        stallName: row.stall_name,
        items: [],
        itemsTotalCents: 0,
        deliveryFeeCents: 0,
        totalCents: 0,
      };
      groups.set(row.stall_id, group);
    }
    group.items.push(item);

    if (!available) {
      issues.push({
        dishId: row.dish_id,
        name: row.name,
        status: row.status,
        reason: row.status === 'sold_out' ? '已售罄' : '已下架',
      });
      continue;
    }

    const subtotal = row.price_cents * row.qty;
    group.itemsTotalCents += subtotal;
    count += row.qty;
    itemsTotalCents += subtotal;
  }

  for (const group of groups.values()) {
    group.deliveryFeeCents = deliveryFeeFor(group.itemsTotalCents);
    group.totalCents = group.itemsTotalCents + group.deliveryFeeCents;
    deliveryFeeCents += group.deliveryFeeCents;
  }

  return {
    groups: [...groups.values()],
    count,
    totals: {
      itemsTotalCents,
      deliveryFeeCents,
      totalCents: itemsTotalCents + deliveryFeeCents,
    },
    issues,
    freeDeliveryThresholdCents: FREE_DELIVERY_THRESHOLD_CENTS,
  };
}

export function addItem(db: Db, userId: string, dishId: string, qty: number): CartView {
  assertQty(qty);

  const dish = queryOne<{ status: DishStatus; name: string }>(
    db,
    'SELECT status, name FROM dishes WHERE id = ?',
    dishId,
  );
  if (!dish) throw new AppError('DISH_NOT_FOUND', '菜品不存在', 404, { dishId });
  if (dish.status !== 'on_sale') {
    throw new AppError(
      'DISH_NOT_AVAILABLE',
      dish.status === 'sold_out' ? `「${dish.name}」已售罄` : `「${dish.name}」已下架`,
      409,
      { dishId, status: dish.status },
    );
  }

  const existing = queryOne<{ qty: number }>(
    db,
    'SELECT qty FROM cart_items WHERE user_id = ? AND dish_id = ?',
    userId,
    dishId,
  );

  if (existing) {
    const nextQty = Math.min(existing.qty + qty, MAX_ITEM_QTY);
    execute(
      db,
      'UPDATE cart_items SET qty = ? WHERE user_id = ? AND dish_id = ?',
      nextQty,
      userId,
      dishId,
    );
  } else {
    execute(
      db,
      'INSERT INTO cart_items (id, user_id, dish_id, qty, created_at) VALUES (?, ?, ?, ?, ?)',
      randomUUID(),
      userId,
      dishId,
      Math.min(qty, MAX_ITEM_QTY),
      new Date().toISOString(),
    );
  }

  return getCart(db, userId);
}

export function updateItemQty(db: Db, userId: string, dishId: string, qty: number): CartView {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new AppError('INVALID_PAYLOAD', '数量必须是非负整数', 400, { qty });
  }
  const existing = queryOne<{ id: string }>(
    db,
    'SELECT id FROM cart_items WHERE user_id = ? AND dish_id = ?',
    userId,
    dishId,
  );
  if (!existing) {
    throw new AppError('CART_ITEM_NOT_FOUND', '购物车中没有该菜品', 404, { dishId });
  }

  if (qty === 0) {
    execute(db, 'DELETE FROM cart_items WHERE user_id = ? AND dish_id = ?', userId, dishId);
    return getCart(db, userId);
  }

  execute(
    db,
    'UPDATE cart_items SET qty = ? WHERE user_id = ? AND dish_id = ?',
    Math.min(qty, MAX_ITEM_QTY),
    userId,
    dishId,
  );
  return getCart(db, userId);
}

export function removeItem(db: Db, userId: string, dishId: string): CartView {
  const existing = queryOne<{ id: string }>(
    db,
    'SELECT id FROM cart_items WHERE user_id = ? AND dish_id = ?',
    userId,
    dishId,
  );
  if (!existing) {
    throw new AppError('CART_ITEM_NOT_FOUND', '购物车中没有该菜品', 404, { dishId });
  }
  execute(db, 'DELETE FROM cart_items WHERE user_id = ? AND dish_id = ?', userId, dishId);
  return getCart(db, userId);
}

export function clearCart(db: Db, userId: string): CartView {
  execute(db, 'DELETE FROM cart_items WHERE user_id = ?', userId);
  return getCart(db, userId);
}

/** 内部使用：下单成功后按菜品清空（SPEC AC-10） */
export function removeDishesFromCart(db: Db, userId: string, dishIds: string[]): void {
  for (const dishId of dishIds) {
    execute(db, 'DELETE FROM cart_items WHERE user_id = ? AND dish_id = ?', userId, dishId);
  }
}

export function cartLinesTotal(lines: { priceCents: number; qty: number }[]): number {
  return sumLines(lines);
}

function assertQty(qty: number): void {
  if (!Number.isInteger(qty) || qty < 1) {
    throw new AppError('INVALID_PAYLOAD', '加购数量必须是正整数', 400, { qty });
  }
  if (qty > MAX_ITEM_QTY) {
    throw new AppError('INVALID_PAYLOAD', `单次加购不超过 ${MAX_ITEM_QTY} 份`, 400, { qty });
  }
}
