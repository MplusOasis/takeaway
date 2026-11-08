import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiRequest } from '../api/client';
import type { CartView } from '../api/types';
import { useAuth } from './AuthContext';

interface CartContextValue {
  cart: CartView | null;
  loading: boolean;
  refresh: () => Promise<void>;
  add: (dishId: string, qty?: number) => Promise<void>;
  setQty: (dishId: string, qty: number) => Promise<void>;
  remove: (dishId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const EMPTY_CART: CartView = {
  groups: [],
  count: 0,
  totals: { itemsTotalCents: 0, deliveryFeeCents: 0, totalCents: 0 },
  issues: [],
  freeDeliveryThresholdCents: 2000,
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartView | null>(null);
  const [loading, setLoading] = useState(false);

  const apply = useCallback((next: CartView) => setCart(next), []);

  const refresh = useCallback(async () => {
    if (!user) {
      setCart(null);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<{ cart: CartView }>('/cart');
      apply(data.cart);
    } finally {
      setLoading(false);
    }
  }, [user, apply]);

  useEffect(() => {
    if (!user) {
      setCart(null);
      return;
    }
    void refresh();
  }, [user, refresh]);

  const add = useCallback(
    async (dishId: string, qty = 1) => {
      const data = await apiRequest<{ cart: CartView }>('/cart/items', {
        method: 'POST',
        body: { dishId, qty },
      });
      apply(data.cart);
    },
    [apply],
  );

  const setQty = useCallback(
    async (dishId: string, qty: number) => {
      const data = await apiRequest<{ cart: CartView }>(`/cart/items/${dishId}`, {
        method: 'PATCH',
        body: { qty },
      });
      apply(data.cart);
    },
    [apply],
  );

  const remove = useCallback(
    async (dishId: string) => {
      const data = await apiRequest<{ cart: CartView }>(`/cart/items/${dishId}`, {
        method: 'DELETE',
      });
      apply(data.cart);
    },
    [apply],
  );

  const clear = useCallback(async () => {
    const data = await apiRequest<{ cart: CartView }>('/cart', { method: 'DELETE' });
    apply(data.cart);
  }, [apply]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart: cart ?? (user ? null : EMPTY_CART),
      loading,
      refresh,
      add,
      setQty,
      remove,
      clear,
    }),
    [cart, user, loading, refresh, add, setQty, remove, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart 必须在 CartProvider 内使用');
  return context;
}
