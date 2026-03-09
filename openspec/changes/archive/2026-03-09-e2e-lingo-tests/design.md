## Context

The lingo translation system uses Cloudflare Workers AI (`env.AI`) to detect languages and translate Twitch chat messages. The only way to test it today is a dev-only HTTP route (`/lingo/test`) that requires starting the full wrangler dev server and manually reading the output. There are no automated assertions — it's a visual report.

The `translate()` function in `app/lib/translator.ts` takes an input string and `{ env, targetLanguage }`, calls `env.AI.run()` with a Qwen model, and returns a structured result with `detected`, `detectedCode`, and `translation` fields.

## Goals / Non-Goals

**Goals:**

- Run lingo translation tests from the command line with pass/fail exit codes
- Use real Cloudflare AI bindings (not mocks) for accurate results
- Assert structural properties of translation output, not exact text matches
- Establish vitest as the test runner for future tests

**Non-Goals:**

- Testing exact translation text (LLM output is non-deterministic)
- Mocking the AI binding (these are e2e tests against the real model)
- Testing other features (auth, KV, DOs) — just lingo for now
- CI integration (requires Cloudflare credentials; local-only for now)

## Decisions

### 1. Use `getPlatformProxy` from wrangler for bindings

Wrangler exports `getPlatformProxy()` which creates proxy objects for all Cloudflare bindings defined in `wrangler.jsonc` — including `env.AI` — without starting an HTTP server. This runs in a normal Node.js process.

```ts
import { getPlatformProxy } from 'wrangler';

const { env, dispose } = await getPlatformProxy<Env>({
  configPath: './wrangler.jsonc',
});
// env.AI is now a live proxy to Cloudflare Workers AI
```

The proxy is initialized once in a `beforeAll` hook and disposed in `afterAll`.

**Why not Miniflare directly:** `getPlatformProxy` is the higher-level API that reads `wrangler.jsonc` automatically. Miniflare would require manually configuring each binding.

**Why not `unstable_dev`:** That starts an HTTP server, which is exactly what we're avoiding.

### 2. Separate vitest config for e2e tests

The existing `vite.config.ts` has React Router and Cloudflare plugins that conflict with running plain Node.js tests. Create a dedicated `vitest.config.ts` that only includes what's needed:

```ts
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['e2e/**/*.test.ts'],
    testTimeout: 30000, // AI calls can be slow
  },
});
```

This keeps `tsconfigPaths` for `@/` alias resolution but drops `reactRouter`, `cloudflare`, and `tailwindcss` plugins.

**Why a separate config:** The cloudflare vite plugin transforms the worker for workerd runtime. Our tests run in Node.js and call `getPlatformProxy` directly — those plugins would interfere.

### 3. Structural assertions only

Each fixture defines an input and expected metadata. Assertions check:

1. **Success** — `result.success === true`
2. **Language detection** — `result.data.detected` matches the expected language name
3. **ISO 639-3 code** — `result.data.detectedCode` is exactly 3 lowercase letters
4. **Non-empty translation** — `result.data.translation.length > 0`
5. **@username preservation** — any `@username` in the input appears in the output
6. **Emote preservation** — known emote tokens from the fixture appear in the output (emotes are identified per-fixture since they're not systematically parseable)

No exact text comparison. The LLM may phrase translations differently across runs — that's fine as long as the structural properties hold.

### 4. Fixture shape

```ts
type Fixture = {
  input: string;
  expected: {
    language: string; // e.g. "English", "Tagalog", "Korean"
  };
  preserveTokens?: string[]; // @usernames and emotes that must appear in output
};
```

The `preserveTokens` array covers both @usernames and emote-like strings. Not every fixture needs it — only those with tokens worth checking.

### 5. Remove the old test route

The `/lingo/test` route in `app/routes/lingo.test.tsx` and its entry in `app/routes.ts` are removed. The vitest test fully replaces it. The `DEVELOPMENT` env var gate for this route is no longer needed (though it may still be used elsewhere).

## Risks / Trade-offs

- **AI calls cost money** — Each test run makes real API calls to Cloudflare Workers AI. With ~10 fixtures and 1 model, this is cheap ($0.051/M input tokens) but non-zero. Tests should be run intentionally, not on every save.
- **Network dependency** — Tests require network access to Cloudflare AI. They'll fail offline or if the API is down. This is inherent to e2e testing against a real service.
- **Non-deterministic results** — LLM output varies between runs. Structural assertions mitigate this, but a test could theoretically fail if the model has an unusually bad response. Retries or a generous timeout help.
- **No CI yet** — Running in CI requires Cloudflare account credentials. For now this is a local-only tool. CI integration can be added later with secrets.
