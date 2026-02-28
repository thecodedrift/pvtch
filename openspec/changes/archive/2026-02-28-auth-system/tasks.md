## 1. Token Generation & Data Types

- [x] 1.1 Create `app/lib/create-token.ts` with Base58 token generation (16 random bytes → 22-char token)
- [x] 1.2 Create `app/lib/twitch-data.ts` with `TwitchUserData` type, `TokenData` type, KV key prefixes, and `isValidToken` function

## 2. OAuth Routes

- [x] 2.1 Create `app/routes/auth/start.tsx` loader that redirects to Twitch OAuth authorize endpoint with client_id, response_type, redirect_uri, and empty scope
- [x] 2.2 Create `app/routes/auth/callback.tsx` loader that exchanges code for token, fetches user profile, stores dual KV entries, sets session cookie, and redirects to `/welcome`
- [x] 2.3 Handle returning users in callback by reusing existing token from `twitch-data-{id}` KV entry
- [x] 2.4 Handle OAuth errors by redirecting to `/auth/error` with error details
- [x] 2.5 Create `app/routes/auth/remove.tsx` action that validates token+username match and deletes both KV entries

## 3. Session & Cookie Management

- [x] 3.1 Set `pvtch_token` cookie with `Path=/`, `SameSite=Lax`, and conditional `Secure`/`Domain` based on environment
- [x] 3.2 Integrate `js-cookie` for client-side cookie access via `use-cookie` hook

## 4. UI Components

- [x] 4.1 Create `TwitchLogin` component with Twitch-branded login button and logout button states
- [x] 4.2 Create `RequireTwitchLogin` auth guard component for protected pages

## 5. Infrastructure

- [x] 5.1 Configure `PVTCH_ACCOUNTS` KV namespace in wrangler.jsonc
- [x] 5.2 Set up environment variables: `TWITCH_CLIENT_ID`, `TWITCH_SECRET`, `TWITCH_REDIRECT_URI`, `PVTCH_APP_URL`
