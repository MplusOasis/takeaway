import { useEffect, useState } from 'react';
import { countdown } from '../lib/format';

interface CancelCountdownProps {
  /** 服务端返回的剩余毫秒数，前端只做本地递减，不自行计算窗口 */
  remainingMs: number;
}

export function CancelCountdown({ remainingMs }: CancelCountdownProps) {
  const [left, setLeft] = useState(remainingMs);

  useEffect(() => {
    setLeft(remainingMs);
  }, [remainingMs]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setLeft((previous) => (previous <= 1000 ? 0 : previous - 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="label text-[15px] tabular-nums" aria-live="off">
      {countdown(left)}
    </span>
  );
}
