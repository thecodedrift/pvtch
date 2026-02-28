## Context

PVTCH provides streamer tools as Cloudflare Workers. The progress bar widget is one of the core features — a customizable overlay that streamers add to OBS as a browser source to track goals in real time. The value is updated externally via API calls from chatbots.

## Goals / Non-Goals

**Goals:**
- Customizable bar appearance (background, gradient foreground, goal text, prefix, decimal places)
- Multiple named progress bars per user
- REST API accessible from chatbots (both GET and POST, query params and JSON body)
- Live-updating OBS browser source with polling
- Dashboard with live preview for configuration
- Intelligent text positioning that adapts to bar fill level

**Non-Goals:**
- WebSocket-based real-time updates (polling at 3s is sufficient for OBS)
- Animation or transition effects beyond CSS transitions
- Built-in chatbot integrations (users configure their own bots)
- Progress bar templates or presets

## Decisions

### 1. Separate Durable Objects for config vs value
Config and progress value are stored in separate DO instances (`progress-{name}-config` and `progress-{name}`). This allows the value to be updated at high frequency without touching config, and each can have independent TTL strategies. Config uses `PRESERVE_ON_FETCH` (extends TTL on every read), while values use default TTL behavior.

### 2. Token-in-URL for API access
The API uses `/progress/{token}/{name}/set?value=X` rather than header-based auth. This makes integration trivial for chatbots that support simple HTTP GET requests — many only support URL-based configuration. Both GET and POST are supported for maximum compatibility.

### 3. Polling-based updates for OBS source
The OBS browser source polls via React Router's `revalidator` every 3 seconds. This is simpler than WebSockets, works reliably in OBS's Chromium-based browser, and the 3-second delay is imperceptible for goal tracking. No server-side infrastructure needed beyond the existing DO read path.

### 4. Container queries for responsive text
The progress bar component uses CSS container queries (`containerType: 'size'`) so text sizing scales with the bar dimensions. A ResizeObserver checks whether the progress/goal text fits inside the filled portion and repositions it (pinned left vs right-aligned) accordingly. This ensures the bar looks correct at any OBS source resolution.

### 5. Zod validation for progress values
The set API validates incoming values with `z.number()` to prevent non-numeric data from being stored. Invalid values return HTTP 400.

## Risks / Trade-offs

- **3-second polling latency** → Updates in OBS lag by up to 3 seconds. Acceptable for goal tracking use cases.
- **No auth on set API** → Anyone with the token URL can update the progress value. Mitigated by tokens being high-entropy Base58 and only shared with the user's chatbot.
- **No rate limiting** → The set API has no rate limiting. Mitigated by Durable Objects handling writes efficiently and chatbots typically updating at low frequency.
- **Config duplication** → `parseConfig` is duplicated between the dashboard route and the source route. Minor code smell but keeps the routes self-contained.
