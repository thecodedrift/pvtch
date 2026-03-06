## Context

The 1s in chat overlay (`/sources/1s/:channel`) currently requires users to manually construct URL query strings to configure appearance and behavior. The progress bar widget already has a config page at `/widgets/progress` that serves as a proven pattern. Unlike the progress bar, the 1s overlay is purely URL-parameter driven with no server-side state, so the config page is a URL builder rather than a stored-config editor.

## Goals / Non-Goals

**Goals:**

- Config page at `/widgets/1s` with form fields for all URL parameters
- Live preview via iframe embedding the overlay in demo mode
- Demo mode on the overlay: `?demo=true` disables chat, shows play button, runs compressed simulation
- Auto-fill channel name from Twitch login, with manual edit
- Copy-to-clipboard generated OBS URL
- Inline how-to guide (OBS setup, voting, mod commands, tips)

**Non-Goals:**

- Server-side config storage (stays pure URL params)
- Callback URL configuration (excluded per scope decision)
- Bot integration guides (unlike the lingo helper, this stays simple)
- Persisting config across sessions

## Decisions

### 1. Pure URL builder, no server state

The config page generates a URL string from form state. No loader/action needed for persistence. This means auth is only used to auto-fill the channel name — the page works fully without login. Unlike the progress bar widget which stores config in Durable Objects, this approach keeps the overlay self-contained in its URL.

**Alternative considered:** Server-side storage like progress bar. Rejected because the overlay has no dynamic state to update — all config is static per OBS session, and URL params keep it portable.

### 2. Demo mode via `?demo=true` parameter on the overlay

Adding a `demo` parameter to the existing overlay route. When `demo=true`:

- `useComfy` is NOT initialized (no Twitch chat connection)
- A play button renders in the bottom-right corner
- Clicking play runs a compressed simulation: votes trickle in over ~3s, 10s vote window, 5s lock, then full reset back to ready state
- Duration/cooldown are overridden to 10s/5s regardless of other params

The config page embeds this as an iframe, appending `&demo=true` to the constructed URL. The iframe src updates reactively as form values change, so color/choice changes appear instantly.

**Alternative considered:** Extracting the bar chart into a shared component and rendering it directly in the config page with fake data. Rejected because the iframe approach guarantees WYSIWYG fidelity — the preview IS the overlay.

### 3. Config page lives in app layout

Route: `widgets/1s` inside the `app-layout` layout group, matching the progress bar pattern. Uses the same UI components (Field, FieldLabel, FieldDescription, Input, Button) for consistency.

### 4. Form state is client-only with no persistence

Using `useState` or `useForm` for form state. No TanStack Form needed since there's no submit action — changes are reflected immediately in the URL output and iframe preview. The form is purely reactive.

### 5. Channel name handling

The loader checks for `pvtch_token` cookie and resolves the Twitch username if logged in. The channel input is pre-filled but always editable. If not logged in, the field starts empty and the user types their channel name.

### 6. Guide content is inline, scannable sections

Four sections directly on the page below the URL output: OBS setup, how viewers vote, mod commands, and tips. No tabs, no screenshots, no external links. Concise enough to scan in 30 seconds.

## Risks / Trade-offs

- **iframe preview may flash on every keystroke** → Debounce iframe src updates or use `key` to control re-renders. Color changes can update via URL params without full reload since the overlay reads them on mount.
- **Demo simulation timing is fixed** → The 10s/5s window can't be previewed at other durations. Acceptable since the demo is about showing the visual behavior, not exact timing.
- **No auth required means no saved state** → Users must re-configure each visit. Acceptable trade-off for simplicity; the URL itself is the "saved config" once pasted into OBS.
