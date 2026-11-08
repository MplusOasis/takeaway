import type { DishView } from '../api/types';
import { yuan } from '../lib/format';

interface DishRowProps {
  dish: DishView;
  busy: boolean;
  onAdd: (dishId: string) => void;
}

const UNAVAILABLE_LABEL: Record<string, string> = {
  sold_out: '已售罄',
  off_shelf: '已下架',
};

export function DishRow({ dish, busy, onAdd }: DishRowProps) {
  return (
    <div
      className={[
        'group flex items-center gap-4 px-4 py-3 transition-colors',
        dish.available ? 'hover:bg-paper-2' : 'bg-paper-2',
      ].join(' ')}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={[
              'font-display text-[15px] tracking-display',
              dish.available ? 'text-ink' : 'sold-out',
            ].join(' ')}
          >
            {dish.name}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12.5px] text-muted">{dish.description ?? '—'}</p>
      </div>

      <div className="label w-[76px] text-right text-[15px] tabular-nums text-ink-2">
        {yuan(dish.priceCents)}
      </div>

      <button
        type="button"
        className="btn btn--sm btn--primary w-[84px]"
        disabled={!dish.available || busy}
        aria-disabled={!dish.available || busy}
        onClick={() => onAdd(dish.id)}
      >
        {dish.available ? (busy ? '加入中' : '加购') : (UNAVAILABLE_LABEL[dish.status] ?? '不可购')}
      </button>
    </div>
  );
}
