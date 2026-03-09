## Context

The todo widget (`/sources/todo/:channel`) is the only widget without a configuration page. The 1s poll and progress bar both have config UIs at `/widgets/1s` and `/widgets/progress`. The todo config stub currently renders `<div>Todo Widget</div>`. Unlike the 1s poll (horizontal bar chart), the todo widget is a vertical list, which calls for a different layout approach.

## Goals / Non-Goals

**Goals:**

- Config page at `/widgets/todo` with side-by-side layout (config left, preview right on desktop, stacked on mobile)
- Live preview via iframe with demo mode seeding sample tasks
- Controls for: channel, colors (bg/fg), help toggle, max tasks, command names, mod commands behind disclosure
- Copy-to-clipboard OBS URL
- "How to Use" section with "For Chat" and "For Streamers & Mods" subsections
- Command examples in docs reflect custom command names from form state

**Non-Goals:**

- Server-side config storage (stays pure URL params)
- Debug parameter in the UI (dev-only)
- Persisting config across sessions
- Migrating other config pages to the side-by-side layout

## Decisions

### 1. Side-by-side layout instead of sticky top preview

The todo widget is vertical, so a horizontal strip preview (like 1s) wastes space and makes the widget unnaturally small. Instead: two-column layout on desktop (`md+`), stacked on mobile. The right column is sticky so the preview stays visible while scrolling config options.

On mobile, the widget preview goes above the config form (natural reading order: see what you're configuring, then configure it).

**Alternative considered:** Same sticky-top strip as 1s/progress. Rejected because a vertical list squeezed into a 200px horizontal strip is unreadable and doesn't represent the actual widget appearance.

### 2. Demo mode seeds static tasks, skips comfy

Adding a `demo` parameter to the todo source's `paramsParser`. When `demo=true`:

- `useComfy` is NOT initialized (no Twitch chat connection)
- localStorage is seeded with 6 sample tasks: 2 users × 3 tasks each (mix of incomplete, completed, and focused states)
- Tasks are static — no event simulation needed (unlike 1s which simulates votes)

The config page embeds this as an iframe with `?demo=true&bg=...&fg=...`. The iframe src is debounced (500ms) to avoid thrashing on rapid color changes.

**Alternative considered:** Rendering a mock component directly in the config page. Rejected for the same reason as 1s — the iframe guarantees WYSIWYG fidelity.

### 3. Mod commands behind disclosure toggle

The 5 command name inputs (add, done, focus, reset, clear) are split:

- **Always visible:** add, done, focus (the 3 viewer-facing commands, in a 2-column grid with focus spanning or in a 3-col)
- **Behind toggle:** reset, clear (mod-only commands, revealed by a "Change mod commands" switch)

This reduces visual noise since most streamers never rename mod commands.

### 4. OBS URL on right pane below preview

The generated URL and copy button sit on the right pane below the widget preview. This groups "output" together — see the preview, grab the URL. On mobile, the URL appears after the config form (natural flow: configure → get URL).

### 5. "How to Use" goes full-width below the two-column layout

The documentation section spans the full page width below the config/preview columns. This gives it room for readable command examples and avoids cramping the config form.

### 6. ColorSwatch reuse from 1s config

The `ColorSwatch` component (react-colorful `RgbaStringColorPicker` with click-outside and text input) is currently defined inline in the 1s config file. For the todo config, we duplicate the same pattern rather than extracting a shared component — keeping changes minimal and focused.

### 7. Form state is client-only, URL only includes non-defaults

Same pattern as 1s: `useState` for each param, `useMemo` to build the URL including only non-default values. No TanStack Form needed since there's no submit action.

## Risks / Trade-offs

- **iframe preview height** → The todo widget scales fonts relative to viewport height. In a short iframe, text will be small. Acceptable since the preview is for color/layout verification, not exact font size matching.
- **Demo tasks in localStorage** → Demo mode writes to localStorage which could conflict if the same browser also runs the real widget. Mitigated by using a distinct localStorage key or clearing on demo mount. Since demo mode is only used in the config page iframe, this is low risk.
- **Layout divergence from other config pages** → The side-by-side layout is different from 1s/progress. This is intentional and documented — vertical widgets deserve vertical previews. Other pages can adopt this layout later if desired.
