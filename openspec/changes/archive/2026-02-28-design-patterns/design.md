## Context

PVTCH is built on React Router 7 (full-stack SSR) deployed as a Cloudflare Worker. The application has evolved a set of consistent patterns that govern how routes, components, and integrations are structured. This design document captures these patterns as a reference for maintaining consistency.

## Goals / Non-Goals

**Goals:**
- Document all architectural patterns used across the codebase
- Establish conventions for route categories, component structure, and API design
- Provide guidance for implementing new features consistently

**Non-Goals:**
- Proposing changes to existing patterns
- Documenting third-party library APIs
- Style guide for CSS/visual design (only structural patterns)

## Decisions

### 1. Four route categories
Routes are organized into four categories, each with distinct conventions:
- **Dashboard pages** (`/widgets/*`, `/helpers/*`): Full layout with sidebar, require auth, use TanStack Form for config
- **OBS sources** (`/sources/*`): No layout wrapper, transparent backgrounds, minimal HTML for embedding in OBS
- **API endpoints** (`/progress/*`, `/lingo/*`): Loader/action only (no component), return JSON or plain text
- **Auth routes** (`/auth/*`): Loader only, handle OAuth redirects

### 2. Dual request method support
API endpoints support both GET (query params) and POST (JSON body) for the same operation. This maximizes compatibility with chatbot tools that may only support GET URLs. A shared handler function processes both methods identically.

### 3. Token-in-URL API security
All API routes use the user's PVTCH token directly in the URL path (e.g., `/progress/{token}/{name}/set`). This works without cookies, enabling OBS browser sources and chatbot integrations. The token is validated against KV on every request.

### 4. Fail-safe API responses
API endpoints called by chatbots return HTTP 200 with empty body on all error paths. This prevents chatbots from displaying error messages in Twitch chat. Actual errors are logged server-side via `console.error`.

### 5. UI component library
Components follow the shadcn/ui pattern: Radix UI primitives wrapped with TailwindCSS styling via CVA (class-variance-authority). The `cn()` utility (clsx + tailwind-merge) handles conditional class composition. Components include: Button (with `action` brand variant), Input, Field, Label, Tabs, DropdownMenu, Separator, Sonner (toasts).

### 6. App layout with sidebar navigation
Dashboard pages share a layout component (`app-layout.tsx`) providing: sticky header with logo, GitHub link, theme toggle, and login button; collapsible sidebar with categorized navigation (Widgets, Helpers, Support); responsive mobile sidebar with overlay. OBS sources bypass this layout entirely.

### 7. Theme system
Uses `next-themes` with class-based dark/light mode switching. Default theme is dark. OBS sources use `useNoTheme` hook to disable theme switching and render bare.

### 8. Form handling pattern
Dashboard configuration forms use TanStack React Form with React Router's `useFetcher` for submission. Pattern: `useForm` → `form.handleSubmit` → `fetcher.submit(formData)` → action handler → Durable Object storage. Toast notifications (Sonner) confirm save success.

### 9. Deprecated route handling
Old API routes that have been superseded return HTTP 410 (Gone) instead of 404. This signals to consumers that the endpoint existed but has been replaced, rather than never having existed.

### 10. SEO and meta
Dashboard pages include structured meta tags (title, description, og:title, og:description) via React Router's `meta` export. OBS sources use minimal meta (just a title).

## Risks / Trade-offs

- **No shared API middleware** → Token validation is duplicated in each API route's handler. Each route validates independently. This is intentional to keep routes self-contained but means validation logic must be kept in sync.
- **No component storybook** → UI components are not documented outside of usage in the app. Developers discover components by reading existing route code.
