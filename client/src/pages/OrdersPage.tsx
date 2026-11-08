import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../api/client';
import type { OrderView } from '../api/types';
import { OrderTicket } from '../components/OrderTicket';

export function OrdersPage() {
  const [orders, setOrders] = useState<OrderView[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await apiRequest<{ orders: OrderView[] }>('/orders');
        if (!cancelled) {
          setOrders(data.orders);
          setError(null);
        }
      } catch {
        if (!cancelled) setError('订单加载失败，请刷新页面');
      }
    };

    void load();
    const timer = window.setInterval(() => void load(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const active = orders?.filter((order) => order.status === 'paid' || order.status === 'preparing' || order.status === 'ready') ?? [];
  const history = orders?.filter((order) => order.status === 'completed' || order.status === 'cancelled') ?? [];

  return (
    <main className="relative z-10 mx-auto max-w-[880px] px-6 py-7">
      <header className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-[26px] tracking-display">我的订单</h1>
          <p className="mt-1 text-[12px] text-muted">状态由服务端按时间推进，每 5 秒自动刷新</p>
        </div>
        <Link to="/" className="btn btn--ghost btn--sm">
          去点餐
        </Link>
      </header>

      {error ? (
        <p role="alert" className="rounded-card bg-paper-3 px-4 py-3 text-[13px] text-accent-deep">
          {error}
        </p>
      ) : null}

      {orders === null && !error ? (
        <p className="py-16 text-center text-[13px] text-muted">正在取订单…</p>
      ) : null}

      {orders !== null && orders.length === 0 ? (
        <div className="card px-8 py-14 text-center">
          <p className="font-display text-[19px] tracking-display">还没有订单</p>
          <p className="mt-1.5 text-[13px] text-muted">挑一个档口，先点第一单</p>
          <Link to="/" className="btn btn--primary mt-6">
            去点餐
          </Link>
        </div>
      ) : null}

      {active.length > 0 ? (
        <section className="mb-6">
          <h2 className="label mb-2 text-[10px] uppercase text-muted">进行中 · {active.length}</h2>
          <div className="flex flex-col gap-2.5">
            {active.map((order) => (
              <OrderTicket key={order.id} order={order} />
            ))}
          </div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section>
          <h2 className="label mb-2 text-[10px] uppercase text-muted">已结束 · {history.length}</h2>
          <div className="flex flex-col gap-2.5">
            {history.map((order) => (
              <OrderTicket key={order.id} order={order} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
