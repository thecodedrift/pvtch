## Why

PVTCH needs a secure, low-friction authentication system so streamers can manage their widgets (progress bars, lingo translation, etc.) without creating yet another account. Twitch OAuth lets users authenticate with the platform they already use, and token-based sessions keep the system stateless on the edge.

## What Changes

- Twitch OAuth 2.0 login flow (initiate → callback → session)
- Cryptographic Base58 token generation for session identifiers
- Dual KV storage pattern: token→user mapping and user→data mapping
- Secure cookie-based session management (`pvtch_token`)
- Account removal/logout with full data cleanup
- Reusable auth guard component for protected routes
- Login/logout UI component

## Capabilities

### New Capabilities
- `auth`: Twitch OAuth 2.0 authentication, token-based sessions, KV-backed user storage, cookie management, login/logout flows, and auth guard components

### Modified Capabilities

(none)

## Impact

- **Routes**: `auth/start`, `auth/callback`, `auth/remove` handle the OAuth lifecycle
- **KV Namespace**: `PVTCH_ACCOUNTS` stores `twitch-data-{id}` and `token-data-{token}` entries
- **Cookies**: `pvtch_token` cookie set on the app domain (Secure, SameSite=Lax)
- **Environment Variables**: Requires `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`, `APP_URL`
- **Components**: `TwitchLogin` and `RequireTwitchLogin` used across dashboard pages
- **Dependencies**: `js-cookie` for client-side cookie access
