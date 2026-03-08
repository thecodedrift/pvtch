## Context

All pages under the app layout currently use a full-page auth pattern: the loader checks for a valid `pvtch_token` cookie, and if absent, the component returns `<RequireTwitchLogin />` instead of the page content. This means unauthenticated users see only "To use this widget, please Login With Twitch" — no preview, no docs, no configuration UI.

The loaders already return `{ authenticated: false }` cleanly. The auth check stays in the loader; only the rendering behavior changes.

## Goals / Non-Goals

**Goals:**

- All config pages render their full content without login
- Token-dependent sections (URL generation, config save/load) show an inline login prompt when unauthenticated
- The login prompt includes trust copy explaining why login is needed and what data is stored
- Homepage primary CTA directs users to explore tools, not to log in

**Non-Goals:**

- Changing the auth flow itself (OAuth, KV storage, token generation)
- Moving any page out of the app layout
- Changing the header login button behavior
- Removing the `/welcome` route (still useful as a post-login landing)

## Decisions

### 1. `<AuthGate>` wrapper component replaces `<RequireTwitchLogin />`

A new `<AuthGate>` component takes children and an `authenticated` boolean prop. When authenticated, it renders children directly. When not, it renders the trust-copy login prompt.

```
<AuthGate authenticated={loaderData.authenticated}>
  <UrlSection token={loaderData.token} />
</AuthGate>
```

**Why a wrapper instead of keeping the current component:** The current `RequireTwitchLogin` is a standalone block — it replaces the entire page. The new pattern needs to be embeddable at any point in a page's layout. A wrapper with children is the natural React pattern for this.

**Alternative considered:** A hook (`useAuthGate`) that returns either the gated content or the prompt. Rejected — JSX composition via children is simpler and more readable than conditional hook returns.

### 2. Trust copy is part of the `<AuthGate>` component

The explanation text lives inside `<AuthGate>`, not as a separate component. Every login prompt gets the same copy:

> **Why log in?** We use Twitch login only to identify you — we don't request any permissions on your account. We store your Twitch username and a generated token, nothing else.

This keeps the trust message consistent across all pages and colocated with the login button.

### 3. Progress page: full config open, auth-gate the URLs

The progress page has two distinct zones:

- **Config zone** (colors, goal, text, preview) — all client-side `useState`, no token needed. Fully open.
- **URL zone** (OBS URL, Update API URL) — needs the token to construct URLs. Wrapped in `<AuthGate>`.

The "How to Use" docs section below the URLs is also open.

### 4. Lingo page: description and setup guide open, auth-gate the config form

The lingo page restructures into:

- **Open top**: Page title, description of what Lingo does
- **Auth-gated middle**: Config form (bots, language, save button) and Translate URL — wrapped in `<AuthGate>`
- **Open bottom**: Setup guide (Firebot/MixItUp/etc tabs with screenshots)

This is a layout reorder — the setup guide currently sits below the form. Moving it below the auth gate means unauthenticated users see: description → login prompt → setup guide. The guide helps them understand the tool before committing to login.

### 5. Homepage CTA changes to "Explore Tools"

The primary hero CTA changes from "Get Started with Twitch" (linking to `/auth/start`) to "Explore Tools" (linking to `/widgets/progress`). The secondary "Explore Tools" button is removed or repurposed. The footer CTA similarly shifts — it can link to `/widgets/progress` or stay as a login option since login is still available.

The "Login with Twitch" button remains in the header for users who want to log in proactively.

### 6. Loader changes are minimal

The loaders in progress and lingo already handle the unauthenticated case by returning `{ authenticated: false }`. No loader changes needed — the only changes are in the render functions where `if (!authenticated) return <RequireTwitchLogin />` becomes a scoped `<AuthGate>` wrapper around specific sections.

## Risks / Trade-offs

- **Token leakage in client state** → When unauthenticated, `loaderData.token` is undefined. Components that use the token (URL builders) are inside `<AuthGate>`, so they only render when token exists. No risk of undefined token access.
- **Page feels incomplete without login** → The progress page will show color pickers and preview but no URLs. Mitigated by the `<AuthGate>` prompt clearly explaining what login unlocks. The UX is "try before you buy."
- **Lingo layout reorder** → Moving the setup guide below the auth gate changes the page flow for logged-in users (form → URL → guide instead of form → guide → URL). This is actually better — the URL is more immediately useful than the guide, and logged-in users already know what Lingo does.
