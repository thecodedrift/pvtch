## Why

When investigating abuse in lingo, the current logs don't tell us enough. We can see request IDs and Twitch user IDs, but we can't quickly identify _who_ is abusing the system by display name. Tokens also leak into logs in at least three places — we rely on Cloudflare to redact them, but that's not guaranteed. The logging itself is ad-hoc (`console.log` with a hand-rolled wrapper), making it hard to filter, tag, or correlate events across the request lifecycle.

## What Changes

- Replace the hand-rolled `log()`/`error()` wrappers in lingo routes with `consola`, providing structured tagged logging with levels
- Add automatic token redaction at the logger layer so tokens never appear in log output, regardless of call site
- Attach Twitch display names to log context by reading from KV at request time (the data is already there via the `twitch-data-{userId}` key)
- Store the Twitch display name in the User DO (synced daily via the existing JobScheduler) so it's co-located with lingo config for future use

## Capabilities

### New Capabilities

- `structured-logging`: consola-based logger factory with per-request tagging (request ID, twitch name, user ID) and automatic token redaction via both explicit registration and base58 pattern matching

### Modified Capabilities

- `lingo`: Replace `console.log`/`console.error` calls in `lingo.translate.$token.tsx` and `lingo.config.$token.set.tsx` with the new structured logger; remove raw token from log data; add twitch display name to log context
- `user-do`: Add `twitchName` field to User DO storage with a daily sync job that reads from KV; expose via a getter for logging and future features

## Impact

- New: `workers/core/app/lib/logger.ts` — consola-based logger factory with redaction
- Modified: `workers/core/app/routes/lingo.translate.$token.tsx` — use new logger, remove raw token logging
- Modified: `workers/core/app/routes/lingo.config.$token.set.tsx` — use new logger
- Modified: `workers/core/do/user.ts` — add profile plugin or inline twitchName storage, daily sync job
- Modified: `workers/core/do/plugins/lingo.ts` — possible migration for twitchName (or separate plugin)
- Modified: `workers/core/package.json` — add `consola` dependency
