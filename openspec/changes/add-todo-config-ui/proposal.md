## Why

The todo widget is the only widget without a configuration page. Users must manually construct URL parameters to customize it. The progress bar and 1s poll both have config UIs that let streamers visually configure their widget and copy an OBS URL. The todo widget needs the same treatment.

## What Changes

- Add a configuration page at `/widgets/todo` with a side-by-side layout (config left, live preview right) that stacks vertically on mobile
- Add a `demo` URL parameter to the todo source widget that seeds sample tasks for the preview iframe (2 users, 3 tasks each showing incomplete/completed states)
- Config controls: channel input, 2 color pickers (bg/fg), help header toggle, max tasks input, 3 command name inputs (add/done/focus), and mod command names (reset/clear) behind a disclosure toggle
- "How to Use" section with two subsections: "For Chat" and "For Streamers & Mods", with command examples that reflect custom command names
- Zero backend — all config encodes into URL parameters, same pattern as the 1s poll config

## Capabilities

### New Capabilities

- `todo-config-ui`: Configuration page for the todo widget with live preview, form controls, URL generation, and usage documentation

### Modified Capabilities

- `todo`: Adding a `demo` URL parameter that seeds sample task data for the config page preview

## Impact

- New route: `workers/core/app/routes/widgets/todo.tsx` (replaces current stub)
- Modified: `workers/core/app/routes/sources/todo.$channel.tsx` (add demo param support)
- Reuses existing components: `ColorSwatch` pattern from 1s config, `Field`/`FieldLabel`/`FieldDescription`, `Input`, `Switch`, `Button`
- No new dependencies
- No backend/storage changes
