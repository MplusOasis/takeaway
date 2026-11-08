/**
 * 业务规则的唯一数值来源。
 * 任何地方需要这些常量时从这里 import，禁止在别处写字面量（见 CODEBUDDY.md）。
 */

/** 下单后可取消窗口：25 秒（SPEC R8） */
export const CANCEL_WINDOW_MS = 25_000;

/** 状态推进里程碑（相对 paid_at 的毫秒数），逐级推进，见 domain/statusMachine.ts */
export const STATUS_MILESTONES_MS = {
  preparing: 25_000,
  ready: 75_000,
  completed: 180_000,
} as const;

/** 单档口配送费：¥1.00 */
export const DELIVERY_FEE_CENTS = 100;

/** 单档口满 ¥20.00 免配送费 */
export const FREE_DELIVERY_THRESHOLD_CENTS = 2_000;

/** 配送地址去除首尾空格后的最小长度（SPEC R4） */
export const MIN_ADDRESS_LENGTH = 5;

/** 单次加购数量上限，防止误触把数量写成 9999 */
export const MAX_ITEM_QTY = 20;

export const DEFAULT_PORT = 5174;
export const DEFAULT_DB_PATH = 'server/data/takeaway.db';
