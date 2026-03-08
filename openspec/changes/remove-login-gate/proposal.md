## Why

Every page behind the app layout currently requires Twitch login before showing any content. Most pages (todo config, 1s poll config, deploy guide) don't need auth at all — their config is URL params or static content. Even pages that do need auth (progress bar, lingo) have large sections (preview, docs, setup guides) that are valuable without logging in. This gates discoverability and makes the app feel closed when it should feel open.

## What Changes

- Remove the full-page auth gate from all config/app pages — pages load and render their content without login
- On pages that need a token (progress, lingo), show an inline login prompt only in the section that requires auth (URL generation, config save), while keeping the rest of the page open
- Replace `<RequireTwitchLogin />` with a new `<AuthGate>` wrapper component that renders children when authenticated and a trust-copy login prompt when not
- Trust copy explains why login is needed: identity only, no permissions requested, minimal data stored
- Update the homepage CTA from "Get Started with Twitch" to "Explore Tools" — login is no longer the entry point
- The header `<TwitchLogin />` button remains unchanged — users can still log in from any page

## Capabilities

### New Capabilities

- `auth-gate`: Inline auth gate component that wraps token-dependent UI sections, showing a trust-copy login prompt when unauthenticated and rendering children when authenticated

### Modified Capabilities

- `auth`: The auth guard component (`RequireTwitchLogin`) is replaced by the new `AuthGate` pattern. Pages no longer do full-page auth blocking — auth is inline and scoped to sections that need it.

## Impact

- Modified: `workers/core/app/routes/widgets/progress.tsx` — show full config UI openly, auth-gate only the URL section
- Modified: `workers/core/app/routes/helpers/lingo.tsx` — show description and setup guide openly, auth-gate config form and translate URL
- Modified: `workers/core/app/routes/_index.tsx` — change primary CTA to "Explore Tools"
- Modified: `workers/core/app/components/require-twitch-login.tsx` — replaced by new `AuthGate` component
- No backend changes, no new dependencies, no route structure changes
