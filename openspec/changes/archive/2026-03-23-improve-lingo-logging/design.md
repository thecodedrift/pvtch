## Context

Lingo translate requests arrive at `lingo.translate.$token.tsx` with a user's token in the URL path. The handler validates the token against KV (`token-data-{token}` → userId), opens the User DO (`twitch:{userId}`), fetches lingo config, and runs AI translation. Logging currently uses a hand-rolled wrapper around `console.log`/`console.error` with a UUID request ID. Tokens appear raw in log output in multiple places. There's no way to identify users by display name in logs — only by opaque user IDs.

## Goals / Non-Goals

**Goals:**

- Structured, tagged logging with consola so logs can be filtered by request ID, user, and feature area
- Automatic token redaction at the logger layer — no token ever appears in log output
- Twitch display name available in log context for abuse investigation
- Display name cached in the User DO for zero-extra-cost access on the hot path

**Non-Goals:**

- External log shipping (Datadog, Logflare, etc.) — just improve what goes to `console`/Workers logs
- Overhauling logging across the entire app — scope is lingo routes only, with the logger utility available for future adoption
- Real-time Twitch API sync — daily KV read is sufficient for display name freshness

## Decisions

### 1. Use consola with a factory function and JSON reporter

Create `workers/core/app/lib/logger.ts` that exports a `createLogger` factory. Each request creates a logger instance with tags, redaction, and structured JSON output pre-configured.

consola uses `unjs/std-env` for environment detection, which explicitly recognizes the `workerd` runtime (Cloudflare Workers). This means consola automatically adapts its behavior — no manual runtime detection or reporter fallback logic needed.

For Cloudflare deployments, use consola's built-in JSON reporter. Cloudflare's logging infrastructure natively supports structured JSON, so JSON-formatted log lines become searchable/filterable fields in the dashboard and via `wrangler tail --format=json`.

```ts
import { createConsola, consola } from 'consola';

export function createLogger(opts: {
  feature: string;
  requestId: string;
  userId?: string;
  twitchName?: string;
  redactTokens?: string[];
}) {
  const logger = createConsola({
    reporters: [new consola.JSONReporter()],
  })
    .withTag(opts.feature)
    .withTag(opts.requestId);

  if (opts.twitchName) {
    logger.withTag(`@${opts.twitchName}`);
  }

  // Wrap reporter to intercept all output and apply redaction
  // before it reaches the JSON reporter
}
```

**Why consola over a custom wrapper:** consola provides log levels, tag stacking, pluggable reporters (including JSON), and is maintained by the unjs ecosystem. It detects the workerd runtime via std-env automatically. Building another custom wrapper would just be reinventing what consola already does.

**Why JSON reporter:** Cloudflare Workers logs support structured JSON natively. JSON output means log fields (tags, level, message, data) are queryable in the Cloudflare dashboard and via `wrangler tail`, rather than being opaque text strings that need parsing.

### 2. Two-layer token redaction

Layer 1 — **Explicit registration:** The request's token (from URL params) is registered with the logger at creation time. Any occurrence in any log argument is replaced with `[REDACTED]`.

Layer 2 — **Pattern matching:** Tokens are 22-character base58 strings (`[1-9A-HJ-NP-Za-km-z]{22}`). A regex catches any token-shaped string that wasn't explicitly registered. This is the safety net for tokens that leak through error messages, stringified objects, or URL fragments.

Redaction is silent — no warning logged when a pattern match fires. Call sites are responsible for logging what they intend.

```ts
const BASE58_TOKEN_PATTERN = /\b[1-9A-HJ-NP-Za-km-z]{22}\b/g;

function redact(input: string, knownTokens: Set<string>): string {
  // First: exact match known tokens
  let result = input;
  for (const token of knownTokens) {
    result = result.replaceAll(token, '[REDACTED]');
  }
  // Second: pattern match any remaining base58-22 strings
  result = result.replace(BASE58_TOKEN_PATTERN, '[REDACTED]');
  return result;
}
```

### 3. Read Twitch display name from KV at request time

The translate handler already does one KV read (`token-data-{token}` → userId) via `isValidToken()`. Adding a second read (`twitch-data-{userId}` → TwitchUserData) gives us the display name. KV reads are fast (edge-cached) and we're already paying the latency for one.

Enhance `isValidToken` or create a companion function `resolveTokenUser` that returns both the userId and display name in one flow:

```ts
export async function resolveTokenUser(token: string, env: Env) {
  const userId = await isValidToken(token, env);
  if (!userId) return undefined;

  const userData = await env.PVTCH_ACCOUNTS.get<TwitchUserData>(
    `${twitchDataKeyPrefix}${userId}`,
    'json'
  );

  return {
    userId,
    displayName: userData?.display_name,
    login: userData?.login,
  };
}
```

This keeps `isValidToken` unchanged for other callers while giving lingo the richer data it needs.

### 4. Cache display name in User DO via daily sync job

Add a `profile` table (or column in an existing table) to the User DO that stores the Twitch display name. On first access or via daily job, sync from KV.

The JobScheduler already exists in the User DO. Add a `sync-profile` task:

```ts
// In User.scheduled()
case 'sync-profile': {
  const userId = this.ctx.id.name?.replace('twitch:', '');
  if (!userId) break;
  const userData = await this.env.PVTCH_ACCOUNTS.get<TwitchUserData>(
    `twitch-data-${userId}`, 'json'
  );
  if (userData?.display_name) {
    this.setTwitchName(userData.display_name);
  }
  // Reschedule for tomorrow
  this.scheduler.schedule(86400, 'sync-profile', {}, { key: 'sync-profile' });
  break;
}
```

The initial sync is triggered on first lingo request if no name is cached. After that, the daily job keeps it fresh. The idempotency key `sync-profile` ensures we don't double-schedule.

**Why both KV read and DO cache:** The KV read gives us the name immediately on the first request (before the DO has synced). The DO cache means subsequent requests don't need the extra KV read — the name is co-located with the lingo config we're already fetching.

### 5. Integrate logger into lingo routes

Replace the hand-rolled `log`/`error` functions in `lingo.translate.$token.tsx` with the new logger:

```ts
const user = await resolveTokenUser(token, env);
const logger = createLogger({
  feature: 'lingo',
  requestId: v4(),
  userId: user?.userId,
  twitchName: user?.displayName,
  redactTokens: [token],
});

logger.info('Translation request', { input: value, chatUser: userTrimmed });
```

Similarly update `lingo.config.$token.set.tsx` which currently uses bare `console.log`.

### 6. Migration for profile storage in User DO

Add a new migration to create the profile storage. Following the existing pattern in `do/plugins/lingo.ts` and `do/plugins/progress.ts`, this could be either:

- A new `Profile` plugin (consistent with existing patterns)
- A simple key-value in the existing lingo table (simpler but conflates concerns)

Prefer a new `Profile` plugin with its own table for clean separation:

```sql
CREATE TABLE IF NOT EXISTS profile (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
)
```

Stores `twitch_name` as a key. Extensible for future profile data.

## Risks / Trade-offs

- **consola bundle size** — consola adds a dependency. It's lightweight (~5KB) and tree-shakeable, but it's a new runtime dep. The benefit of structured logging with redaction outweighs the cost.
- **Extra KV read per request** — Adding a `twitch-data-{userId}` read doubles KV lookups for the translate endpoint. KV reads are free up to 10M/month and fast at the edge. Once the DO cache is warm, this drops back to zero extra reads.
- **Base58 false positives** — The pattern `[1-9A-HJ-NP-Za-km-z]{22}` could match non-token strings that happen to be 22 chars of base58. In practice, this is rare in log output — most 22-char strings contain characters outside base58 (0, O, I, l). The `\b` word boundary further limits false matches. Silent redaction means a false positive just replaces an innocent string with `[REDACTED]`, which is a minor nuisance, not a data loss.
- **Daily sync staleness** — Display names can change on Twitch between daily syncs. For abuse investigation, yesterday's name is sufficient. The auth callback already writes fresh data to KV, so active users get updated on their next login anyway.
