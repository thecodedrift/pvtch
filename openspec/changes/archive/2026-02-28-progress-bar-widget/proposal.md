## Why

Streamers need a way to display real-time progress toward goals (sub counts, donation targets, arbitrary metrics) as OBS browser source overlays. The progress bar widget provides a customizable, embeddable overlay that can be updated programmatically via API from chatbots like Firebot or MixItUp.

## What Changes

- Dashboard page for configuring progress bar appearance (colors, goal, text, prefix, decimal places)
- OBS browser source that renders the progress bar with 3-second polling for live updates
- REST API for getting and setting progress values (`GET`/`POST` via query params or JSON body)
- Configuration persistence via Durable Objects with 30-day TTL
- Multiple named progress bars per user (e.g., `default`, `subs`, `donations`)
- Live preview while editing configuration
- Responsive visual component with container queries and intelligent text positioning

## Capabilities

### New Capabilities
- `progress-bar`: Customizable OBS overlay progress bar with REST API for value updates, dashboard configuration UI, and live-polling browser source display

### Modified Capabilities

(none)

## Impact

- **Routes**: `/widgets/progress` (dashboard), `/sources/progress/:token/:name` (OBS embed), `/progress/:token/:name/get` and `/progress/:token/:name/set` (API)
- **Components**: `BasicBar` rendering component with ResizeObserver-based text positioning
- **Durable Objects**: Two DO instances per progress bar (config + value), keyed by `{token}::{progress-{name}}` and `{token}::{progress-{name}-config}`
- **Dependencies**: Requires auth system for token validation; uses `@tanstack/react-form` for configuration form
