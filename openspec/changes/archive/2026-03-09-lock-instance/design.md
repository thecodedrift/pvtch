## Context

PVTCH instances are fully open — anyone can visit, log in with Twitch, and use all widgets. The `userContext` already exists in `context.ts` but is never set in `handler.ts`. Each loader independently parses cookies, calls `isValidToken()`, and does its own KV lookup. There is no concept of authorization (only authentication).

This change introduces instance-level access control via an `ALLOWED_USERS` env var and centralizes user resolution as a prerequisite.

## Goals / Non-Goals

**Goals:**

- Allow operators to restrict their instance to specific Twitch usernames via environment variable
- Centralize user resolution in `handler.ts` so loaders read user state from context
- Provide clear UX for unauthorized users (✕ icon, `/private` page)
- Document the lockdown feature in the deploy-your-own guide

**Non-Goals:**

- Per-widget access control (all-or-nothing per instance)
- Admin UI for managing the allow list (env var only)
- Changing the OAuth flow itself
- Rate limiting or IP-based restrictions

## Decisions

### 1. Centralize user resolution in React Router middleware

Create `app/middleware/auth.ts` using React Router v8 middleware (`v8_middleware` is already enabled in `react-router.config.ts`). The middleware runs before loaders, has access to the context provider, and is the idiomatic place for cross-cutting concerns.

```
middleware/auth.ts:
  1. Parse pvtch_token from Cookie header
  2. isValidToken(token, env) → twitchId
  3. If valid: KV get twitch-data-{twitchId} → TwitchUserData
  4. context.set(userContext, { id, login, displayName })
  5. Parse ALLOWED_USERS, compute isAllowed
  6. context.set(instanceAccessContext, { isPrivate, isAllowed })
```

Loaders then call `context.get(userContext)` instead of doing their own token validation. The `parseCookies` helper and per-loader `isValidToken` calls are removed.

**Why middleware instead of handler.ts:** Middleware is the React Router v8 pattern for this — it runs per-route, has access to context, and keeps `handler.ts` minimal (just env/execution context setup). It also allows per-route middleware composition if needed later.

**Why not per-loader:** Every loader currently duplicates ~15 lines of cookie parsing and token validation. Centralizing eliminates this duplication and gives us a single place to add the authorization layer.

### 2. Add `isAllowedUser` to a new authorization context

Introduce an `instanceAccessContext` alongside `userContext`:

```typescript
export interface InstanceAccess {
  isPrivate: boolean; // ALLOWED_USERS is set and non-empty
  isAllowed: boolean; // user is on the allow list (or instance is open)
}

export const instanceAccessContext = createContext<InstanceAccess>();
```

The middleware computes this:

- Parse `ALLOWED_USERS` → split by comma, trim, lowercase
- If empty array → `{ isPrivate: false, isAllowed: true }`
- If user is logged in and login is in the list → `{ isPrivate: true, isAllowed: true }`
- Otherwise → `{ isPrivate: true, isAllowed: false }`

**Why a separate context instead of adding to userContext:** Authorization is orthogonal to authentication. A user can be authenticated but not authorized. Keeping them separate avoids conflating "who is this user" with "can this user access this instance."

### 3. Widget editors and OBS sources redirect unauthorized users to `/private`

In loaders for widget editor routes and OBS source routes, check `instanceAccessContext`. If `isPrivate && !isAllowed`, redirect to `/private`.

For widget editors this replaces the existing `if (!authenticated) return data({ authenticated: false })` pattern — the redirect happens before any widget-specific logic.

For OBS sources, the token-in-URL pattern (`/sources/progress/:token/:name`) already implies the user has a token. The check resolves the token's owner and verifies they're on the allow list. If not, redirect to `/private`. This means an unauthorized user can't use someone else's valid source URL on a private instance.

**Why redirect instead of rendering blank:** A redirect to `/private` gives a clear explanation. Rendering blank in OBS would be confusing — the streamer wouldn't know why their overlay stopped working.

### 4. Header shows ✕ for unauthorized users on private instances

The `TwitchLogin` component needs to know `isPrivate` and `isAllowed`. Since it's a client component reading cookies, it can't access server context directly. Two options:

**Option A — Root loader passes access state as serialized data.** The root layout loader reads `instanceAccessContext` and returns `{ isPrivate, isAllowed }` in loader data. `TwitchLogin` receives these as props.

**Option B — Derive from a cookie.** The callback could set a cookie indicating authorization status. But this is forgeable and wrong.

**Chosen: Option A.** The root loader already exists (it's the layout route). Adding two booleans to its loader data is minimal. `TwitchLogin` gets `isPrivate` and `isAllowed` as props (defaulting to `false`/`true` for backwards compatibility).

When `isPrivate && !isAllowed && isLoggedIn`:

- Replace the `TwitchIcon` with an `X` icon (from lucide-react)
- The username becomes a link to `/private` instead of a dropdown trigger
- No logout dropdown (they can clear cookies manually or navigate away)

### 5. `/private` route is a simple static page

A new route at `workers/core/app/routes/private.tsx` that renders outside the app layout (no auth needed). Content:

- Heading: "Private Instance"
- Explanation: This pvtch instance is restricted to specific users
- Link to the deploy-your-own guide so they can set up their own

### 6. `ALLOWED_USERS` env var convention

- Default in `wrangler.jsonc` vars: `"ALLOWED_USERS": ""`
- Operators set real values in Cloudflare dashboard or `.dev.vars`
- Empty string = open instance (length check, not truthiness)
- Parsing: split by comma, trim whitespace, lowercase for comparison
- Comparison is case-insensitive (Twitch logins are case-insensitive)

## Risks / Trade-offs

- **Extra KV read on every request** → The handler now does a KV lookup for every authenticated request, even for pages that don't need user data (like the homepage). This is a ~1ms overhead on Cloudflare Workers, acceptable for the simplification it provides. Unauthenticated requests skip the lookup entirely.
- **Allow list changes require redeployment or dashboard update** → No hot-reload of the allow list. Operators must update the env var and redeploy (or update via Cloudflare dashboard, which takes effect immediately). This is fine for the target use case (personal/small team instances).
- **Username changes on Twitch** → If a user changes their Twitch username, they'd fall off the allow list. The operator would need to update `ALLOWED_USERS`. This is an edge case for the target audience (you know your own username).
- **OBS source redirect shows a page in the overlay** → When an unauthorized source URL is loaded in OBS, the `/private` page renders in the browser source frame. This is visible but self-explanatory. The streamer sees the message and knows to fix their setup.
