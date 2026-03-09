import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
    },
  },
  test: {
    include: ['e2e/**/*.test.ts'],
    testTimeout: 30000,
  },
});
