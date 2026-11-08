import type { OrderStatus, TimelineEntry } from '../api/types';
import { clockTime } from '../lib/format';

interface StatusTimelineProps {
  entries: TimelineEntry[];
  current: OrderStatus;
}

export function StatusTimeline({ entries, current }: StatusTimelineProps) {
  return (
    <ol className="flex flex-wrap items-start gap-y-3" aria-label="订单状态时间线">
      {entries.map((entry, index) => {
        const reached = entry.at !== null;
        const active = entry.status === current;
        const cancelled = entry.status === 'cancelled';
        return (
          <li key={entry.status} className="flex items-start">
            <div className="flex w-[104px] flex-col items-start gap-1.5">
              <span
                className={[
                  'label text-[11px]',
                  cancelled ? 'text-accent-deep' : reached ? 'text-ink-2' : 'text-muted',
                ].join(' ')}
              >
                {entry.label}
              </span>
              <span
                className={[
                  'h-2.5 w-2.5 rounded-full',
                  cancelled
                    ? 'bg-accent-deep'
                    : active
                      ? 'bg-accent ring-4 ring-accent-soft'
                      : reached
                        ? 'bg-accent'
                        : 'bg-rule',
                ].join(' ')}
              />
              <span className="label text-[11px] tabular-nums text-muted">
                {reached ? clockTime(entry.at) : '--:--'}
              </span>
            </div>
            {index < entries.length - 1 ? (
              <span
                aria-hidden
                className={[
                  'mt-[26px] h-[2px] w-8',
                  reached ? 'bg-accent' : 'bg-rule',
                ].join(' ')}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
