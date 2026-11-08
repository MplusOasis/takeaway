/** 金额：分 → ¥ 字符串，全站唯一入口，禁止各页面自行拼金额 */
export function yuan(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

export function clockTime(iso: string | null): string {
  if (!iso) return '--:--';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function shortDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${month}-${day} ${clockTime(iso)}`;
}

/** 倒计时：毫秒 → mm:ss */
export function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = `${Math.floor(total / 60)}`.padStart(2, '0');
  const seconds = `${total % 60}`.padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export function statusTone(status: string): string {
  switch (status) {
    case 'paid':
    case 'preparing':
      return 'text-accent-deep';
    case 'ready':
      return 'text-ink';
    case 'completed':
      return 'text-muted';
    case 'cancelled':
      return 'text-muted';
    default:
      return 'text-ink';
  }
}
