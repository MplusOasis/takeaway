import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { useCart } from '../state/CartContext';
import { yuan } from '../lib/format';
import { tintStyle } from '../lib/tint';

export function CartPanel() {
  const { cart, setQty, remove, loading } = useCart();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const changeQty = async (dishId: string, qty: number) => {
    setBusyId(dishId);
    setError(null);
    try {
      await setQty(dishId, qty);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '操作失败，请重试');
    } finally {
      setBusyId(null);
    }
  };

  const dropIssue = async (dishId: string) => {
    setBusyId(dishId);
    setError(null);
    try {
      await remove(dishId);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : '操作失败，请重试');
    } finally {
      setBusyId(null);
    }
  };

  const count = cart?.count ?? 0;
  const hasIssues = (cart?.issues.length ?? 0) > 0;

  return (
    <aside className="sticky top-[88px] flex max-h-[calc(100vh-112px)] flex-col rounded-card border border-rule bg-paper shadow-card">
      <div className="flex items-baseline justify-between border-b border-rule px-4 py-3">
        <h2 className="font-display text-[16px] tracking-display">这一单</h2>
        <span className="label text-[11px] text-muted">{count} 件 · {cart?.groups.length ?? 0} 家档口</span>
      </div>

      <div className="scroll-area min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {loading && !cart ? <p className="px-1 py-6 text-center text-[13px] text-muted">正在读购物车…</p> : null}

        {!loading && (!cart || cart.groups.length === 0) ? (
          <div className="px-2 py-10 text-center">
            <p className="font-display text-[15px] tracking-display text-ink-2">还没选菜</p>
            <p className="mt-1 text-[12.5px] text-muted">左边挑档口，中间点菜，这里会算钱</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2.5">
          {cart?.groups.map((group) => (
            <section key={group.stallId} style={tintStyle(group.stallId)} className="plastic rounded-card px-2.5 py-2">
              <header className="flex items-baseline justify-between px-1 pb-1.5">
                <span className="font-display text-[13px] tracking-display">{group.stallName}</span>
                <span className="label text-[10.5px] text-ink-2">
                  {group.deliveryFeeCents === 0 ? '免配送费' : `配送 ${yuan(group.deliveryFeeCents)}`}
                </span>
              </header>

              <ul className="flex flex-col gap-1">
                {group.items.map((item) => (
                  <li
                    key={item.dishId}
                    className="rounded-[9px] bg-paper px-2 py-1.5 shadow-[inset_0_0_0_1px_var(--color-rule)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={[
                          'truncate text-[13px]',
                          item.available ? 'text-ink' : 'text-muted line-through',
                        ].join(' ')}
                      >
                        {item.name}
                      </span>
                      <span className="label shrink-0 text-[12px] tabular-nums text-ink-2">
                        {yuan(item.subtotalCents)}
                      </span>
                    </div>

                    {item.available ? (
                      <div className="mt-1 flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`减少 ${item.name}`}
                          className="grid h-6 w-6 place-items-center rounded-[7px] border border-rule bg-paper text-[13px] leading-none text-ink-2 hover:border-accent-deep"
                          disabled={busyId === item.dishId}
                          onClick={() => void changeQty(item.dishId, item.qty - 1)}
                        >
                          −
                        </button>
                        <span className="label w-6 text-center text-[12px] tabular-nums">{item.qty}</span>
                        <button
                          type="button"
                          aria-label={`增加 ${item.name}`}
                          className="grid h-6 w-6 place-items-center rounded-[7px] border border-rule bg-paper text-[13px] leading-none text-ink-2 hover:border-accent-deep"
                          disabled={busyId === item.dishId || item.qty >= 20}
                          onClick={() => void changeQty(item.dishId, item.qty + 1)}
                        >
                          +
                        </button>
                        <span className="label ml-auto text-[10.5px] text-muted">
                          单价 {yuan(item.priceCents)}
                        </span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="mt-1 label text-[10.5px] text-accent-deep underline decoration-dotted"
                        onClick={() => void dropIssue(item.dishId)}
                      >
                        已不可售，移除
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {hasIssues ? (
          <p className="mt-2 rounded-[9px] bg-paper-3 px-2.5 py-2 text-[12px] text-ink-2">
            购物车里有 {cart?.issues.length} 道菜已售罄或下架，移除后才能提交订单。
          </p>
        ) : null}

        {error ? (
          <p role="alert" className="mt-2 rounded-[9px] bg-paper-3 px-2.5 py-2 text-[12px] text-accent-deep">
            {error}
          </p>
        ) : null}
      </div>

      <footer className="border-t border-rule px-4 py-3">
        <div className="flex items-baseline justify-between text-[12px] text-muted">
          <span>菜品小计</span>
          <span className="label tabular-nums">{yuan(cart?.totals.itemsTotalCents ?? 0)}</span>
        </div>
        <div className="mt-1 flex items-baseline justify-between text-[12px] text-muted">
          <span>配送费</span>
          <span className="label tabular-nums">{yuan(cart?.totals.deliveryFeeCents ?? 0)}</span>
        </div>
        <div className="mt-2 flex items-baseline justify-between border-t border-dashed border-rule pt-2">
          <span className="text-[13px] text-ink-2">合计</span>
          <span className="font-display text-[20px] tabular-nums tracking-display">
            {yuan(cart?.totals.totalCents ?? 0)}
          </span>
        </div>

        <button
          type="button"
          className="btn btn--primary mt-3 w-full"
          disabled={count === 0 || hasIssues}
          onClick={() => navigate('/checkout')}
        >
          {hasIssues ? '先移除不可售菜品' : count === 0 ? '还没选菜' : `去结算 · ${count} 件`}
        </button>
        <p className="mt-2 text-center text-[11px] text-muted">
          满 {yuan(cart?.freeDeliveryThresholdCents ?? 2000)} 免配送费（按档口计）
        </p>
      </footer>
    </aside>
  );
}
