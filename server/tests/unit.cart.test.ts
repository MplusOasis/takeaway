import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getCart, addItem, removeItem, updateItemQty } from '../src/domain/cartService.js';
import { openDatabase, type Db } from '../src/db/connection.js';
import { seedIfEmpty } from '../src/db/seed.js';
import { AppError } from '../src/errors.js';

const USER = 'u-lin';

let db: Db;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedIfEmpty(db);
});

afterEach(() => {
  db.close();
});

function catchCode(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    return (error as AppError).code;
  }
  throw new Error('期望抛出 AppError，但没有抛出');
}

describe('cartService · 可售校验（SPEC R2 / AC-01、AC-02）', () => {
  it('已售罄菜品不可加购，返回 DISH_NOT_AVAILABLE 且购物车不变', () => {
    const before = getCart(db, USER).count;
    expect(catchCode(() => addItem(db, USER, 'd-chuan-2', 1))).toBe('DISH_NOT_AVAILABLE');
    expect(getCart(db, USER).count).toBe(before);
  });

  it('已下架菜品不可加购', () => {
    expect(catchCode(() => addItem(db, USER, 'd-chuan-4', 1))).toBe('DISH_NOT_AVAILABLE');
  });

  it('不存在的菜品返回 DISH_NOT_FOUND', () => {
    expect(catchCode(() => addItem(db, USER, 'd-nope', 1))).toBe('DISH_NOT_FOUND');
  });

  it('数量必须为正整数', () => {
    expect(catchCode(() => addItem(db, USER, 'd-chuan-1', 0))).toBe('INVALID_PAYLOAD');
    expect(catchCode(() => addItem(db, USER, 'd-chuan-1', -2))).toBe('INVALID_PAYLOAD');
    expect(catchCode(() => addItem(db, USER, 'd-chuan-1', 1.5))).toBe('INVALID_PAYLOAD');
  });
});

describe('cartService · 跨档口购物车（SPEC R3 / AC-03）', () => {
  it('两家档口的菜品同时存在并按档口分组', () => {
    addItem(db, USER, 'd-noodle-1', 2);
    addItem(db, USER, 'd-chuan-1', 1);

    const cart = getCart(db, USER);
    expect(cart.groups).toHaveLength(2);
    expect(cart.groups.map((group) => group.stallName)).toEqual(['川味小炒', '面点档']);
    expect(cart.count).toBe(3);
  });

  it('分组小计按档口分别计算配送费', () => {
    addItem(db, USER, 'd-noodle-1', 2); // 1200 → 收配送费
    addItem(db, USER, 'd-chuan-1', 1); // 1600
    addItem(db, USER, 'd-chuan-3', 1); // 900 → 档口合计 2500 → 免配送费

    const cart = getCart(db, USER);
    const chuan = cart.groups.find((group) => group.stallId === 'st-chuan');
    const noodle = cart.groups.find((group) => group.stallId === 'st-noodle');

    expect(chuan?.itemsTotalCents).toBe(2500);
    expect(chuan?.deliveryFeeCents).toBe(0);
    expect(noodle?.itemsTotalCents).toBe(1200);
    expect(noodle?.deliveryFeeCents).toBe(100);
    expect(cart.totals.totalCents).toBe(2500 + 1300);
  });

  it('重复加购同一菜品累加数量', () => {
    addItem(db, USER, 'd-chuan-1', 1);
    const cart = addItem(db, USER, 'd-chuan-1', 2);
    expect(cart.groups[0]?.items[0]?.qty).toBe(3);
  });

  it('数量改到 0 等于移除（AC-04）', () => {
    addItem(db, USER, 'd-chuan-1', 2);
    const cart = updateItemQty(db, USER, 'd-chuan-1', 0);
    expect(cart.groups).toHaveLength(0);
    expect(cart.count).toBe(0);
  });

  it('移除不存在的条目返回 CART_ITEM_NOT_FOUND', () => {
    expect(catchCode(() => removeItem(db, USER, 'd-chuan-1'))).toBe('CART_ITEM_NOT_FOUND');
  });

  it('加购后菜品变为售罄时，购物车把它标记为不可售且不计入金额', () => {
    addItem(db, USER, 'd-chuan-1', 1);
    db.prepare("UPDATE dishes SET status = 'sold_out' WHERE id = ?").run('d-chuan-1');

    const cart = getCart(db, USER);
    expect(cart.count).toBe(0);
    expect(cart.totals.totalCents).toBe(0);
    expect(cart.issues).toHaveLength(1);
    expect(cart.issues[0]?.dishId).toBe('d-chuan-1');
  });

  it('不同用户的购物车互不影响', () => {
    addItem(db, USER, 'd-chuan-1', 1);
    expect(getCart(db, 'u-zhou').count).toBe(0);
  });
});
