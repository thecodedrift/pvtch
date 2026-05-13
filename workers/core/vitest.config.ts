import path from 'node:path';
import { defineConfig } from 'vitest/config';

// E2E config — runs against real Cloudflare bindings via getPlatformProxy.
// Do NOT alias `cloudflare:workers` here; miniflare needs the real module.
// Unit tests live under `test/` and use vitest.unit.config.ts.
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
