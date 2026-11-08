import type { CSSProperties } from 'react';

/** 塑料托盘色板：低饱和、同一明度，只用来区分「这是哪一家的菜」，不承载状态语义 */
export const TINTS = [
  'oklch(87.5% 0.058 64)',
  'oklch(86.5% 0.075 160)',
  'oklch(87% 0.048 210)',
  'oklch(91.5% 0.064 98)',
  'oklch(84% 0.045 270)',
  'oklch(84% 0.048 322)',
  'oklch(85% 0.052 22)',
];

type TintVars = CSSProperties & Record<string, string>;

export function tintStyle(key: string): CSSProperties {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 31 + key.charCodeAt(index)) % 9973;
  }
  const tint: TintVars = { '--tint': TINTS[hash % TINTS.length] ?? TINTS[0] };
  return tint;
}
