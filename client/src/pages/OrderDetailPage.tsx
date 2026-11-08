import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import type { OrderView } from '../api/types';
import { CancelCountdown } from '../components/CancelCountdown';
import { StatusTimeline } from '../components/StatusTimeline';
import { shortDateTime, yuan } from '../lib/format';
import { tintStyle } from '../lib/tint';

const ACTIVE: string[] = ['paid', 'preparing', 'ready'];

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiRequest<{ order: OrderView }>(`/orders/${id}`);
      setOrder(data.order);
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '订单加载失败');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = order?.status ?? '';
  useEffect(() => {
    if (!ACTIVE.includes(status)) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [status, load]);

  const cancel = async () => {
    if (!order || pending) return;
    setPending(true);
    setNotice(null);
    try {
      const data = await apiRequest<{ order: OrderView }>(`/orders/${order.id}/cancel`, {
        method: 'POST',
      });
      setOrder(data.order);
      setNotice('已取消，这单不会再出餐');
    } catch (cause) {
      setNotice(cause instanceof ApiError ? cause.message : '取消失败，请重试');
      await load();
    } finally {
      setPending(false);
    }
  };

  if (error) {
    return (
      <main className="relative z-10 mx-auto max-w-[760px] px-6 py-16 text-center">
        <h1 className="font-display text-[22px] tracking-display">看不到这个订单</h1>
        <p className="mt-2 text-[13px] text-muted">{error}</p>
        <Link to="/orders" className="btn mt-6">
          回到我的订单
        </Link>
      </main>
    );
  }

  if (!order) {
    return (
      <main className="relative z-10 mx-auto max-w-[760px] px-6 py-16 text-center text-[13px] text-muted">
        正在取订单…
      </main>
    );
  }

  const totalQty = order.items.reduce((sum, item) => sum + item.qty, 0);

  return (
    <main className="relative z-10 mx-auto max-w-[880px] px-6 py-7">
      <div className="mb-4 flex items-center justify-between">
        <Link to="/orders" className="btn btn--ghost btn--sm">
          ← 我的订单
        </Link>
        <span className="label text-[11px] text-muted">下单于 {shortDateTime(order.paidAt)}</span>
      </div>

      <section style={tintStyle(order.stallId)} className="card overflow-hidden">
        <header className="plastic px-6 py-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="label text-[10px] uppercase text-ink-2">订单 {order.code}</div>
              <h1 className="mt-1 font-display text-[26px] tracking-display">{order.stallName}</h1>
              <p className="mt-1 text-[12.5px] text-ink-2">
                {totalQty} 件商品 · 合计 <span className="label">{yuan(order.totalCents)}</span>
              </p>
            </div>

            <div className="text-right">
              <div className="font-display text-[19px] tracking-display">{order.statusLabel}</div>
              {order.cancellable ? (
                <div className="mt-1 flex items-center justify-end gap-2 text-accent-deep">
                  <span className="label text-[10.5px]">可取消剩余</span>
                  <CancelCountdown remainingMs={order.cancelRemainingMs} />
                </div>
              ) : (
                <div className="label mt-1 text-[10.5px] text-muted">
                  {order.status === 'paid' ? '取消窗口已关闭' : '当前状态不可取消'}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="border-b border-rule px-6 py-5">
          <StatusTimeline entries={order.timeline} current={order.status} />
        </div>

        <div className="grid grid-cols-2 gap-6 border-b border-rule px-6 py-5">
          <div>
            <h2 className="label text-[10px] uppercase text-muted">取餐信息</h2>
            <p className="mt-1.5 text-[13.5px]">{order.address}</p>
            {order.remark ? (
              <p className="mt-1 text-[12.5px] text-muted">备注：{order.remark}</p>
            ) : null}
          </div>
          <div>
            <h2 className="label text-[10px] uppercase text-muted">金额</h2>
            <dl className="mt-1.5 flex flex-col gap-1 text-[12.5px]">
              <div className="flex justify-between">
                <dt className="text-muted">菜品小计</dt>
                <dd className="label tabular-nums">{yuan(order.itemsTotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">配送费</dt>
                <dd className="label tabular-nums">{yuan(order.deliveryFeeCents)}</dd>
              </div>
              <div className="flex justify-between border-t border-dashed border-rule pt-1">
                <dt className="text-ink-2">合计</dt>
                <dd className="label font-medium tabular-nums">{yuan(order.totalCents)}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="px-6 py-5">
          <h2 className="label text-[10px] uppercase text-muted">明细</h2>
          <ul className="mt-2">
            {order.items.map((item) => (
              <li key={item.dishId} className="flex items-baseline justify-between py-1.5">
                <span className="text-[13.5px]">
                  {item.name}
                  <span className="label ml-2 text-[11px] text-muted">
                    {yuan(item.priceCents)} × {item.qty}
                  </span>
                </span>
                <span className="label text-[13px] tabular-nums text-ink-2">
                  {yuan(item.priceCents * item.qty)}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11.5px] text-muted">
            订单明细中的名称与单价为下单时刻的快照，档口后续改价不影响本单。
          </p>
        </div>

        <footer className="flex items-center justify-between gap-4 border-t border-rule bg-paper-2 px-6 py-4">
          <p className="text-[11.5px] text-muted">
            {notice ?? '取消后不可恢复；超过 25 秒后档口会开始备餐。'}
          </p>
          <button
            type="button"
            className="btn"
            disabled={!order.cancellable || pending}
            aria-disabled={!order.cancellable || pending}
            onClick={() => void cancel()}
          >
            {pending ? '正在取消…' : order.cancellable ? '取消订单' : '已不可取消'}
          </button>
        </footer>
      </section>
    </main>
  );
}
