## 1. Dependencies and shared utilities

- [x] 1.1 Add `markdown-it` and `@types/markdown-it` to `workers/core/package.json`; run `pnpm install`. No `sanitize-html` — markdown-it's `html: false` plus a `validateLink` override is the entire XSS strategy
- [x] 1.2 Verify `nanoid` is already a dependency (it is — used in `sources/todo.$channel.tsx`)
- [x] 1.3 Create `workers/core/app/lib/markdown.ts` exporting `renderBoardMarkdown(source: string): string`. Configure markdown-it per `design.md` §6: `{ html: false, linkify: true, typographer: false, breaks: true }` and override `validateLink` to allow only `http(s):`, `mailto:`, relative `/...`, and fragment `#...` URLs
- [x] 1.4 Create `workers/core/app/lib/board-id.ts` exporting: `newSlotId()` using `nanoid` `customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 8)`; `newEditKey()` using default nanoid at 24 chars; `composeBoardId(userId, slotId): string`; `parseBoardId(boardId): { userId, slotId } | null` that splits on the last `-`, validates `userId` matches `^\d+$` and `slotId` matches `^[a-z0-9]{8}$`

## 2. Board plugin on the User DO

- [x] 2.1 Create `workers/core/do/plugins/board.ts` with the `Board` class extending `RpcTarget`, mirroring the shape of `lingo.ts` and `progress.ts`
- [x] 2.2 Add migration v1 creating tables `boards`, `board_history`, `board_presence` and indexes per `design.md` §3
- [x] 2.3 Implement RPC method `list(): { slotId, name, updatedAt }[]` — owner-facing list (no editKey returned). Route layer composes the public boardId from the DO's userId + slotId
- [x] 2.4 Implement RPC method `getEditUrlInfo(slotId): { editKey } | undefined` — owner-only helper used by the management UI
- [x] 2.5 Implement RPC method `create(name?): { slotId, editKey }` — generates slotId + editKey, inserts row, enforces 5-board cap; returns a sentinel error shape if at cap
- [x] 2.6 Implement RPC method `read(slotId): { name, content, version, updatedAt } | undefined` — used by the read-only loader
- [x] 2.7 Implement RPC method `readForEdit(slotId, editKey): { name, content, version } | { error: 'not_found' | 'forbidden' }`
- [x] 2.8 Implement RPC method `save(slotId, editKey, content, baseVersion, editorName): { version } | { error: 'not_found' | 'forbidden' | 'too_large' | 'conflict', currentContent?, currentVersion? }` — does size check, version check, transactional update, history insert, history trim
- [x] 2.9 Implement RPC method `revert(slotId, editKey, historyId, baseVersion, editorName)` — loads history content, calls `save` with that content
- [x] 2.10 Implement RPC method `delete(slotId)` — owner only; deletes row + cascades history
- [x] 2.11 Implement RPC method `rotateEditKey(slotId): { editKey }` — owner only
- [x] 2.12 Implement RPC method `heartbeat(slotId, sessionId, name)` — UPSERT into `board_presence` with `last_seen = now`
- [x] 2.13 Implement RPC method `getPresence(slotId): { sessionId, name, lastSeen }[]` — returns rows with `last_seen > now - 20000`; opportunistically prunes older rows
- [x] 2.14 Implement RPC method `getHistory(slotId, editKey): { id, ts, editorName, contentHash }[]` — last 10, no full content (preview-only); separate method `getHistoryEntry(slotId, editKey, id)` for fetching one entry's content for revert/preview
- [x] 2.15 Wire `Board` into `workers/core/do/user.ts`: import, instantiate in constructor, expose `board()` accessor

## 3. Routes — public

- [x] 3.1 Create `workers/core/app/routes/board.$id.tsx` (read-only OBS source). Loader: `parseBoardId(params.id)` → 404 on parse failure → `env.PVTCH_USER.idFromName('twitch:' + userId)` → `board().read(slotId)` → 404 if undefined → `renderBoardMarkdown(content)` → `data({ safeHtml, name, version })`. Component: poll via `useRevalidator` at 3s, render `safeHtml` via `dangerouslySetInnerHTML`, themed background/foreground with sensible defaults. Use `useNoTheme()` like other source routes
- [x] 3.2 Create `workers/core/app/routes/board.$id.edit.$key.tsx`. Loader: `parseBoardId` → User DO via `twitch:userId` → `board().readForEdit(slotId, key)` → 404/403 as appropriate, plus pre-rendered HTML for preview, plus `getPresence` and `getHistory`. Component: textarea + live preview pane + presence roster + history sidebar
- [x] 3.3 Add a save action on the edit route: parse boardId, read `{ content, baseVersion, editorName }` from POST body, call `board().save(slotId, key, ...)`. On 409 return current state for the conflict UI. On 413 return error for size message. On 403 return error for "key rotated" message
- [x] 3.4 Add a presence action on the edit route (separate POST endpoint or distinguished `intent` form field): parse boardId, call `board().heartbeat(slotId, ...)`
- [x] 3.5 Add a revert action on the edit route: parse boardId, call `board().revert(slotId, key, ...)` and return the new state
- [x] 3.6 Editor name UX: prompt on first edit (no name in localStorage), persist to `localStorage['pvtch.board.editorName']`, surface inline "edit name" in the editor header

## 4. Routes — owner / management

- [x] 4.1 Create `workers/core/app/routes/board._index.tsx` (path `/board`). Auth-gate via the existing middleware pattern (mirror `helpers/lingo.tsx`); redirect to login if no `userContext`. Loader: User DO `board().list()` plus `getEditUrlInfo` for each row. Use `composeBoardId(userContext.id, slotId)` to build the public URLs
- [x] 4.2 Render the management UI: each board shows name, updated time, public URL, edit URL via `<SecretCopy>` (reusing `workers/core/app/components/secret-copy.tsx`), rotate-key button, delete button. Header has "+ New board" action linking to `/board/new`
- [x] 4.3 Create `workers/core/app/routes/board.new.tsx` (path `/board/new`). Action only: authed → User DO `board().create()` returns `{ slotId, editKey }` → redirect to `/board/{composeBoardId(userId, slotId)}/edit/{editKey}`. If at 5-board cap, redirect to `/board` with a flash message
- [x] 4.4 Add delete action (path `/board/:id/delete`, owner-authed): parse boardId, verify the userId portion matches `userContext.id`, call User DO `board().delete(slotId)` → redirect to `/board`
- [x] 4.5 Add rotate-key action (path `/board/:id/rotate-key`, owner-authed): parse boardId, verify userId match, call User DO `board().rotateEditKey(slotId)` → redirect to `/board` with the new key visible in `<SecretCopy>`
- [x] 4.6 Register all four routes in `workers/core/app/routes.ts`

## 5. Markdown XSS tests

- [x] 5.1 Add unit tests for `renderBoardMarkdown` covering: basic markdown (headings, lists, links, code, bold/italic), raw HTML in source escaped to text (`<script>alert(1)</script>` → literal text in output), `<img onerror=...>` in source escaped to text, `javascript:` href via `[click](javascript:alert(1))` rejected by `validateLink`, bare `javascript:` URL caught by linkify also rejected, allowed `http(s):` and `mailto:` links survive intact

## 6. Styling and themes

- [x] 6.1 Build a single default board theme (matching the visual language of progress/todo overlays). Background, foreground, font, max-width, padding tuned for OBS browser source dimensions
- [x] 6.2 Make the read-only route accept `?theme=` query string (only `default` recognized for v1; unknown values fall through to default — no error)

## 7. Tests (e2e)

- [x] 7.1 e2e: create a board, save content, fetch read-only URL, assert rendered HTML contains the saved markdown
- [x] 7.2 e2e: optimistic concurrency — two saves with stale `baseVersion` produce 409
- [x] 7.3 e2e: editKey mismatch on save returns 403
- [x] 7.4 e2e: 5-board cap on `/board/new`
- [x] 7.5 e2e: revert appends a new history entry, doesn't rewrite old ones
- [x] 7.6 e2e: rotate-key invalidates the prior key
- [x] 7.7 e2e: presence heartbeat surfaces in `getPresence` and ages out after 20s
- [x] 7.8 e2e: delete removes the row (subsequent read-only request 404s)
- [x] 7.9 e2e: malformed boardId (`/board/foo`, `/board/abc-123` with non-numeric userId, `/board/12345-AAA` with uppercase) returns 404 without touching any DO

## 8. Documentation

- [x] 8.1 Add a "Board" section to `app/routes/howto/` with a usage walkthrough: create a board, set up the OBS source URL, hand the edit URL to a mod, rotate the key
- [x] 8.2 Note the 5-board / 5KB / 10-history limits in the management UI as small helper text

## 9. Code quality

- [x] 9.1 Run `pnpm typecheck` and fix any errors
- [x] 9.2 Run `pnpm lint` and fix any errors
- [x] 9.3 Manual verification in the browser: create, save, conflict, revert, rotate-key, delete, OBS overlay polling
