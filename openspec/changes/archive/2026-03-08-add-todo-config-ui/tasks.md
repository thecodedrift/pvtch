## 1. Demo mode for todo source

- [x] 1.1 Add `demo` parameter to `paramsParser` in `sources/todo.$channel.tsx` (boolean, default false)
- [x] 1.2 When `demo=true`, skip `useComfy` initialization and seed localStorage with 6 sample tasks (2 users × 3 tasks: mix of incomplete, completed, focused states)
- [x] 1.3 Verify demo mode renders correctly with sample data and respects color/help params

## 2. Config page scaffold and layout

- [x] 2.1 Replace stub in `widgets/todo.tsx` with route module (meta, loader with auth/channel resolution, default export)
- [x] 2.2 Implement two-column layout: config left, preview right on `md+`, stacked (preview on top) on mobile
- [x] 2.3 Add sticky positioning to right pane so preview stays visible while scrolling config

## 3. Live preview

- [x] 3.1 Add iframe preview loading todo source with `demo=true` and current form params
- [x] 3.2 Implement 500ms debounce on iframe src updates
- [x] 3.3 Build OBS URL with `useMemo`, only including non-default params

## 4. Config form controls

- [x] 4.1 Add channel name input with auto-fill from loader (authenticated Twitch user)
- [x] 4.2 Add ColorSwatch components for background (bg) and text (fg) colors with RGBA picker
- [x] 4.3 Add "Show Help Header" toggle (Switch component, default on)
- [x] 4.4 Add "Max Tasks per User" numeric input (default 5)
- [x] 4.5 Add command name inputs for add, done, focus in a 2-column grid
- [x] 4.6 Add "Change mod commands" disclosure toggle that reveals reset/clear command inputs

## 5. URL output

- [x] 5.1 Add read-only OBS URL input with copy-to-clipboard button on the right pane below preview
- [x] 5.2 Show toast on successful copy

## 6. How to Use documentation

- [x] 6.1 Add full-width "How to Use" section below the two-column layout
- [x] 6.2 Write "Add to OBS" section with browser source setup and resize warning
- [x] 6.3 Write "For Chat" section with command examples reflecting custom command names from form state
- [x] 6.4 Write "For Streamers & Mods" section with mod command examples reflecting custom names
- [x] 6.5 Add tips section (task limit, localStorage persistence, streamer-first sorting, auto-scroll)
