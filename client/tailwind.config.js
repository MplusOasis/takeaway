/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'oklch(97.6% 0.011 88)',
        'paper-2': 'oklch(96.5% 0.02 160)',
        'paper-3': 'oklch(93% 0.036 160)',
        ink: 'oklch(21% 0.025 170)',
        'ink-2': 'oklch(31% 0.02 170)',
        muted: 'oklch(49% 0.024 165)',
        rule: 'oklch(86.5% 0.022 140)',
        accent: 'oklch(50% 0.13 160)',
        'accent-deep': 'oklch(42% 0.11 162)',
        'accent-soft': 'oklch(88% 0.08 160)',
        'accent-ink': 'oklch(99% 0.006 160)',
        focus: 'oklch(45% 0.14 160)',
        'tint-red': 'oklch(85% 0.052 22)',
        'tint-amber': 'oklch(87.5% 0.058 64)',
        'tint-yellow': 'oklch(91.5% 0.064 98)',
        'tint-green': 'oklch(86.5% 0.075 160)',
        'tint-blue': 'oklch(87% 0.048 210)',
        'tint-violet': 'oklch(84% 0.045 270)',
        'tint-pink': 'oklch(84% 0.048 322)',
      },
      fontFamily: {
        display: ['"Schibsted Grotesk"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        body: ['"Instrument Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        card: '14px',
        control: '10px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px oklch(30% 0.03 165 / 0.08), 0 24px 48px -24px oklch(40% 0.08 165 / 0.35)',
        lift: '0 1px 1px oklch(30% 0.03 165 / 0.10), 8px 18px 28px -14px oklch(36% 0.06 165 / 0.32), 18px 40px 60px -30px oklch(40% 0.08 165 / 0.30)',
        moulded: 'inset 0 1px 0 oklch(100% 0 0), 0 0 0 1px oklch(86.5% 0.022 140), 0 3px 0 oklch(86.5% 0.022 140)',
      },
      letterSpacing: {
        display: '-0.03em',
      },
    },
  },
  plugins: [],
};
