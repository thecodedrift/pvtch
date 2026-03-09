## Why

The lingo translation system has no automated tests. The only way to verify translation behavior is to start the full wrangler dev server, navigate to `/lingo/test` in a browser, and eyeball the results. This makes it easy for regressions to slip through when changing models, prompts, or the `translate()` function. The test route also can't run in CI.

## What Changes

- Add vitest as the test runner for `workers/core`
- Use wrangler's `getPlatformProxy` to get real Cloudflare bindings (including `env.AI`) in a Node.js process — no HTTP server needed
- Create an e2e test for lingo translation with fixture-based structural assertions (correct language detected, @usernames preserved, non-empty output, valid ISO 639-3 codes)
- Remove the old `/lingo/test` route and its `DEVELOPMENT` gate since the vitest test replaces it

## Capabilities

### New Capabilities

- `e2e-testing`: Vitest-based e2e test infrastructure using `getPlatformProxy` for Cloudflare bindings, with a lingo translation test suite that validates structural properties of LLM translation output against fixtures

### Modified Capabilities

- `lingo`: Remove the dev-only `/lingo/test` HTTP route; translation testing moves to vitest

## Impact

- New: `workers/core/vitest.config.ts` — vitest config extending the existing vite config
- New: `workers/core/e2e/lingo.test.ts` — fixture-based translation e2e test
- Modified: `workers/core/app/routes.ts` — remove `lingo/test` route
- Removed: `workers/core/app/routes/lingo.test.tsx` — replaced by vitest test
- Modified: `workers/core/package.json` — add vitest dep and `test:e2e` script
