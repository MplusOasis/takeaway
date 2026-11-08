export type DishStatus = 'on_sale' | 'sold_out' | 'off_shelf';

export const ORDER_STATUSES = ['paid', 'preparing', 'ready', 'completed', 'cancelled'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  paid: '已支付',
  preparing: '备餐中',
  ready: '待取餐',
  completed: '已完成',
  cancelled: '已取消',
};

/* ---------------------------------- 数据行 ---------------------------------- */

export interface UserRow {
  id: string;
  student_no: string;
  name: string;
  created_at: string;
}

export interface StallRow {
  id: string;
  name: string;
  zone: string;
  description: string | null;
  is_open: number;
  prep_minutes: number;
  sort: number;
}

export interface DishRow {
  id: string;
  stall_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  status: DishStatus;
  sort: number;
}

export interface CartRow {
  id: string;
  user_id: string;
  dish_id: string;
  qty: number;
  created_at: string;
}

export interface OrderRow {
  id: string;
  code: string;
  user_id: string;
  stall_id: string;
  stall_name: string;
  status: OrderStatus;
  items_total_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  address: string;
  remark: string | null;
  paid_at: string;
  cancel_deadline: string;
  cancelled_at: string | null;
  created_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  dish_id: string;
  name_snapshot: string;
  price_cents_snapshot: number;
  qty: number;
}

export interface StatusLogRow {
  id: number;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  at: string;
}

/* ---------------------------------- 视图对象 -------------------------------- */

export interface DishView {
  id: string;
  stallId: string;
  name: string;
  description: string | null;
  priceCents: number;
  status: DishStatus;
  available: boolean;
}

export interface StallSummary {
  id: string;
  name: string;
  zone: string;
  description: string | null;
  isOpen: boolean;
  prepMinutes: number;
  dishCount: number;
  availableCount: number;
  soldOutCount: number;
  minPriceCents: number | null;
}

export interface CartItemView {
  dishId: string;
  name: string;
  priceCents: number;
  qty: number;
  subtotalCents: number;
  stallId: string;
  stallName: string;
  status: DishStatus;
  available: boolean;
}

export interface CartGroupView {
  stallId: string;
  stallName: string;
  items: CartItemView[];
  itemsTotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
}

export interface CartIssue {
  dishId: string;
  name: string;
  status: DishStatus;
  reason: string;
}

export interface CartView {
  groups: CartGroupView[];
  count: number;
  totals: {
    itemsTotalCents: number;
    deliveryFeeCents: number;
    totalCents: number;
  };
  issues: CartIssue[];
  freeDeliveryThresholdCents: number;
}

export interface OrderItemView {
  dishId: string;
  name: string;
  priceCents: number;
  qty: number;
}

export interface TimelineEntry {
  status: OrderStatus;
  label: string;
  at: string | null;
}

export interface OrderView {
  id: string;
  code: string;
  stallId: string;
  stallName: string;
  status: OrderStatus;
  statusLabel: string;
  itemsTotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  address: string;
  remark: string | null;
  paidAt: string;
  cancelDeadline: string;
  cancellable: boolean;
  cancelRemainingMs: number;
  items: OrderItemView[];
  timeline: TimelineEntry[];
  freeDeliveryThresholdCents: number;
}
