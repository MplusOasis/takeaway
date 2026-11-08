import type { StallSummary } from '../api/types';
import { yuan } from '../lib/format';
import { tintStyle } from '../lib/tint';

export type StallFilter = 'all' | 'open' | 'hasSoldOut';

interface StallIndexProps {
  stalls: StallSummary[];
  selectedId: string | null;
  keyword: string;
  filter: StallFilter;
  loading: boolean;
  onSelect: (stallId: string) => void;
  onKeywordChange: (keyword: string) => void;
  onFilterChange: (filter: StallFilter) => void;
}

const FILTERS: { value: StallFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'open', label: '营业中' },
  { value: 'hasSoldOut', label: '有售罄' },
];

export function StallIndex({
  stalls,
  selectedId,
  keyword,
  filter,
  loading,
  onSelect,
  onKeywordChange,
  onFilterChange,
}: StallIndexProps) {
  return (
    <aside className="flex min-h-0 flex-col gap-3">
      <div>
        <label className="label mb-1.5 block text-[10px] uppercase text-muted" htmlFor="stall-search">
          找档口 / 找菜
        </label>
        <input
          id="stall-search"
          className="input h-10 text-sm"
          placeholder="例如：面、砂锅、卤"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => onFilterChange(item.value)}
            className={[
              'rounded-pill px-2.5 py-1 text-[12px] transition-colors',
              filter === item.value
                ? 'bg-accent-soft text-accent-deep shadow-[inset_0_-2px_0_var(--color-accent)]'
                : 'text-muted hover:text-ink',
            ].join(' ')}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="scroll-area -mr-2 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-2">
        {stalls.map((stall) => {
          const active = stall.id === selectedId;
          return (
            <button
              key={stall.id}
              type="button"
              onClick={() => onSelect(stall.id)}
              style={tintStyle(stall.id)}
              className={[
                'plastic group relative w-full rounded-card px-3 py-2.5 text-left transition-all',
                active
                  ? 'ring-2 ring-accent shadow-lift'
                  : 'ring-1 ring-rule hover:ring-accent-deep',
              ].join(' ')}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-display text-[15px] tracking-display">{stall.name}</span>
                {stall.isOpen ? null : (
                  <span className="label text-[10px] text-muted">休息中</span>
                )}
              </div>
              <div className="mt-0.5 truncate text-[11.5px] text-ink-2">{stall.zone}</div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="label text-[11px] text-muted">
                  {stall.availableCount}/{stall.dishCount} 道可点
                </span>
                {stall.minPriceCents === null ? null : (
                  <span className="label text-[11px] text-ink-2">{yuan(stall.minPriceCents)} 起</span>
                )}
                {stall.soldOutCount > 0 ? (
                  <span className="label text-[10px] text-muted">· {stall.soldOutCount} 售罄</span>
                ) : null}
              </div>
            </button>
          );
        })}

        {!loading && stalls.length === 0 ? (
          <div className="rounded-card border border-dashed border-rule px-3 py-6 text-center text-[13px] text-muted">
            没有匹配的档口
            <br />
            换个关键词试试
          </div>
        ) : null}

        {loading ? <div className="py-6 text-center text-[13px] text-muted">正在上菜…</div> : null}
      </div>
    </aside>
  );
}
