## Why

The progress widget is the only widget that stores visual config (colors, goal, text, prefix, decimal) in the Durable Object backend. The 1s and todo widgets already use URL-based config — all appearance settings are encoded as query params in the OBS browser source URL. Moving progress to the same pattern eliminates the last arbitrary config storage in the DO backend, leaving it used only for the actual progress value (the polled numeric data). This simplifies the system and makes the DO backend's role clearer: it stores ephemeral data values, not UI config.

## What Changes

- The progress config page (`/widgets/progress`) switches from a form-submit-to-backend model to a URL-builder model (like 1s and todo)
- The progress source route (`/sources/progress.$token.$name`) parses config from URL query params using zod instead of fetching from the DO backend
- The config page no longer needs a server action or DO backend calls for config
- The progress source's loader only fetches the progress value from the DO, not config
- Remove the `parseConfig` function and DO config fetch from the source route
- The config page drops `@tanstack/react-form` (no longer submitting a form) and uses `useState` + `useMemo` like the 1s widget

## Capabilities

### Modified Capabilities

- `progress-source`: Config comes from URL params instead of DO backend storage
- `progress-config`: Switches from form+save to URL builder pattern

## Impact

- Modified: `workers/core/app/routes/sources/progress.$token.$name.tsx` (parse config from URL params via zod, remove DO config fetch)
- Modified: `workers/core/app/routes/widgets/progress.tsx` (URL builder instead of form submit, remove action, simplify loader)
- No new routes or files needed
- No new dependencies (removes `@tanstack/react-form` usage from this file)
- The progress ID selector remains — it becomes part of the URL path, not a DO key lookup
