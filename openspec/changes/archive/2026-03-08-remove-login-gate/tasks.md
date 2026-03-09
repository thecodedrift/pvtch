## 1. AuthGate component

- [x] 1.1 Create `<AuthGate>` component in `workers/core/app/components/auth-gate.tsx` that accepts `authenticated` boolean prop and children, renders children when authenticated, renders trust-copy login prompt with `<TwitchLogin>` when not
- [x] 1.2 Write trust copy text: identity-only login, no permissions, minimal data stored
- [x] 1.3 Remove or deprecate `workers/core/app/components/require-twitch-login.tsx`

## 2. Progress page

- [x] 2.1 Remove the full-page `if (!authenticated) return <RequireTwitchLogin />` guard from `widgets/progress.tsx`
- [x] 2.2 Wrap only the URL output section (OBS URL, Update API URL) in `<AuthGate>`
- [x] 2.3 Verify config controls (colors, goal, text, preview) work without authentication

## 3. Lingo page

- [x] 3.1 Remove the full-page `if (!authenticated) return <RequireTwitchLogin />` guard from `helpers/lingo.tsx`
- [x] 3.2 Wrap the config form (bots, language, save) and Translate URL section in `<AuthGate>`
- [x] 3.3 Move the setup guide (`<SetupGuide>`) below the auth-gated section so unauthenticated users see: description → login prompt → setup guide

## 4. Homepage

- [x] 4.1 Change the primary hero CTA from "Get Started with Twitch" to "Explore Tools" linking to `/widgets/progress`
- [x] 4.2 Update or remove the footer CTA that currently links to `/auth/start`

## 5. Cleanup

- [x] 5.1 Remove `RequireTwitchLogin` imports from progress and lingo routes
- [x] 5.2 Verify the header `<TwitchLogin>` button still works correctly on all pages
