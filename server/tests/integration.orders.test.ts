import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { loginAs, startTestServer, timeTravelOrder, type TestContext } from './helpers.js';
import type { CartView, OrderView } from '../src/domain/types.js';

interface DataResponse<T> {
  data: T;
}

let ctx: TestContext;
let token: string;
let otherToken: string;

function countOrders(): number {
  const row = ctx.db.prepare('SELECT COUNT(*) AS count FROM orders').get() as
    | { count: number }
    | undefined;
  return row?.count ?? 0;
}

async function cartOf(activeToken: string): Promise<CartView> {
  const response = await ctx.call<DataResponse<{ cart: CartView }>>('/cart', { token: activeToken });
  return response.body.data.cart;
}

async function addItems(activeToken: string, items: { dishId: string; qty: number }[]): Promise<void> {
  for (const item of items) {
    const response = await ctx.call(`/cart/items`, {
      method: 'POST',
      token: activeToken,
      body: item,
    });
    expect(response.status).toBe(201);
  }
}

async function submitOrder(activeToken: string, body: Record<string, unknown>) {
  return ctx.call<DataResponse<{ orders: OrderView[] }> & { error?: unknown }>('/orders', {
    method: 'POST',
    token: activeToken,
    body,
  });
}

beforeAll(async () => {
  ctx = await startTestServer();
  token = await loginAs(ctx, '2021001', '林可');
  otherToken = await loginAs(ctx, '2021002', '周小满');
});

afterAll(async () => {
  await ctx.close();
});

beforeEach(async () => {
  await ctx.call('/cart', { method: 'DELETE', token });
  await ctx.call('/cart', { method: 'DELETE', token: otherToken });
});

describe('提交订单 · 地址校验（SPEC AC-05 / 界面 AC-18 的接口侧）', () => {
  it('地址只有空白字符时返回 400，不创建订单，购物车保留', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const before = countOrders();

    const response = await submitOrder(token, { address: '   ' });

    expect(response.status).toBe(400);
    expect((response.body as { error: { code: string } }).error.code).toBe('ADDRESS_REQUIRED');
    expect(countOrders()).toBe(before);
    expect((await cartOf(token)).count).toBe(1);
  });

  it('地址不足 5 个字同样被拒绝', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const response = await submitOrder(token, { address: '东门' });
    expect(response.status).toBe(400);
    expect((response.body as { error: { code: string } }).error.code).toBe('ADDRESS_REQUIRED');
  });

  it('空车提交返回 CART_EMPTY', async () => {
    const response = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    expect(response.status).toBe(400);
    expect((response.body as { error: { code: string } }).error.code).toBe('CART_EMPTY');
  });
});

describe('提交订单 · 跨档口拆单与服务端重算（SPEC AC-06）', () => {
  it('两家档口拆成两笔订单，配送费按档口分别计算', async () => {
    await addItems(token, [
      { dishId: 'd-noodle-1', qty: 2 }, // 面点档 600×2 = 1200
      { dishId: 'd-chuan-1', qty: 1 }, // 川味小炒 1600
      { dishId: 'd-chuan-3', qty: 1 }, // 川味小炒 900 → 2500
    ]);

    const response = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    expect(response.status).toBe(201);

    const orders = response.body.data.orders;
    expect(orders).toHaveLength(2);

    const chuan = orders.find((order) => order.stallId === 'st-chuan');
    const noodle = orders.find((order) => order.stallId === 'st-noodle');

    expect(chuan?.itemsTotalCents).toBe(2500);
    expect(chuan?.deliveryFeeCents).toBe(0);
    expect(chuan?.totalCents).toBe(2500);

    expect(noodle?.itemsTotalCents).toBe(1200);
    expect(noodle?.deliveryFeeCents).toBe(100);
    expect(noodle?.totalCents).toBe(1300);
  });

  it('每一笔订单都以「已支付」开始，并留下状态日志', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const response = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    const order = response.body.data.orders[0];

    expect(order?.status).toBe('paid');
    expect(order?.cancellable).toBe(true);

    const logs = ctx.db
      .prepare('SELECT * FROM order_status_logs WHERE order_id = ?')
      .all(order?.id as string) as { to_status: string; from_status: string | null }[];
    expect(logs).toHaveLength(1);
    expect(logs[0]?.from_status).toBeNull();
    expect(logs[0]?.to_status).toBe('paid');
  });

  it('订单表与明细表真实落库，总额等于明细重算值（集成断言）', async () => {
    await addItems(token, [
      { dishId: 'd-noodle-1', qty: 2 },
      { dishId: 'd-chuan-1', qty: 1 },
    ]);
    const response = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });

    for (const order of response.body.data.orders) {
      const items = ctx.db
        .prepare('SELECT price_cents_snapshot, qty FROM order_items WHERE order_id = ?')
        .all(order.id) as { price_cents_snapshot: number; qty: number }[];
      const recomputed = items.reduce(
        (sum, item) => sum + item.price_cents_snapshot * item.qty,
        0,
      );
      expect(order.itemsTotalCents).toBe(recomputed);

      const row = ctx.db
        .prepare('SELECT total_cents FROM orders WHERE id = ?')
        .get(order.id) as { total_cents: number } | undefined;
      expect(row?.total_cents).toBe(recomputed + order.deliveryFeeCents);
    }
  });
});

describe('提交订单 · 金额与快照不可被客户端左右（SPEC AC-07 / AC-08）', () => {
  it('请求体里的 totalCents 被忽略', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 2 }]);
    const response = await submitOrder(token, {
      address: '菜鸟驿站 3 号楼 门口',
      totalCents: 1,
      deliveryFeeCents: 0,
    });

    expect(response.status).toBe(201);
    expect(response.body.data.orders[0]?.totalCents).toBe(1300);
  });

  it('下单后改菜品价格，历史订单仍按快照显示', async () => {
    await addItems(token, [{ dishId: 'd-chuan-1', qty: 1 }]);
    const created = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    const orderId = created.body.data.orders[0]?.id as string;

    ctx.db.prepare('UPDATE dishes SET price_cents = 9900 WHERE id = ?').run('d-chuan-1');

    const detail = await ctx.call<DataResponse<{ order: OrderView }>>(`/orders/${orderId}`, { token });
    expect(detail.body.data.order.items[0]?.priceCents).toBe(1600);
    expect(detail.body.data.order.totalCents).toBe(1700);
  });
});

describe('提交订单 · 下单瞬间的二次可售校验（SPEC AC-09）', () => {
  it('加购后菜品被置为售罄时整单被拒绝，且不产生订单', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    ctx.db.prepare("UPDATE dishes SET status = 'sold_out' WHERE id = ?").run('d-noodle-1');
    const before = countOrders();

    const response = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });

    expect(response.status).toBe(409);
    const body = response.body as { error: { code: string; details: { dishId: string }[] } };
    expect(body.error.code).toBe('CART_HAS_UNAVAILABLE_DISH');
    expect(body.error.details[0]?.dishId).toBe('d-noodle-1');
    expect(countOrders()).toBe(before);

    ctx.db.prepare("UPDATE dishes SET status = 'on_sale' WHERE id = ?").run('d-noodle-1');
  });
});

describe('提交订单 · 下单后清车（SPEC AC-10）', () => {
  it('已下单的菜品从购物车移除，未下单的保留', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });

    expect((await cartOf(token)).count).toBe(0);
  });
});

describe('订单状态 · 读时收敛与日志幂等（SPEC AC-11 / AC-12）', () => {
  it('25 秒后查询推进到备餐中，且只写一条日志', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const created = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    const order = created.body.data.orders[0] as OrderView;

    const paidAtMs = Date.parse(order.paidAt);
    timeTravelOrder(ctx, order.id, paidAtMs - 26_000, paidAtMs - 1_000);

    const first = await ctx.call<DataResponse<{ order: OrderView }>>(`/orders/${order.id}`, { token });
    const second = await ctx.call<DataResponse<{ order: OrderView }>>(`/orders/${order.id}`, { token });

    expect(first.body.data.order.status).toBe('preparing');
    expect(second.body.data.order.status).toBe('preparing');

    const logs = ctx.db
      .prepare("SELECT * FROM order_status_logs WHERE order_id = ? AND to_status = 'preparing'")
      .all(order.id) as { id: number }[];
    expect(logs).toHaveLength(1);
  });

  it('列表接口同样会推进状态（不存在无人访问就永远停住的分支）', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const created = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    const order = created.body.data.orders[0] as OrderView;

    const paidAtMs = Date.parse(order.paidAt);
    timeTravelOrder(ctx, order.id, paidAtMs - 80_000, paidAtMs - 55_000);

    const list = await ctx.call<DataResponse<{ orders: OrderView[] }>>('/orders', { token });
    const found = list.body.data.orders.find((item) => item.id === order.id);
    expect(found?.status).toBe('ready');
  });
});

describe('取消订单 · 25 秒窗口（SPEC AC-13 / AC-14）', () => {
  it('窗口内取消成功并写入 cancelled_at', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const created = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    const order = created.body.data.orders[0] as OrderView;

    const paidAtMs = Date.parse(order.paidAt);
    timeTravelOrder(ctx, order.id, paidAtMs - 24_000, paidAtMs + 1_000);

    const response = await ctx.call<DataResponse<{ order: OrderView }>>(
      `/orders/${order.id}/cancel`,
      { method: 'POST', token },
    );

    expect(response.status).toBe(200);
    expect(response.body.data.order.status).toBe('cancelled');

    const row = ctx.db
      .prepare('SELECT status, cancelled_at FROM orders WHERE id = ?')
      .get(order.id) as { status: string; cancelled_at: string | null } | undefined;
    expect(row?.status).toBe('cancelled');
    expect(row?.cancelled_at).not.toBeNull();
  });

  it('超过 25 秒取消被拒绝，状态保持备餐中', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const created = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    const order = created.body.data.orders[0] as OrderView;

    const paidAtMs = Date.parse(order.paidAt);
    timeTravelOrder(ctx, order.id, paidAtMs - 26_000, paidAtMs - 1_000);

    const response = await ctx.call(`/orders/${order.id}/cancel`, { method: 'POST', token });

    expect(response.status).toBe(409);
    expect((response.body as { error: { code: string } }).error.code).toBe('CANCEL_WINDOW_CLOSED');

    const row = ctx.db.prepare('SELECT status FROM orders WHERE id = ?').get(order.id) as
      | { status: string }
      | undefined;
    expect(row?.status).toBe('preparing');
  });

  it('已取消的订单不能再次取消', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const created = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    const order = created.body.data.orders[0] as OrderView;

    await ctx.call(`/orders/${order.id}/cancel`, { method: 'POST', token });
    const again = await ctx.call(`/orders/${order.id}/cancel`, { method: 'POST', token });

    expect(again.status).toBe(409);
    expect(['ORDER_NOT_CANCELLABLE', 'CANCEL_WINDOW_CLOSED']).toContain(
      (again.body as { error: { code: string } }).error.code,
    );
  });
});

describe('订单状态 · 不存在让客户端指定目标状态的入口（SPEC AC-12）', () => {
  it('任何试图直接改状态的请求都落到 404（接口层不存在该能力）', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const created = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    const orderId = created.body.data.orders[0]?.id as string;

    const put = await ctx.call(`/orders/${orderId}`, {
      method: 'PUT',
      token,
      body: { status: 'completed' },
    });
    const patch = await ctx.call(`/orders/${orderId}`, {
      method: 'PATCH',
      token,
      body: { status: 'completed' },
    });
    const advance = await ctx.call(`/orders/${orderId}/advance`, {
      method: 'POST',
      token,
      body: { to: 'completed' },
    });

    for (const response of [put, patch, advance]) {
      expect(response.status).toBe(404);
    }

    const row = ctx.db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as
      | { status: string }
      | undefined;
    expect(row?.status).toBe('paid');
  });
});

describe('订单归属（SPEC AC-15 / AC-16）', () => {
  it('查看他人订单返回 403 FORBIDDEN_ORDER', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const created = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    const orderId = created.body.data.orders[0]?.id as string;

    const response = await ctx.call(`/orders/${orderId}`, { token: otherToken });

    expect(response.status).toBe(403);
    expect((response.body as { error: { code: string } }).error.code).toBe('FORBIDDEN_ORDER');
  });

  it('取消他人订单返回 403，且订单状态不变', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    const created = await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });
    const orderId = created.body.data.orders[0]?.id as string;

    const response = await ctx.call(`/orders/${orderId}/cancel`, {
      method: 'POST',
      token: otherToken,
    });

    expect(response.status).toBe(403);
    const row = ctx.db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as
      | { status: string }
      | undefined;
    expect(row?.status).toBe('paid');
  });

  it('未携带 token 访问购物车与订单返回 401', async () => {
    expect((await ctx.call('/cart')).status).toBe(401);
    expect((await ctx.call('/orders')).status).toBe(401);
    expect((await ctx.call('/orders', { method: 'POST', body: { address: '东门菜鸟驿站' } })).status).toBe(401);
  });

  it('订单列表只包含本人订单', async () => {
    await addItems(token, [{ dishId: 'd-noodle-1', qty: 1 }]);
    await submitOrder(token, { address: '菜鸟驿站 3 号楼 门口' });

    const mine = await ctx.call<DataResponse<{ orders: OrderView[] }>>('/orders', { token });
    const others = await ctx.call<DataResponse<{ orders: OrderView[] }>>('/orders', {
      token: otherToken,
    });

    expect(mine.body.data.orders.length).toBeGreaterThan(0);
    expect(others.body.data.orders).toHaveLength(0);
  });
});
