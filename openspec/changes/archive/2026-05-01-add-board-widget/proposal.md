## Why

Streamers want a simple, OBS-friendly info card they can update during a stream — rules, today's goal, current speedrun PB, command lists, etc. Right now the only way to surface text on stream is to hand-edit a browser source's HTML or use a third-party tool. Existing PVTCH widgets (`progress`, `todo`, `1s`) are all single-purpose and don't fit free-form text.

This adds a **board widget**: a small markdown-rendered card with a read-only OBS overlay URL and a separate edit URL. Mods can be handed the edit URL without sharing Twitch credentials. A streamer can keep a few of these (e.g., one for rules, one for today's schedule) and switch which is on screen by changing OBS's source URL.

## What Changes

- New mini-app at `/board/:id` (read-only, polled, themed for OBS) and `/board/:id/edit/:key` (editor with markdown preview, save history, and presence)
- New management UI at `/board` (authed) listing the streamer's boards with copy-URL/rotate-key/delete actions, and `/board/new` to create
- New `Board` plugin on the existing `User` Durable Object — sibling to `progress`, `lingo`, `profile`
- `boardId = ${twitchUserId}-${slotId}` where `slotId` is a random 8-char `[a-z0-9]` token. The owning User DO is parsed directly from the URL — no KV indirection
- Polling-based realtime: 3s revalidation on the read-only overlay; 5s heartbeat presence + revalidation on the editor. **No WebSockets** — optimistic concurrency on save handles overwrite prevention
- Markdown rendering via `markdown-it` in the loader with `html: false` (raw HTML in source is escaped to text, never parsed) and a `validateLink` override restricting URL schemes to `http(s):` / `mailto:`. No separate sanitizer needed. Read-only loader returns pre-rendered HTML; markdown source never crosses the wire on the public route
- Limits: max 5 boards per user, max 5KB per content revision, max 10 history entries per board (worst case ~275KB per user)
- History: every save and revert appends an entry. Revert creates a _new_ history entry; never rewrites history. History stores `{ts, editorName, contentHash, content}` and never the editKey
- Editor name: prompted on first edit, persisted in `localStorage` per-domain, attached to history rows and presence rows. No server validation beyond length cap and control-char stripping — the `editKey` is the actual gate
- Theme: single default theme to start. URL-driven via `?theme=` query string. Theme overrides for v2

## Capabilities

### New Capabilities

- `board`: A streamer-owned, anonymous-by-URL markdown info card. Includes the read-only OBS overlay route, editor route with optimistic concurrency, presence heartbeat, save history with revert, server-side markdown rendering pipeline, management UI, and per-user limits.

### Modified Capabilities

- `storage`: The `User` Durable Object gains a `Board` plugin alongside `Progress`, `Lingo`, and `Profile`. The plugin owns three SQLite tables (`boards`, `board_history`, `board_presence`) keyed internally by `slot_id`, and exposes RPC methods for create/read/save/revert/delete/list/presence operations.

## Impact

- New: `workers/core/do/plugins/board.ts` — Board plugin with SQL migrations and RPC methods
- New: `workers/core/app/routes/board.$id.tsx` — read-only OBS source route
- New: `workers/core/app/routes/board.$id.edit.$key.tsx` — editor route (loader, save action, presence action, revert action)
- New: `workers/core/app/routes/board._index.tsx` — management UI (list)
- New: `workers/core/app/routes/board.new.tsx` — create action
- New: `workers/core/app/lib/markdown.ts` — markdown-it configured with `html: false` + custom `validateLink`
- New: `workers/core/app/lib/board-id.ts` — `newSlotId()` (nanoid 8, alphabet `[a-z0-9]`), `composeBoardId(userId, slotId)`, `parseBoardId(boardId): { userId, slotId } | null` with format validation
- New: `workers/core/app/components/board-editor.tsx` — textarea + preview + history sidebar + presence roster
- Modified: `workers/core/do/user.ts` — register `Board` plugin alongside existing plugins
- Modified: `workers/core/app/routes.ts` — register new routes
- Modified: `workers/core/package.json` — add `markdown-it` and `@types/markdown-it`. `nanoid` is already present.
- Existing `<SecretCopy>` component and Twitch auth middleware are reused as-is
