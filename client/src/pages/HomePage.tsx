import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError, apiRequest } from '../api/client';
import type { DishView, StallSummary } from '../api/types';
import { CartPanel } from '../components/CartPanel';
import { DishRow } from '../components/DishRow';
import { StallIndex, type StallFilter } from '../components/StallIndex';
import { yuan } from '../lib/format';
import { useCart } from '../state/CartContext';

interface StallDetail {
  stall: StallSummary;
  dishes: DishView[];
}

export function HomePage() {
  const { add } = useCart();
  const [keyword, setKeyword] = useState('');
  const [filter, setFilter] = useState<StallFilter>('all');
  const [stalls, setStalls] = useState<StallSummary[]>([]);
  const [stallsLoading, setStallsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<StallDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [busyDish, setBusyDish] = useState<string | null>(null);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'warn' } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setStallsLoading(true);

    const run = async () => {
      try {
        const query = new URLSearchParams({ keyword, filter });
        const data = await apiRequest<{ stalls: StallSummary[] }>(`/stalls?${query.toString()}`, {
          signal: controller.signal,
        });
        setStalls(data.stalls);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setToast({ text: '档口列表加载失败', tone: 'warn' });
        }
      } finally {
        if (!controller.signal.aborted) setStallsLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [keyword, filter]);

  useEffect(() => {
    if (stalls.length === 0) {
      setSelectedId(null);
      return;
    }
    const stillThere = stalls.some((stall) => stall.id === selectedId);
    if (!stillThere) setSelectedId(stalls[0]?.id ?? null);
  }, [stalls, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const controller = new AbortController();
    setDetailLoading(true);

    const run = async () => {
      try {
        const data = await apiRequest<StallDetail>(`/stalls/${selectedId}`, {
          signal: controller.signal,
        });
        setDetail(data);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setToast({ text: '档口详情加载失败', tone: 'warn' });
        }
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    };

    void run();
    return () => controller.abort();
  }, [selectedId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const handleAdd = useCallback(
    async (dishId: string) => {
      setBusyDish(dishId);
      try {
        await add(dishId, 1);
        setToast({ text: '已加入这一单', tone: 'ok' });
      } catch (cause) {
        setToast({
          text: cause instanceof ApiError ? cause.message : '加购失败，请重试',
          tone: 'warn',
        });
      } finally {
        setBusyDish(null);
      }
    },
    [add],
  );

  const selectedStall = useMemo(
    () => stalls.find((stall) => stall.id === selectedId) ?? detail?.stall ?? null,
    [stalls, selectedId, detail],
  );

  return (
    <main className="relative z-10 mx-auto max-w-[1280px] px-6 py-6">
      <div className="grid grid-cols-[212px_minmax(0,1fr)_336px] items-start gap-5">
        <StallIndex
          stalls={stalls}
          selectedId={selectedId}
          keyword={keyword}
          filter={filter}
          loading={stallsLoading}
          onSelect={setSelectedId}
          onKeywordChange={setKeyword}
          onFilterChange={setFilter}
        />

        <section className="card min-h-[560px] overflow-hidden">
          {selectedStall ? (
            <>
              <header className="border-b border-rule px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="font-display text-[24px] tracking-display">
                        {selectedStall.name}
                      </h1>
                      {selectedStall.isOpen ? (
                        <span className="stamp">营业中</span>
                      ) : (
                        <span className="stamp border-muted bg-transparent text-muted">休息中</span>
                      )}
                    </div>
                    <p className="mt-1 text-[12.5px] text-muted">
                      {selectedStall.zone} · {selectedStall.description ?? '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="label text-[10px] uppercase text-muted">出餐约</div>
                    <div className="label mt-0.5 text-[18px] tabular-nums">
                      {selectedStall.prepMinutes} 分钟
                    </div>
                  </div>
                </div>
              </header>

              <div className="flex items-center justify-between bg-paper-2 px-5 py-2">
                <span className="label text-[10.5px] uppercase text-muted">
                  {selectedStall.availableCount} 道可点 · {selectedStall.soldOutCount} 道售罄
                </span>
                {selectedStall.minPriceCents === null ? null : (
                  <span className="label text-[10.5px] text-ink-2">
                    {yuan(selectedStall.minPriceCents)} 起
                  </span>
                )}
              </div>

              <div className="divide-y divide-rule">
                {detailLoading && !detail ? (
                  <div className="px-5 py-10 text-center text-[13px] text-muted">正在上菜…</div>
                ) : null}
                {detail?.dishes.map((dish) => (
                  <DishRow
                    key={dish.id}
                    dish={dish}
                    busy={busyDish === dish.id}
                    onAdd={(dishId) => void handleAdd(dishId)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="grid min-h-[560px] place-items-center px-6 text-center">
              <div>
                <p className="font-display text-[18px] tracking-display">先选一个档口</p>
                <p className="mt-1 text-[13px] text-muted">
                  左边列出今天开门的档口，选好后中间的菜单会跟着换
                </p>
              </div>
            </div>
          )}
        </section>

        <CartPanel />
      </div>

      {toast ? (
        <div
          role="status"
          className={[
            'fixed bottom-6 left-1/2 z-30 -translate-x-1/2 rounded-pill px-4 py-2 text-[13px] shadow-lift',
            toast.tone === 'ok' ? 'bg-ink text-paper' : 'bg-accent-deep text-accent-ink',
          ].join(' ')}
        >
          {toast.text}
        </div>
      ) : null}
    </main>
  );
}
