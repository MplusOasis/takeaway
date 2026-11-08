import { DELIVERY_FEE_CENTS, FREE_DELIVERY_THRESHOLD_CENTS } from '../config.js';

export interface PricedLine {
  priceCents: number;
  qty: number;
}

/** 商品小计：金额一律以「分」为单位做整数运算（ARCHITECTURE C4） */
export function sumLines(lines: PricedLine[]): number {
  return lines.reduce((sum, line) => sum + line.priceCents * line.qty, 0);
}

/**
 * 配送费：单档口满 ¥20.00 免配送费，否则 ¥1.00。
 * 恰好等于阈值时免配送费（`>=`，对应 SPEC AC-06 的 ¥25.00 档口）。
 */
export function deliveryFeeFor(itemsTotalCents: number): number {
  if (itemsTotalCents <= 0) return 0;
  return itemsTotalCents >= FREE_DELIVERY_THRESHOLD_CENTS ? 0 : DELIVERY_FEE_CENTS;
}

export interface OrderTotals {
  itemsTotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
}

export function totalsFor(itemsTotalCents: number): OrderTotals {
  const deliveryFeeCents = deliveryFeeFor(itemsTotalCents);
  return {
    itemsTotalCents,
    deliveryFeeCents,
    totalCents: itemsTotalCents + deliveryFeeCents,
  };
}
