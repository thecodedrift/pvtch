import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit-test config — DO/RpcTarget code is exercised in plain Node with a
// `better-sqlite3` adapter that masquerades as `SqlStorage`. The real
// `cloudflare:workers` module isn't available in Node, so we alias it to a
// stub that provides no-op `DurableObject` / `RpcTarget` base classes.
// E2E tests in `e2e/` use vitest.config.ts (no alias) so miniflare can
// import the real runtime.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './app'),
      'cloudflare:workers': path.resolve(
        __dirname,
        './test/stubs/cloudflare-workers.ts'
      ),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    testTimeout: 10000,
  },
});
