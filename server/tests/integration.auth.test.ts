import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loginAs, startTestServer, type TestContext } from './helpers.js';
import type { SessionUser } from '../src/domain/authService.js';
import type { DishView, StallSummary } from '../src/domain/types.js';

let ctx: TestContext;

beforeAll(async () => {
  ctx = await startTestServer();
});

afterAll(async () => {
  await ctx.close();
});

describe('登录（SPEC Non-Goals 第 6 条：只校验学号）', () => {
  it('已存在的学号登录成功并返回 token', async () => {
    const response = await ctx.call<{ data: { token: string; user: SessionUser } }>('/auth/login', {
      method: 'POST',
      body: { studentNo: '2021001' },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.token).toMatch(/[0-9a-f-]{36}/);
    expect(response.body.data.user.name).toBe('林可');
  });

  it('新学号自动建档，姓名缺省为「同学 + 后四位」', async () => {
    const response = await ctx.call<{ data: { user: SessionUser } }>('/auth/login', {
      method: 'POST',
      body: { studentNo: '2026999' },
    });

    expect(response.status).toBe(201);
    expect(response.body.data.user.name).toBe('同学6999');
  });

  it('学号格式非法返回 INVALID_STUDENT_NO', async () => {
    const response = await ctx.call<{ error: { code: string } }>('/auth/login', {
      method: 'POST',
      body: { studentNo: 'abc' },
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('INVALID_STUDENT_NO');
  });

  it('/auth/me 需要 token', async () => {
    const token = await loginAs(ctx, '2021001');
    const me = await ctx.call<{ data: { user: SessionUser } }>('/auth/me', { token });
    expect(me.body.data.user.studentNo).toBe('2021001');

    const anonymous = await ctx.call('/auth/me');
    expect(anonymous.status).toBe(401);
  });

  it('登出后 token 失效', async () => {
    const token = await loginAs(ctx, '2021002');
    await ctx.call('/auth/logout', { method: 'POST', token });

    const me = await ctx.call('/auth/me', { token });
    expect(me.status).toBe(401);
  });
});

describe('目录（SPEC R1）', () => {
  it('档口列表包含 6 家档口与统计字段', async () => {
    const response = await ctx.call<{ data: { stalls: StallSummary[] } }>('/stalls');
    const stalls = response.body.data.stalls;

    expect(stalls).toHaveLength(6);
    expect(stalls[0]?.name).toBe('川味小炒');
    expect(stalls[0]?.dishCount).toBe(4);
    expect(stalls[0]?.soldOutCount).toBe(1);
  });

  it('关键字可以命中菜品名（找菜）', async () => {
    const response = await ctx.call<{ data: { stalls: StallSummary[] } }>(
      `/stalls?keyword=${encodeURIComponent('牛肉面')}`,
    );
    expect(response.body.data.stalls.map((stall) => stall.name)).toEqual(['面点档']);
  });

  it('filter=hasSoldOut 只返回有售罄菜品的档口', async () => {
    const response = await ctx.call<{ data: { stalls: StallSummary[] } }>(
      '/stalls?filter=hasSoldOut',
    );
    expect(response.body.data.stalls.length).toBeGreaterThan(0);
    expect(response.body.data.stalls.every((stall) => stall.soldOutCount > 0)).toBe(true);
  });

  it('档口详情返回菜品与可售标记', async () => {
    const response = await ctx.call<{ data: { stall: StallSummary; dishes: DishView[] } }>(
      '/stalls/st-chuan',
    );
    const dishes = response.body.data.dishes;

    expect(dishes).toHaveLength(4);
    expect(dishes.find((dish) => dish.id === 'd-chuan-2')?.available).toBe(false);
    expect(dishes.find((dish) => dish.id === 'd-chuan-1')?.priceCents).toBe(1600);
  });

  it('不存在的档口返回 404', async () => {
    const response = await ctx.call('/stalls/st-nope');
    expect(response.status).toBe(404);
  });

  it('未知接口返回 JSON 404 而不是 HTML', async () => {
    const response = await ctx.call('/nope');
    expect(response.status).toBe(404);
    expect((response.body as { error: { code: string } }).error.code).toBe('NOT_FOUND');
  });
});
