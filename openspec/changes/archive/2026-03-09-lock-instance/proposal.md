## Why

PVTCH is open-source and self-hostable. Some operators want to run a private instance locked to specific Twitch users — for personal use or a small team. There's currently no way to restrict who can use a deployed instance; anyone who visits the URL can log in and use all widgets.

## What Changes

- Add an `ALLOWED_USERS` environment variable (comma-separated Twitch usernames) that restricts instance access
- When `ALLOWED_USERS` is set and non-empty, the instance enters "private mode":
  - All widget editor pages and OBS source routes redirect unauthorized users to `/private`
  - Logged-in users not on the allow list see an ✕ icon in the header instead of the Twitch icon, with their name linking to `/private`
  - Unauthenticated users are redirected to `/private` from widget/source routes
- Centralize user resolution in React Router middleware (`app/middleware/auth.ts`) — move token validation and user lookup out of individual loaders, exposing user identity and authorization state via context
- Add a `/private` route explaining this is a private instance with a link to the self-hosting guide
- Update the deploy-your-own guide with instructions on locking down an instance

## Capabilities

### New Capabilities

- `instance-access-control`: Environment-based allow list that restricts which Twitch users can access widgets and OBS sources on a private instance, including the `/private` explanation page and header UX for unauthorized users

### Modified Capabilities

- `auth`: Centralize user resolution in the request handler instead of per-loader token validation. Add authorization state (allowed/not-allowed) to the user context. Modify the `TwitchLogin` header component to show ✕ icon and `/private` link for unauthorized users on private instances.

## Impact

- New: `workers/core/app/middleware/auth.ts` — centralized user resolution and authorization context
- Modified: `workers/core/app/components/twitch-login.tsx` — ✕ icon and `/private` link for unauthorized users
- Modified: All widget editor routes — read user/auth from context instead of per-loader KV lookups
- Modified: All OBS source routes — authorization check with redirect to `/private`
- Modified: `workers/core/app/routes/howto/deploy-your-own.tsx` — section on `ALLOWED_USERS`
- New: `/private` route
- New: `ALLOWED_USERS` env var (empty string default in `wrangler.jsonc`, real values in `.dev.vars`)
- Modified: `Env` interface — `ALLOWED_USERS` already a string via wrangler vars
