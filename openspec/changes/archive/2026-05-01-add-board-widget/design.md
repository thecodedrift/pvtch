## Context

PVTCH currently has three OBS-source mini-apps (`progress`, `todo`, `1s`) and one server-state mini-app (`lingo`). They share a pattern: per-user state lives on a `User` Durable Object as a plugin, OBS source URLs include a token in the path, and editor/config pages are gated by a Twitch session.

The board widget breaks new ground in two ways:

1. It's the first feature where a single user owns **multiple instances** of a resource. Lingo and progress are 1:1 with the user; board is 1:N (cap 5).
2. It introduces **anonymous edit access** via a write key in the URL, separate from Twitch auth. Mods don't need a Twitch login on the operator's instance — they just need the edit URL.

This change establishes the pattern for both.

## Goals / Non-Goals

**Goals:**

- Streamer can create up to 5 boards, each with a public read-only URL and a private edit URL
- Anyone with the edit URL can edit (no Twitch login required) — including mods who don't have accounts on this instance
- Save flow prevents silent overwrites between concurrent editors
- History is preserved per board so a bad edit can be reverted
- Markdown rendering is XSS-safe by construction
- The OBS overlay is fast to render and updates on a polling loop without flicker

**Non-Goals:**

- Real-time collaborative editing (no Yjs, no WebSockets, no operational transforms)
- Live cursor presence within the textarea
- Theme overrides via URL — single default theme for v1
- Per-board access logs or audit trail beyond the 10-entry history
- Cross-board search, tags, or organization features
- Public listing of a user's boards (URLs are unguessable, but discoverability is opt-in via the streamer sharing them)
- Syntax highlighting in code blocks (Shiki was evaluated and deferred — see Decision 7)

## Decisions

### 1. Polling, not WebSockets

The actual problem to solve is "two mods don't silently overwrite each other." That decomposes into:

- **Save-time safety** — solved by optimistic concurrency: every save carries a `baseVersion`; the server rejects with 409 if the board's current version has moved on. Pure HTTP.
- **Awareness** — solved by heartbeat presence: editors POST `/presence` every 5s with a session id and editor name; the loader returns the active roster (rows newer than 20s).

The only thing WebSockets would buy is making "X just joined" appear in 200ms instead of 5s. For 1–3 mods opening the editor maybe twice a stream, that's an invisible UX delta. The cost would be a new WS routing layer in `handler.ts`, hibernation-safe state on the DO, reconnect logic on the client, and a new failure surface — none of which the rest of PVTCH currently uses.

When the next feature comes along that genuinely needs sub-second push (live game state, a real collaborative pad), the `ws-routes.ts` registry pattern from prior exploration is on the table and pays off across multiple features. Building it for the board's invisible 5s delta is the wrong time.

### 2. boardId encodes the owning userId — no KV indirection

`boardId = ${twitchUserId}-${slotId}` where `slotId = nanoid(8)` drawn from the alphabet `[a-z0-9]` (no `-` or `_`, so the split is unambiguous). Twitch userIds are numeric strings and already public — they're returned by the Helix `/users` API and visible in chat metadata — so embedding them in the URL leaks no information that wasn't already public.

The User DO holds rows in its `boards` table keyed internally by `slot_id`. The route layer parses the URL boardId and passes only `slotId` to the plugin; the plugin never sees or stores the userId portion (it's redundant with the DO name `twitch:{userId}`).

Three options were considered:

| Option                                 | Read path                                        | Cost                                                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A. KV reverse mapping                  | `KV.get(pvtch:board:{id}) → userId` then User DO | One KV hop on every read. Eventual consistency on creation. New mapping lifecycle to maintain.                                                                                             |
| B. Separate `BoardDO` keyed by boardId | `BoardDO.get(id)` directly                       | A second DO type. User explicitly chose plugin-on-User-DO.                                                                                                                                 |
| **C. Encode userId into boardId**      | Parse URL → `User.get(twitch:{userId})` directly | UserId visible in URL (acceptable — it's public). BoardIds can't be rotated to new public URLs without delete+recreate (acceptable — `editKey` rotation is the actual security primitive). |

**Chosen: C.** Removes a KV dependency and a write-side lifecycle, makes the read path one hop, and keeps the plugin-on-User-DO model intact.

```
   /board/12345-abc12345   ──▶ parse → { userId: "12345", slotId: "abc12345" }
                                                  │
                                                  ▼
                          User DO (twitch:12345) ──▶ board plugin ──▶ row by slot_id
```

Format validation in the route loader (before any DO call):

```
parseBoardId(s):
  i = s.lastIndexOf('-')
  if i < 1 or i >= s.length - 1 → null
  userId = s.slice(0, i)
  slotId = s.slice(i + 1)
  if not /^\d+$/.test(userId) → null
  if not /^[a-z0-9]{8}$/.test(slotId) → null
  return { userId, slotId }
```

If parsing fails or the slotId isn't found in the User DO's `boards` table, the route returns 404. Garbage URLs never reach the DO.

### 3. Plugin-on-User-DO over a separate BoardDO

The user explicitly chose plugin-on-User-DO. Justification: matches existing patterns (`progress`, `lingo`, `profile`), single DO per user simplifies abuse response (revoke a user → all their state goes), and the read path is one DO hop with no KV.

The plugin owns three SQLite tables. The PK is `slot_id` (the random portion of the boardId) — the userId portion is redundant with the DO name and isn't stored. SQL in `do/plugins/board.ts`:

```sql
CREATE TABLE IF NOT EXISTS boards (
  slot_id      TEXT PRIMARY KEY,
  edit_key     TEXT NOT NULL,
  name         TEXT NOT NULL DEFAULT 'Untitled',
  content      TEXT NOT NULL DEFAULT '',
  version      INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS board_history (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id       TEXT NOT NULL,
  ts            INTEGER NOT NULL,
  editor_name   TEXT NOT NULL,
  content_hash  TEXT NOT NULL,
  content       TEXT NOT NULL,
  FOREIGN KEY (slot_id) REFERENCES boards(slot_id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_board_history_slot_ts ON board_history(slot_id, ts DESC);

CREATE TABLE IF NOT EXISTS board_presence (
  slot_id     TEXT NOT NULL,
  session_id  TEXT NOT NULL,
  name        TEXT NOT NULL,
  last_seen   INTEGER NOT NULL,
  PRIMARY KEY (slot_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_board_presence_seen ON board_presence(slot_id, last_seen DESC);
```

### 4. Optimistic concurrency on save

Save flow:

```
POST /board/:id/edit/:key
  body: { content, baseVersion, editorName }

  1. parseBoardId(:id) → { userId, slotId }   (404 on parse failure)
  2. User DO (twitch:userId) board plugin: load row by slot_id   (404 if missing)
  3. If row.edit_key !== key → 403
  4. If byteLength(content, 'utf-8') > 5120 → 413
  5. If row.version !== baseVersion → 409 + { currentContent, currentVersion }
  6. Begin transaction:
       UPDATE boards SET content=?, version=version+1, updated_at=? WHERE slot_id=?
       INSERT INTO board_history (slot_id, ts, editor_name, content_hash, content) VALUES (...)
       DELETE FROM board_history WHERE slot_id=? AND id NOT IN
         (SELECT id FROM board_history WHERE slot_id=? ORDER BY ts DESC LIMIT 10)
     Commit.
  7. Return { version: new, success: true }
```

The 409 path returns the current state so the client can show a side-by-side diff and the user can re-apply or abandon their changes.

### 5. Anonymous editor name via localStorage

The editor name is decorative (it appears in history and presence) but useful — without it, a streamer reviewing history sees "anonymous editor" for every entry and can't tell who did what.

- First load of `/board/:id/edit/:key`: if `localStorage['pvtch.board.editorName']` is empty, show a small inline prompt before enabling the textarea
- Subsequent loads: name is auto-attached; can be edited via a small "edit name" link in the header
- Server-side validation: trim, strip control chars, cap at 50 chars. Empty after trim → "Anonymous editor"
- The name is **not** trusted (anyone with the editKey can pick any name). It's an honor system. The actual gate is the `editKey` itself.

### 6. Markdown pipeline: markdown-it with HTML disabled, no sanitizer

```
loader (server-side):
  content (markdown source)
    │
    ▼
  markdown-it({ html: false, linkify: true })
    .validateLink = scheme in {http, https, mailto}
    │
    ▼
  safeHtml ──▶ returned to client
```

Configuration:

```ts
const md = MarkdownIt({
  html: false, // raw HTML in source is escaped to text
  linkify: true, // auto-detect bare URLs
  typographer: false, // no smartquotes / dash substitutions
  breaks: true, // newlines in source become <br>
});
md.validateLink = (url) =>
  /^(https?:|mailto:)/i.test(url) || url.startsWith('/') || url.startsWith('#');
```

**Why no sanitize-html:**

- `html: false` means any raw HTML written in the markdown source — `<script>`, `<iframe>`, `<img onerror=...>`, `<style>`, or any tag at all — is escaped to literal text rather than parsed. There is no path from user input to a parsed HTML tag except through markdown syntax.
- markdown-it's renderer emits a fixed set of tags (`h1-h6, p, ul, ol, li, strong, em, code, pre, blockquote, a, img, hr, br, table, ...`). Tag and attribute _names_ are hardcoded; the only user-controlled attribute _values_ are `href` and `src`, both filtered through `validateLink`.
- Restricting `validateLink` to `http(s):` and `mailto:` (plus relative `/...` and `#...`) closes the `javascript:` URI vector, including for bare URLs caught by linkify.

The tradeoff: sanitize-html would have been defense-in-depth — if a future markdown-it bug emitted unexpected output, the allowlist would catch it. Trusting markdown-it directly is a deliberate choice. The library is widely used and well-tested; if a CVE ever surfaces, we add sanitize-html behind it as a one-line addition (no architecture change).

The read-only route renders the resulting HTML via `dangerouslySetInnerHTML`. **The markdown source never reaches the public client** — only the rendered HTML — so a bug in the client cannot reintroduce XSS. The editor route receives both `content` (for the textarea) and the rendered HTML (for the live preview pane).

### 7. Shiki / code highlighting deferred

Shiki was evaluated for code-block syntax highlighting. Verdict: not v1.

- Streamer info-card content is overwhelmingly headings, links, lists, and short commands. Code blocks are rare.
- Shiki adds ~80KB core + per-language grammars + per-theme bundle. Even with Workers-compatible v1+ (`@shikijs/core` with on-demand loading), it's a meaningful weight for a feature few users will trigger.
- Default `<pre><code>` from markdown-it is plain HTML and can be styled with CSS to look fine.

If a user later asks for highlighted code blocks, the integration point is a single `highlight` callback on the markdown-it config — pure addition, no architectural cost. Shiki rendering would happen in the loader (server-side only) so the client bundle stays clean.

### 8. Limits and quotas

| Bound                     | Value              | Enforcement                                                                                                         |
| ------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Boards per user           | 5                  | `POST /board/new` action: `SELECT COUNT(*) FROM boards`; reject 6th with a friendly error                           |
| Content per revision      | 5120 bytes (UTF-8) | save action: `Buffer.byteLength(content, 'utf-8') > 5120` → 413                                                     |
| History entries per board | 10                 | trim on insert: `DELETE FROM board_history WHERE slot_id=? AND id NOT IN (SELECT id ... ORDER BY ts DESC LIMIT 10)` |

Worst-case storage per user: 5 boards × (5KB content + 10 × 5KB history) = **275KB**. Acceptable.

### 9. Revert is just a save

```
POST /board/:id/edit/:key/revert
  body: { historyId, baseVersion, editorName }
```

Server loads the history entry's content, then runs the normal save path with that content and `editorName = "${editorName} (reverted)"`. This means revert:

- Goes through the same version check (won't silently clobber a concurrent edit)
- Appends a new history entry rather than rewriting old ones
- Counts toward the 10-entry cap (so spamming revert eventually trims old entries — fine)

### 10. Rotate-key behavior

`POST /board/:id/rotate-key` (authed Twitch user, owner only) generates a new `editKey` and updates the board row. Active editors with the old URL get a 403 on their next save or presence heartbeat. The client interprets 403 as "your edit URL was rotated; ask the streamer for the new one" and shows that message inline.

We don't pre-emptively kick anyone — they keep typing locally until their next save attempt fails. That's acceptable: rotate-key is for "I just removed a mod and don't want them editing"; the worst case is one stale save attempt that's rejected.

## Risks / Trade-offs

- **userId visible in URL** — `/board/12345-abcdef12` exposes the streamer's numeric Twitch userId. Twitch userIds are public via the Helix `/users` API and chat metadata, so this leaks no information that wasn't already public.
- **boardId rotation requires recreation** — there's no way to change a board's public URL while preserving its content; the userId portion is fixed and the slotId is the PK. The user accepted this. The actual security primitive is `editKey` rotation, which preserves the URL and invalidates only edit access.
- **History stores full content, not diffs** — at 5KB × 10 entries this is fine. Switching to diffs later (if quotas tighten) is a migration, but the current bound is well within budget.
- **Polling load** — at 3s on the read-only route and 5s on the editor, a single board with one OBS overlay + one editor is ~28 requests/min. Cloudflare Workers can absorb this. If a board goes viral and 1000 OBS sources start polling it at 3s = 333 req/sec — still fine on the edge for a single DO read per request, but worth monitoring.
- **Anonymous edit names are unverified** — anyone with the editKey can claim any name. This is a deliberate choice (it's the same honor-system model as a shared Google Doc with link sharing). The `editKey` is the actual security boundary.
- **Markdown features are minimal in v1** — no tables, no task lists, no footnotes. Easy to add later via markdown-it plugins (`markdown-it-task-lists`, etc.); plugins compose on top of the existing `html: false` config without changing the security posture.
- **No logout / session-end on the editor** — anyone with the URL forever has access until rotate-key is invoked. Streamers should rotate the key when removing a mod. Worth surfacing in the management UI.
