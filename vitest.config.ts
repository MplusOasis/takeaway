import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/tests/**/*.test.ts', 'e2e/**/*.test.ts'],
    hookTimeout: 40_000,
    testTimeout: 30_000,
  },
  ssr: {
    // Vite 5 的 builtins 列表早于 node:sqlite，显式声明为外部依赖避免被当成普通包解析
    external: ['node:sqlite'],
  },
});
