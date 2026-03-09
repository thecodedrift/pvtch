## 1. Context and Environment Setup

- [x] 1.1 Add `instanceAccessContext` to `app/context.ts` with `InstanceAccess` interface (`isPrivate: boolean`, `isAllowed: boolean`)
- [x] 1.2 Add `ALLOWED_USERS: ""` to `wrangler.jsonc` vars
- [x] 1.3 Add `ALLOWED_USERS` example to `.dev.vars.example`

## 2. Auth Middleware

- [x] 2.1 Create `app/middleware/auth.ts` that parses `pvtch_token` cookie, calls `isValidToken()`, fetches user data from KV, and sets `userContext`
- [x] 2.2 Add allow list logic to the middleware: parse `ALLOWED_USERS`, compute `isPrivate`/`isAllowed`, set `instanceAccessContext`
- [x] 2.3 Wire middleware into routes via route config (ensure it runs on all app layout routes and source routes)

## 3. Refactor Loaders to Use Context

- [x] 3.1 Update `widgets/progress.tsx` loader to read `userContext` and `instanceAccessContext` from context, remove `parseCookies` and `isValidToken` calls, redirect to `/private` if private and not allowed
- [x] 3.2 Update `widgets/todo.tsx` loader similarly
- [x] 3.3 Update `widgets/1s.tsx` loader similarly
- [x] 3.4 Update `helpers/lingo.tsx` loader similarly
- [x] 3.5 Update OBS source routes (`sources/progress.$token.$name.tsx`, `sources/todo.$channel.tsx`, `sources/1s.$channel.tsx`) to check authorization and redirect to `/private`
- [x] 3.6 Update any other loaders that use `parseCookies`/`isValidToken` directly (welcome, auth routes)

## 4. Private Page and Header UX

- [x] 4.1 Create `/private` route (`app/routes/private.tsx`) with heading, explanation text, and link to `/howto/deploy-your-own`
- [x] 4.2 Pass `isPrivate` and `isAllowed` from root layout loader data to `TwitchLogin` component
- [x] 4.3 Update `TwitchLogin` to show `X` icon and `/private` link when logged in but not allowed on a private instance

## 5. Documentation

- [x] 5.1 Add "Locking Down Your Instance" section to `deploy-your-own.tsx` explaining the `ALLOWED_USERS` env var with examples
