## Context

Twitch streamers often use task/to-do lists during coding streams, art streams, or productivity sessions. The todo widget runs entirely client-side in the OBS browser source, connecting directly to Twitch chat via ComfyJS. No server-side storage is needed — tasks persist via localStorage in the OBS browser context.

## Goals / Non-Goals

**Goals:**
- Interactive task management through Twitch chat commands
- Per-user task lists with individual completion tracking
- Customizable command names and appearance via URL parameters
- Auto-scrolling when content overflows the viewport
- Streamer's tasks prioritized in sort order
- Mod/broadcaster administrative controls

**Non-Goals:**
- Server-side task persistence or sync across devices
- Authentication (widget uses channel name in URL, not token)
- Task editing or reordering after creation
- Webhooks or API integration for task updates

## Decisions

### 1. Client-side only architecture
Tasks are stored in the OBS browser's localStorage, not in Durable Objects. This avoids API calls for every chat interaction, keeps latency minimal (direct ComfyJS event → React state), and means the widget works without authentication. The trade-off is that tasks are lost if the OBS browser source is recreated.

### 2. ComfyJS for Twitch chat
ComfyJS provides a simple read-only Twitch IRC client that runs in the browser. The `useComfy` hook wraps it with EventEmitter3 for typed event handling. This avoids needing a server-side Twitch connection or EventSub integration.

### 3. Semicolon-separated task input
Tasks are separated by semicolons (`!add task1; task2; task3`) rather than commas, since commas are common in natural language task descriptions. Users can add multiple tasks in a single command.

### 4. Index-based completion
Tasks are completed by their display index (`!done 1 2 3`), which corresponds to the sorted position within the user's own task list. This is intuitive for users who can see the numbered list on stream. If no index is provided, `!done` defaults to completing task 1.

### 5. Infinite scroll animation
When tasks exceed the viewport, the content is duplicated and a CSS animation scrolls through both copies seamlessly. Scroll duration scales with task count (1.4s per task, clamped between 8s and 120s). A ResizeObserver triggers the scroll calculation on content size changes.

### 6. Task sorting priority
Tasks sort by: (1) streamer's tasks first, (2) username alphabetically, (3) incomplete before complete, (4) higher focus timestamp first, (5) older tasks first. This ensures the streamer's own tasks are always visible at the top.

### 7. Per-user task limits
Each user is limited to a configurable number of incomplete tasks (default 5, via `count` URL parameter). A warning message appears when the limit is reached. This prevents spam abuse.

## Risks / Trade-offs

- **localStorage only** → Tasks are lost if OBS browser source cache is cleared. Acceptable for stream-session scoped data.
- **No authentication** → Anyone who knows the channel name can view the source URL. Not a security concern since the URL doesn't expose sensitive data.
- **ComfyJS singleton** → Only one Twitch channel can be connected per page. Enforced by the `useComfy` hook throwing on mismatch.
