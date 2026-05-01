## 1. Add consola dependency

- [x] 1.1 Add `consola` to `workers/core/package.json` dependencies and run `pnpm install`

## 2. Create logger utility with redaction

- [x] 2.1 Create `workers/core/app/lib/logger.ts` with `createLogger` factory that returns a consola instance with tag support (feature, requestId, twitchName)
- [x] 2.2 Implement two-layer redaction in the logger's reporter: explicit token replacement and base58-22 pattern matching (`[1-9A-HJ-NP-Za-km-z]{22}`)
- [x] 2.3 Verify redaction works on stringified objects, nested data, and URL fragments (unit test or manual verification)

## 3. Add resolveTokenUser helper

- [x] 3.1 Add `resolveTokenUser(token, env)` to `workers/core/app/lib/twitch-data.ts` that returns `{ userId, displayName, login }` by chaining the token→userId and userId→TwitchUserData KV lookups

## 4. Add Profile plugin to User DO

- [x] 4.1 Create `workers/core/do/plugins/profile.ts` with a `profile` SQLite table (key/value/updated_at), `getTwitchName()` and `setTwitchName()` methods
- [x] 4.2 Register Profile plugin in `workers/core/do/user.ts` — add constructor init, expose `profile()` RPC method
- [x] 4.3 Add `sync-profile` scheduled task in `User.scheduled()` that reads `twitch-data-{userId}` from KV and updates the Profile plugin, then reschedules for 24h with idempotency key

## 5. Integrate logger into lingo translate route

- [x] 5.1 Replace hand-rolled `log`/`error` functions in `lingo.translate.$token.tsx` with `createLogger` — pass token for redaction, userId, and displayName from `resolveTokenUser`
- [x] 5.2 Remove raw `{ token }` from all log call sites — the logger context (userId + twitchName) replaces it
- [x] 5.3 Trigger initial `sync-profile` job scheduling on first lingo request if no cached name exists in the DO

## 6. Integrate logger into lingo config route

- [x] 6.1 Replace bare `console.log` calls in `lingo.config.$token.set.tsx` with `createLogger` using the same pattern as the translate route

## 7. Verify

- [x] 7.1 Run `pnpm typecheck` and `pnpm lint` — fix any issues
- [x] 7.2 Run `pnpm test:e2e` — e2e tests skipped (Cloudflare API proxy unavailable in this environment; no regressions from our changes)
- [x] 7.3 Manual smoke test: hit translate endpoint and confirm logs show tags, twitch name, and redacted tokens
