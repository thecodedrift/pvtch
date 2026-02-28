## 1. Route Architecture

- [x] 1.1 Create `app/routes.ts` with centralized route definitions organized by category (dashboard, sources, API, auth, deprecated)
- [x] 1.2 Implement deprecated route pattern returning HTTP 410 Gone for superseded API endpoints
- [x] 1.3 Add catch-all 404 route

## 2. App Layout

- [x] 2.1 Create `app/components/layout/app-layout.tsx` with sticky header, sidebar navigation, and responsive mobile overlay
- [x] 2.2 Define navigation structure with collapsible sections (Widgets, Helpers, Support)
- [x] 2.3 Integrate theme toggle, GitHub link, and TwitchLogin in header

## 3. Root Layout & Theme

- [x] 3.1 Create `app/root.tsx` with HTML shell, ThemeProvider (next-themes), Toaster, and ErrorBoundary
- [x] 3.2 Configure Inter font via Google Fonts preconnect
- [x] 3.3 Create `app/hooks/use-no-theme.ts` for disabling theme on OBS embed pages

## 4. UI Component Library

- [x] 4.1 Create `app/components/ui/button.tsx` with CVA variants (default, action, destructive, outline, secondary, ghost, link) and Radix Slot support
- [x] 4.2 Create `app/components/ui/input.tsx`, `label.tsx`, `field.tsx` form components
- [x] 4.3 Create `app/components/ui/tabs.tsx`, `dropdown-menu.tsx`, `separator.tsx` Radix wrappers
- [x] 4.4 Create `app/components/ui/sonner.tsx` toast notification integration
- [x] 4.5 Create `app/lib/utils.ts` with `cn()` utility combining clsx and tailwind-merge

## 5. Cloudflare Worker Entry

- [x] 5.1 Create `cloudflare/handler.ts` with request handler, context injection, and Durable Object re-export
