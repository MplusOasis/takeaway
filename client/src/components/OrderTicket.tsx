import { Link } from 'react-router-dom';
import type { OrderView } from '../api/types';
import { clockTime, shortDateTime, statusTone, yuan } from '../lib/format';
import { tintStyle } from '../lib/tint';
import { CancelCountdown } from './CancelCountdown';

export function OrderTicket({ order }: { order: OrderView }) {
  const itemsLabel = order.items.map((item) => `${item.name}×${item.qty}`).join('、');

  return (
    <Link
      to={`/orders/${order.id}`}
      style={tintStyle(order.stallId)}
      className="ticket plastic group block px-4 py-3.5 transition-shadow hover:shadow-lift"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-[15px] tracking-display">{order.stallName}</span>
            <span className="label text-[10.5px] text-muted">{order.code}</span>
          </div>
          <p className="mt-1 truncate text-[12.5px] text-ink-2">{itemsLabel || '—'}</p>
        </div>

        <div className="shrink-0 text-right">
          <div className={['text-[13px] font-medium', statusTone(order.status)].join(' ')}>
            {order.statusLabel}
          </div>
          <div className="label mt-0.5 text-[10.5px] text-muted">
            {shortDateTime(order.paidAt)}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-end justify-between border-t border-dashed border-rule pt-2">
        <span className="label text-[11px] text-muted">
          下单 {clockTime(order.paidAt)} · 共 {order.items.reduce((sum, item) => sum + item.qty, 0)} 件
        </span>
        <div className="flex items-baseline gap-3">
          {order.cancellable ? (
            <span className="label text-[11px] text-accent-deep">
              可取消 <CancelCountdown remainingMs={order.cancelRemainingMs} />
            </span>
          ) : null}
          <span className="font-display text-[17px] tabular-nums tracking-display">
            {yuan(order.totalCents)}
          </span>
        </div>
      </div>
    </Link>
  );
}
