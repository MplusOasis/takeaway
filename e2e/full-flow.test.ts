import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase } from '../server/src/db/connection.js';
import type { CartView, OrderView, StallSummary } from '../server/src/domain/types.js';

const PORT = 5311;
const BASE = `http://127.0.0.1:${PORT}/api`;
const workDir = mkdtempSync(join(tmpdir(), 'takeaway-e2e-'));
const dbPath = join(workDir, 'e2e.db');

let child: ChildProcess;
let token = '';
let otherToken = '';

interface ApiResult<T> {
  status: number;
  body: T;
}

async function call<T>(
  path: string,
  init: { method?: string; body?: unknown; token?: string } = {},
): Promise<ApiResult<T>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (init.token) headers.Authorization = `Bearer ${init.token}`;
  const response = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

async function waitForHealth(timeoutMs = 25_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return;
    } catch {
      // 还没起来，继续等
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error('后端进程在超时时间内没有就绪');
}

beforeAll(async () => {
  child = spawn(
    process.execPath,
    ['--import', 'tsx', '--no-warnings', 'server/src/index.ts'],
    {
      cwd: process.cwd(),
      env: { ...process.env, PORT: String(PORT), DB_PATH: dbPath },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stderr?.on('data', (chunk) => {
    const text = chunk.toString();
    if (!text.includes('ExperimentalWarning')) process.stderr.write(`[e2e server] ${text}`);
  });

  await waitForHealth();

  const lin = await call<{ data: { token: string } }>('/auth/login', {
    method: 'POST',
    body: { studentNo: '2021001', name: '林可' },
  });
  token = lin.body.data.token;

  const zhou = await call<{ data: { token: string } }>('/auth/login', {
    method: 'POST',
    body: { studentNo: '2021002', name: '周小满' },
  });
  otherToken = zhou.body.data.token;
});

afterAll(async () => {
  if (child && !child.killed) {
    child.kill();
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  rmSync(workDir, { recursive: true, force: true });
});

describe('E2E · 跨店加购 → 提交订单 → 查看订单 → 取消（真实进程 + 真实 SQLite 文件）', () => {
  let createdOrders: OrderView[] = [];

  it('登录后能读到档口列表', async () => {
    const response = await call<{ data: { stalls: StallSummary[] } }>('/stalls');
    expect(response.status).toBe(200);
    expect(response.body.data.stalls).toHaveLength(6);
  });

  it('跨两家档口加购，购物车可读回分组', async () => {
    const items = [
      { dishId: 'd-noodle-1', qty: 2 },
      { dishId: 'd-chuan-1', qty: 1 },
      { dishId: 'd-chuan-3', qty: 1 },
    ];
    for (const item of items) {
      const response = await call('/cart/items', { method: 'POST', body: item, token });
      expect(response.status).toBe(201);
    }

    const cart = await call<{ data: { cart: CartView } }>('/cart', { token });
    expect(cart.body.data.cart.groups).toHaveLength(2);
    expect(cart.body.data.cart.totals.totalCents).toBe(2500 + 1300);
  });

  it('售罄菜品加购被服务端拒绝', async () => {
    const response = await call<{ error: { code: string } }>('/cart/items', {
      method: 'POST',
      body: { dishId: 'd-chuan-2', qty: 1 },
      token,
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('DISH_NOT_AVAILABLE');
  });

  it('提交订单生成两笔按档口拆分的订单', async () => {
    const response = await call<{ data: { orders: OrderView[] } }>('/orders', {
      method: 'POST',
      body: { address: '菜鸟驿站 3 号楼 门口', remark: '少辣' },
      token,
    });

    expect(response.status).toBe(201);
    createdOrders = response.body.data.orders;
    expect(createdOrders).toHaveLength(2);
    expect(createdOrders.every((order) => order.status === 'paid')).toBe(true);
  });

  it('订单列表能查到刚下的两单，购物车已清空', async () => {
    const list = await call<{ data: { orders: OrderView[] } }>('/orders', { token });
    expect(list.body.data.orders).toHaveLength(2);

    const cart = await call<{ data: { cart: CartView } }>('/cart', { token });
    expect(cart.body.data.cart.count).toBe(0);
  });

  it('订单详情带状态时间线与价格快照', async () => {
    const first = createdOrders[0] as OrderView;
    const detail = await call<{ data: { order: OrderView } }>(`/orders/${first.id}`, { token });
    const order = detail.body.data.order;

    expect(order.status).toBe('paid');
    expect(order.cancellable).toBe(true);
    expect(order.remark).toBe('少辣');
    expect(order.timeline[0]?.at).not.toBeNull();
    expect(order.items.length).toBeGreaterThan(0);
  });

  it('他人无法查看这笔订单', async () => {
    const first = createdOrders[0] as OrderView;
    const response = await call<{ error: { code: string } }>(`/orders/${first.id}`, {
      token: otherToken,
    });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN_ORDER');
  });

  it('窗口内取消成功，另一单不受影响', async () => {
    const [first, second] = createdOrders as [OrderView, OrderView];

    const cancelled = await call<{ data: { order: OrderView } }>(`/orders/${first.id}/cancel`, {
      method: 'POST',
      token,
    });
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.data.order.status).toBe('cancelled');

    const untouched = await call<{ data: { order: OrderView } }>(`/orders/${second.id}`, { token });
    expect(untouched.body.data.order.status).toBe('paid');
  });

  it('数据库文件里确实写入订单、明细与状态日志', () => {
    expect(existsSync(dbPath)).toBe(true);
    const db = openDatabase(dbPath);
    try {
      const orders = db.prepare('SELECT COUNT(*) AS count FROM orders').get() as { count: number };
      const items = db.prepare('SELECT COUNT(*) AS count FROM order_items').get() as { count: number };
      const logs = db
        .prepare('SELECT COUNT(*) AS count FROM order_status_logs')
        .get() as { count: number };
      const cart = db
        .prepare('SELECT COUNT(*) AS count FROM cart_items')
        .get() as { count: number };

      expect(orders.count).toBe(2);
      expect(items.count).toBe(3); // 面点档 1 行 + 川味小炒 2 行
      expect(logs.count).toBeGreaterThanOrEqual(3); // 2 条 paid + 1 条 cancelled
      expect(cart.count).toBe(0);
    } finally {
      db.close();
    }
  });
});
