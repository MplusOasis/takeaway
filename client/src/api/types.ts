export type DishStatus = 'on_sale' | 'sold_out' | 'off_shelf';
export type OrderStatus = 'paid' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface SessionUser {
  id: string;
  studentNo: string;
  name: string;
}

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
