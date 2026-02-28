## Context

PVTCH is a Cloudflare Workers app that provides streamer tools. Users need to authenticate to manage widgets (progress bars, lingo translation, etc.). Since all users are Twitch streamers, Twitch OAuth is the natural identity provider. The system runs on the edge with no traditional database — Cloudflare KV provides the persistence layer.

## Goals / Non-Goals

**Goals:**
- Authenticate users via Twitch OAuth 2.0 Authorization Code flow
- Generate opaque, cryptographic tokens for API access (not Twitch tokens)
- Store minimal user data (id, login, display_name) in KV
- Provide cookie-based sessions for the web UI
- Support account removal with full data cleanup
- Reusable UI components for login/logout and auth guarding

**Non-Goals:**
- Storing or refreshing Twitch access/refresh tokens (used only during callback)
- Role-based access control or permission scoping
- CSRF protection via state parameter (noted as TODO)
- Multi-provider authentication

## Decisions

### 1. Opaque Base58 tokens instead of JWTs
Generate 22-character Base58-encoded tokens from 16 random bytes. These are opaque identifiers requiring a KV lookup for validation. This avoids JWT complexity (signing, expiry, refresh) and keeps the system stateless — all state lives in KV. The 22-char Base58 space provides ~95 bits of entropy, more than sufficient.

### 2. Dual KV entry pattern
Store two KV entries per user:
- `twitch-data-{twitchId}` → `TwitchUserData` (id, login, display_name, token)
- `token-data-{token}` → Twitch user ID (string)

The forward lookup (`token-data-*`) enables fast token validation on every API request. The reverse lookup (`twitch-data-*`) enables re-login without generating a new token — returning users keep their existing token and all widget configurations remain valid.

### 3. Cookie-based session for web, token-in-URL for APIs
The web dashboard uses a `pvtch_token` cookie (SameSite=Lax, Secure in production). Widget APIs use the token directly in the URL path (e.g., `/progress/{token}/{name}`). This separation means OBS browser sources and chatbot integrations work without cookies.

### 4. Discard Twitch tokens after callback
The Twitch access token and refresh token are used only to fetch the user's profile during the OAuth callback. They are not stored. This minimizes the security surface — if KV is compromised, no Twitch tokens are exposed.

### 5. Account removal requires username + token match
Deletion requires both the token and matching username, preventing accidental or unauthorized deletion from a stolen token alone. Both KV entries are deleted atomically.

## Risks / Trade-offs

- **No CSRF state parameter** → The OAuth flow does not include a `state` parameter for CSRF protection. Mitigated by the flow being low-risk (read-only Twitch scope, no sensitive actions on callback). Noted as a TODO in code.
- **No token expiry** → Tokens never expire. Mitigated by users being able to remove their account at any time and tokens having high entropy.
- **KV eventual consistency** → KV writes may take up to 60s to propagate globally. Mitigated by the redirect to `/welcome` after login — the write typically completes before the user takes their next action.
- **No Twitch token refresh** → If Twitch user data changes (display name), PVTCH won't reflect it until re-login. Acceptable for current scope.
