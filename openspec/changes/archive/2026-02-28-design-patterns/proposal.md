## Why

PVTCH's codebase follows consistent patterns across all features. Documenting these patterns ensures new features maintain architectural consistency and developers understand the conventions without reverse-engineering existing code. This covers routing architecture, UI component patterns, form handling, OBS embed conventions, and the shared layout system.

## What Changes

- Document the route-based architecture with four route categories: dashboard pages, OBS sources, API endpoints, and auth routes
- Document the UI component library pattern (Radix + CVA + Tailwind)
- Document the app layout system with sidebar navigation and responsive design
- Document the OBS embed pattern (no layout, transparent backgrounds, polling/chat)
- Document the form handling pattern (TanStack React Form + Zod validation)
- Document the `cn()` utility and theming approach (next-themes)
- Document the deprecated route pattern (HTTP 410 Gone)
- Document the API design conventions (token-in-URL, dual GET/POST support, fail-safe responses)

## Capabilities

### New Capabilities
- `design-patterns`: Architectural patterns, UI conventions, routing categories, form handling, OBS embed pattern, API design, and component library structure

### Modified Capabilities

(none)

## Impact

- **Cross-cutting**: These patterns apply to all existing and future features
- **No code changes**: This is documentation of existing patterns
