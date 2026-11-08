import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app.js';
import { openDatabase, type Db } from '../src/db/connection.js';
import { seedIfEmpty } from '../src/db/seed.js';

export interface ApiResponse<T = unknown> {
  status: number;
  body: T;
}

export interface TestContext {
  db: Db;
  url: string;
  call: <T = unknown>(
    path: string,
    init?: { method?: string; body?: unknown; token?: string },
  ) => Promise<ApiResponse<T>>;
  close: () => Promise<void>;
}

/**
 * 每个测试文件起一套独立的「真实 HTTP + 真实 SQLite（内存库）」环境。
 * 不 mock 数据库：SQL 有问题必须让测试红。
 */
export async function startTestServer(): Promise<TestContext> {
  const db = openDatabase(':memory:');
  seedIfEmpty(db);
  const app = createApp(db);

  const server: Server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });

  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  const call = async <T = unknown>(
    path: string,
    init: { method?: string; body?: unknown; token?: string } = {},
  ): Promise<ApiResponse<T>> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (init.token) headers.Authorization = `Bearer ${init.token}`;
    const response = await fetch(`${url}/api${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: (text ? JSON.parse(text) : null) as T,
    };
  };

  const close = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    db.close();
  };

  return { db, url, call, close };
}

export async function loginAs(
  context: TestContext,
  studentNo: string,
  name?: string,
): Promise<string> {
  const response = await context.call<{ data: { token: string } }>('/auth/login', {
    method: 'POST',
    body: { studentNo, name },
  });
  if (response.status !== 201) {
    throw new Error(`登录失败：${JSON.stringify(response.body)}`);
  }
  return response.body.data.token;
}

/** 从数据库里把某笔订单的时间往前挪，用来验证「25 秒」这类时间窗口 */
export function timeTravelOrder(
  context: TestContext,
  orderId: string,
  paidAtMs: number,
  cancelDeadlineMs: number,
): void {
  context.db
    .prepare('UPDATE orders SET paid_at = ?, cancel_deadline = ?, created_at = ? WHERE id = ?')
    .run(
      new Date(paidAtMs).toISOString(),
      new Date(cancelDeadlineMs).toISOString(),
      new Date(paidAtMs).toISOString(),
      orderId,
    );
  const row = context.db
    .prepare('SELECT id FROM order_status_logs WHERE order_id = ? AND to_status = ?')
    .get(orderId, 'paid') as { id: number } | undefined;
  if (row) {
    context.db
      .prepare('UPDATE order_status_logs SET at = ? WHERE id = ?')
      .run(new Date(paidAtMs).toISOString(), row.id);
  }
}
