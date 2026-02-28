## Why

Streamers and their communities benefit from shared task tracking during streams. The todo widget provides a live OBS overlay where viewers can add, complete, and focus tasks via Twitch chat commands, creating an interactive and collaborative to-do list visible on stream.

## What Changes

- Client-side OBS browser source that connects to Twitch chat via ComfyJS
- Chat command system for task management: add, done, focus, reset, clear
- Per-user task lists with completion tracking, focus/priority system, and sorting
- Auto-scrolling animation when content exceeds viewport height (with duplicated content for seamless loop)
- Customizable appearance and command names via URL query parameters
- LocalStorage persistence for task state across page reloads
- Mod/broadcaster-only administrative commands (reset, clear)

## Capabilities

### New Capabilities
- `todo`: Client-side OBS overlay for chat-driven task tracking with customizable commands, auto-scrolling, per-user task lists, and mod controls

### Modified Capabilities

(none)

## Impact

- **Routes**: `/sources/todo/:channel` (OBS browser source)
- **Dependencies**: ComfyJS for Twitch chat, `rooks` for localStorage state and ResizeObserver, `nanoid` for task IDs, `clsx` for conditional classes
- **Client-side only**: No server-side state — all data lives in the browser's localStorage within OBS
- **Hooks**: Uses `useComfy` for Twitch chat connection, `useNoTheme` for bare embed rendering
