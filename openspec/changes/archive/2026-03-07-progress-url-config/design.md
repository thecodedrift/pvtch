## Context

The progress widget currently stores config (fg1, fg2, bg, goal, text, decimal, prefix) in a Durable Object via the `PvtchBackend` class. The config page uses `@tanstack/react-form` to submit config to a server action that writes to the DO. The source route fetches config from the DO on every poll interval (3s), adding unnecessary DO reads for static config data.

The 1s and todo widgets use a simpler pattern: config is encoded in URL query params, parsed with zod in the source route, and the config page is a pure client-side URL builder.

## Goals / Non-Goals

**Goals:**

- Source route parses config from URL search params using zod with defaults
- Config page builds URL with `useState` + `useMemo`, only including non-default params
- Config page keeps the live `<BasicBar>` preview (inline, not iframe — progress bar is horizontal and works well as a sticky strip)
- Keep the progress ID selector (becomes part of the URL path segment)
- Remove DO backend config storage entirely from both routes

**Non-Goals:**

- Changing the progress value read/write (stays on DO backend)
- Adding iframe-based preview (inline `<BasicBar>` is fine for horizontal bars)
- Extracting shared ColorPicker component (keep duplicated like 1s/todo)
- Adding demo mode to the source route (progress doesn't need it — the config page uses the inline `<BasicBar>` component directly)

## Decisions

### 1. Zod param parser in source route

Add a `parameterParser` zod schema to the source route, matching the pattern in `1s.$channel.tsx`. Fields:

- `fg1`: string, default `rgba(255, 255, 255, 1)`
- `fg2`: string, default `rgba(255, 255, 255, 1)`
- `bg`: string, default `rgba(0, 0, 0, 1)`
- `goal`: string → number transform, default `100`
- `text`: string, default `''`
- `decimal`: string → number transform, default `0`
- `prefix`: string, default `''`

URL search params are always strings, so numeric fields use `.transform()` to parse integers (same pattern as 1s duration/cooldown).

### 2. Config page becomes a URL builder

Replace `@tanstack/react-form` + `useFetcher` with individual `useState` hooks per field and `useMemo` to build the OBS URL. Only non-default values are included in the URL params.

The config page loader simplifies to just auth check + channel resolution (for generating the token-based URL). No more DO config fetch. The action is removed entirely.

### 3. Keep inline BasicBar preview

The progress bar is a thin horizontal strip that works well rendered inline (unlike vertical widgets like todo). Keep the current sticky `<BasicBar>` preview but wire it to `useState` values instead of `useStore(form.store)`. The preview shows a hardcoded progress of 64 (same as current).

### 4. ID selector stays as URL path segment

The progress ID (e.g., "default", "subs", "donations") remains as the `$name` path segment in `/sources/progress/$token/$name`. The config page keeps the ID selector UI, but instead of triggering a loader refetch, it just updates the generated URL.

### 5. Update API URL stays the same

The update API (`/progress/$token/$name/set?value=X`) is unchanged — it writes to the DO backend for the progress value. The config page still displays this URL.

## Risks / Trade-offs

- **URL length** — 7 config params can make URLs long, but they're pasted into OBS once and forgotten. Only non-default params are included, so minimal configs stay short.
- **Config not persisted** — Changing config requires updating the OBS browser source URL. This matches 1s and todo behavior and is acceptable for a "configure once" workflow.
- **Existing DO configs orphaned** — Users who saved config to the DO will lose those settings when they update their OBS URL. Since the config page will generate a fresh URL with defaults, this is a clean break. Old DO config data will expire via TTL (30 days).
