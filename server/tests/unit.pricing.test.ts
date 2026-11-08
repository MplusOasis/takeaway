import { describe, expect, it } from 'vitest';
import { deliveryFeeFor, sumLines, totalsFor } from '../src/domain/pricing.js';
import { CANCEL_WINDOW_MS, DELIVERY_FEE_CENTS, FREE_DELIVERY_THRESHOLD_CENTS } from '../src/config.js';

describe('pricing · 配送费与总额（SPEC R5 / AC-06）', () => {
  it('单档口未满 ¥20 收 ¥1.00 配送费', () => {
    expect(deliveryFeeFor(1200)).toBe(DELIVERY_FEE_CENTS);
    expect(totalsFor(1200)).toEqual({
      itemsTotalCents: 1200,
      deliveryFeeCents: 100,
      totalCents: 1300,
    });
  });

  it('单档口满 ¥20 免配送费', () => {
    expect(deliveryFeeFor(2500)).toBe(0);
    expect(totalsFor(2500)).toEqual({
      itemsTotalCents: 2500,
      deliveryFeeCents: 0,
      totalCents: 2500,
    });
  });

  it('恰好等于阈值时免配送费（边界用 >= 而非 >）', () => {
    expect(deliveryFeeFor(FREE_DELIVERY_THRESHOLD_CENTS)).toBe(0);
    expect(deliveryFeeFor(FREE_DELIVERY_THRESHOLD_CENTS - 1)).toBe(DELIVERY_FEE_CENTS);
  });

  it('空车不产生配送费', () => {
    expect(deliveryFeeFor(0)).toBe(0);
    expect(totalsFor(0).totalCents).toBe(0);
  });

  it('整数「分」相加不产生浮点误差', () => {
    const total = sumLines([
      { priceCents: 1600, qty: 1 },
      { priceCents: 900, qty: 1 },
    ]);
    expect(total).toBe(2500);
    expect(Number.isInteger(total)).toBe(true);
  });

  it('取消窗口常量为 25 秒（SPEC R8）', () => {
    expect(CANCEL_WINDOW_MS).toBe(25_000);
  });
});
