import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from '../api/client';
import type { OrderView } from '../api/types';
import { Field } from '../components/Field';
import { yuan } from '../lib/format';
import { tintStyle } from '../lib/tint';
import { useCart } from '../state/CartContext';

const ADDRESS_KEY = 'takeaway.address';
const MIN_ADDRESS = 5;

export function CheckoutPage() {
  const { cart, refresh } = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState(() => window.localStorage.getItem(ADDRESS_KEY) ?? '');
  const [remark, setRemark] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [addressError, setAddressError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<OrderView[] | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;

    const trimmed = address.trim();
    if (trimmed.length < MIN_ADDRESS) {
      // AC-18：地址不合法时不发起请求
      setAddressError(`请填写配送地址（至少 ${MIN_ADDRESS} 个字）`);
      return;
    }
    setAddressError(null);
    setError(null);
    setPending(true);

    try {
      const data = await apiRequest<{ orders: OrderView[] }>('/orders', {
        method: 'POST',
        body: { address: trimmed, remark: remark.trim() || undefined },
      });
      window.localStorage.setItem(ADDRESS_KEY, trimmed);
      setCreated(data.orders);
      await refresh();
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
        if (cause.code === 'CART_HAS_UNAVAILABLE_DISH' || cause.code === 'CART_EMPTY') {
          await refresh();
        }
      } else {
        setError('提交失败，请稍后重试');
      }
    } finally {
      setPending(false);
    }
  };

  if (created) {
    return (
      <main className="relative z-10 mx-auto max-w-[760px] px-6 py-12">
        <div className="card px-8 py-9">
          <span className="stamp">已下单 · 模拟支付完成</span>
          <h1 className="mt-4 font-display text-[28px] tracking-display">
            {created.length > 1 ? '按档口拆成了 ' + created.length + ' 笔订单' : '这一单已经排上了'}
          </h1>
          <p className="mt-2 text-[13.5px] text-muted">
            25 秒内可在订单详情页取消；备餐开始后状态会自动往下走。
          </p>

          <ul className="mt-6 flex flex-col gap-2.5">
            {created.map((order) => (
              <li key={order.id} style={tintStyle(order.stallId)}>
                <Link
                  to={`/orders/${order.id}`}
                  className="plastic flex items-center justify-between rounded-card px-4 py-3 transition-shadow hover:shadow-lift"
                >
                  <div>
                    <div className="font-display text-[15px] tracking-display">{order.stallName}</div>
                    <div className="label mt-0.5 text-[11px] text-ink-2">{order.code}</div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="label text-[10.5px] text-muted">可取消</span>
                    <span className="font-display text-[18px] tabular-nums tracking-display">
                      {yuan(order.totalCents)}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex gap-3">
            <button type="button" className="btn btn--primary" onClick={() => navigate('/orders')}>
              去我的订单
            </button>
            <button type="button" className="btn btn--ghost" onClick={() => navigate('/')}>
              继续点菜
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!cart) {
    return (
      <main className="relative z-10 mx-auto max-w-[760px] px-6 py-16 text-center text-[13px] text-muted">
        正在读购物车…
      </main>
    );
  }

  if (cart.count === 0) {
    return (
      <main className="relative z-10 mx-auto max-w-[760px] px-6 py-16 text-center">
        <h1 className="font-display text-[24px] tracking-display">购物车是空的</h1>
        <p className="mt-2 text-[13px] text-muted">回去挑两道菜再结算</p>
        <Link to="/" className="btn btn--primary mt-6">
          去点餐
        </Link>
      </main>
    );
  }

  return (
    <main className="relative z-10 mx-auto max-w-[1080px] px-6 py-7">
      <div className="mb-5 flex items-center gap-3">
        <Link to="/" className="btn btn--ghost btn--sm">
          ← 返回点餐
        </Link>
        <div>
          <h1 className="font-display text-[26px] tracking-display">确认订单</h1>
          <p className="text-[12px] text-muted">金额与配送费由服务端按下单时刻重新计算</p>
        </div>
      </div>

      <form className="grid grid-cols-[minmax(0,1fr)_330px] items-start gap-5" onSubmit={(event) => void submit(event)}>
        <section className="flex flex-col gap-4">
          <div className="card px-5 py-5">
            <Field
              label="配送地址"
              htmlFor="address"
              required
              hint="送不到会被档口退回"
              error={addressError}
            >
              <input
                id="address"
                className="input"
                placeholder="例如：菜鸟驿站 3 号楼 门口"
                value={address}
                onChange={(event) => {
                  setAddress(event.target.value);
                  if (addressError) setAddressError(null);
                }}
              />
            </Field>

            <div className="mt-4">
              <Field label="备注" htmlFor="remark" hint="选填，不超过 100 字">
                <input
                  id="remark"
                  className="input"
                  placeholder="少辣、不要香菜、酱汁另装…"
                  maxLength={100}
                  value={remark}
                  onChange={(event) => setRemark(event.target.value)}
                />
              </Field>
            </div>
          </div>

          <div className="card overflow-hidden">
            <header className="border-b border-rule px-5 py-3">
              <h2 className="font-display text-[15px] tracking-display">菜品明细</h2>
            </header>

            {cart.groups.map((group) => (
              <div key={group.stallId} style={tintStyle(group.stallId)} className="border-b border-rule last:border-b-0">
                <div className="plastic flex items-baseline justify-between px-5 py-2">
                  <span className="font-display text-[13.5px] tracking-display">{group.stallName}</span>
                  <span className="label text-[10.5px] text-ink-2">
                    {group.deliveryFeeCents === 0
                      ? `满 ${yuan(cart.freeDeliveryThresholdCents)} 免配送费`
                      : `配送费 ${yuan(group.deliveryFeeCents)}`}
                  </span>
                </div>
                <ul className="px-5 py-2">
                  {group.items.map((item) => (
                    <li key={item.dishId} className="flex items-baseline justify-between py-1.5">
                      <span className="text-[13.5px]">
                        {item.name}
                        <span className="label ml-2 text-[11px] text-muted">
                          {yuan(item.priceCents)} × {item.qty}
                        </span>
                      </span>
                      <span className="label text-[13px] tabular-nums text-ink-2">
                        {yuan(item.subtotalCents)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex items-baseline justify-between px-5 pb-3">
                  <span className="text-[12px] text-muted">该档口小计</span>
                  <span className="label text-[13px] tabular-nums">{yuan(group.totalCents)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="card sticky top-[88px] px-5 py-5">
          <h2 className="font-display text-[16px] tracking-display">账单</h2>

          <dl className="mt-4 flex flex-col gap-2 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted">菜品小计</dt>
              <dd className="label tabular-nums">{yuan(cart.totals.itemsTotalCents)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">配送费（{cart.groups.length} 家档口）</dt>
              <dd className="label tabular-nums">{yuan(cart.totals.deliveryFeeCents)}</dd>
            </div>
            <div className="mt-1 flex items-baseline justify-between border-t border-dashed border-rule pt-2.5">
              <dt className="text-[13px] text-ink-2">应付合计</dt>
              <dd className="font-display text-[26px] tabular-nums tracking-display">
                {yuan(cart.totals.totalCents)}
              </dd>
            </div>
          </dl>

          {error ? (
            <p role="alert" className="mt-3 rounded-[9px] bg-paper-3 px-3 py-2 text-[12.5px] text-accent-deep">
              {error}
            </p>
          ) : null}

          <button type="submit" className="btn btn--primary mt-4 h-12 w-full" disabled={pending}>
            {pending ? '正在提交…' : '提交订单'}
          </button>

          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            模拟支付：提交即视为已付款，不产生真实扣款。跨档口会拆成多笔订单，分别出餐。
          </p>
        </aside>
      </form>
    </main>
  );
}
