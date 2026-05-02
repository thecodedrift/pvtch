## ADDED Requirements

### Requirement: Board ID format and parsing

A public `boardId` SHALL have the form `${twitchUserId}-${slotId}` where `twitchUserId` is the numeric Twitch user ID and `slotId` is an 8-character token from the alphabet `[a-z0-9]`. The route layer SHALL parse a boardId by splitting on the last `-`, validating the userId portion matches `^\d+$` and the slotId portion matches `^[a-z0-9]{8}$`. A boardId that fails parsing SHALL produce a 404 without any DO or KV access.

#### Scenario: Well-formed boardId parses

- **WHEN** the route receives `/board/12345-abcd1234`
- **THEN** parsing yields `{ userId: "12345", slotId: "abcd1234" }` and the route proceeds to the User DO

#### Scenario: Missing slot portion fails parsing

- **WHEN** the route receives `/board/12345`
- **THEN** parsing returns null and the loader responds 404

#### Scenario: Non-numeric userId fails parsing

- **WHEN** the route receives `/board/abc-1234abcd`
- **THEN** parsing returns null and the loader responds 404

#### Scenario: Wrong-length slotId fails parsing

- **WHEN** the route receives `/board/12345-abcd123` (7 chars) or `/board/12345-abcd12345` (9 chars)
- **THEN** parsing returns null and the loader responds 404

#### Scenario: Uppercase in slotId fails parsing

- **WHEN** the route receives `/board/12345-ABCD1234`
- **THEN** parsing returns null and the loader responds 404

### Requirement: Board creation by authenticated streamer

An authenticated Twitch user SHALL be able to create up to 5 boards via `POST /board/new`. Each created board SHALL have a server-generated `slotId` (8-character nanoid from alphabet `[a-z0-9]`) and `editKey` (24-character nanoid from the default alphabet). The public boardId SHALL be composed as `${twitchUserId}-${slotId}`.

#### Scenario: First board creation

- **WHEN** an authenticated user with no existing boards POSTs to `/board/new`
- **THEN** a new board row is inserted on their User DO with `slot_id` set to a fresh nanoid, empty content, version 0, and the supplied or default name; the user is redirected to `/board/{userId}-{slotId}/edit/{editKey}`

#### Scenario: 5-board cap enforced

- **WHEN** an authenticated user with 5 existing boards POSTs to `/board/new`
- **THEN** no new board is created and the user is redirected to `/board` with a message indicating the cap

#### Scenario: Unauthenticated creation rejected

- **WHEN** an unauthenticated client POSTs to `/board/new`
- **THEN** the request is rejected via the same auth gate as `/board` (redirect to login or `/private`)

### Requirement: Read-only board route

The system SHALL serve `GET /board/:id` as a read-only, OBS-browser-source-friendly route that renders the board's content as HTML. The route SHALL revalidate at a 3-second polling interval. The markdown source SHALL NOT be sent to the client; only the rendered HTML SHALL cross the wire. The `:id` SHALL be parsed locally into `userId` and `slotId`; the loader SHALL NOT consult any KV mapping.

#### Scenario: Valid boardId

- **WHEN** a client requests `/board/12345-abcd1234` where the parsed userId+slotId resolves to an existing board
- **THEN** the loader parses the boardId, fetches the User DO `twitch:12345`, calls `board().read('abcd1234')`, server-renders the markdown via markdown-it, and returns the rendered HTML with the board's name and version

#### Scenario: Malformed boardId

- **WHEN** a client requests `/board/foo` or `/board/abc-1234` (non-numeric userId) or `/board/12345-AAA` (uppercase or wrong length slotId)
- **THEN** the loader returns 404 without consulting any DO

#### Scenario: Well-formed but unknown boardId

- **WHEN** a client requests `/board/12345-abcd1234` where no row exists for that slotId on the User DO `twitch:12345`
- **THEN** the loader returns a 404 response

#### Scenario: Polling refresh

- **WHEN** the read-only route is mounted in a browser
- **THEN** the page revalidates every 3 seconds via `useRevalidator`, displaying any saved updates without a flash of empty content

#### Scenario: Theme query param

- **WHEN** the read-only route is requested with `?theme=default`
- **THEN** the default theme renders; unknown theme values SHALL fall back to the default theme without raising an error

### Requirement: Editor route with anonymous edit-key access

The system SHALL serve `GET /board/:id/edit/:key` as an editor route accessible to any client with the correct edit key, without requiring Twitch authentication. The route SHALL provide a textarea for markdown source, a live preview rendered from the same server-side pipeline, a presence roster, and a history sidebar.

#### Scenario: Correct edit key

- **WHEN** a client requests `/board/12345-abcd1234/edit/correctKey`
- **THEN** the loader parses the boardId, accesses User DO `twitch:12345`, calls `readForEdit('abcd1234', 'correctKey')`, and returns the markdown source, rendered preview HTML, active presence roster, and recent history entries

#### Scenario: Wrong edit key

- **WHEN** a client requests `/board/12345-abcd1234/edit/wrongKey`
- **THEN** the loader returns a 403 response

#### Scenario: Malformed or unknown boardId in edit URL

- **WHEN** a client requests `/board/foo/edit/anyKey` (malformed) or `/board/12345-abcd1234/edit/anyKey` where no such slotId exists
- **THEN** the loader returns a 404 response

### Requirement: Save with optimistic concurrency

The system SHALL accept saves via `POST /board/:id/edit/:key` with a body containing `{ content, baseVersion, editorName }`. The save SHALL be rejected with HTTP 409 if the current board version differs from `baseVersion`. The save SHALL be rejected with HTTP 413 if the content exceeds 5120 bytes (UTF-8). The save SHALL be rejected with HTTP 403 if the edit key does not match the current edit key.

#### Scenario: Successful save

- **WHEN** a client POSTs `{ content: "...", baseVersion: 7, editorName: "Alice" }` and the current board version is 7
- **THEN** the board content is updated, the version becomes 8, a history entry is appended with `editor_name = "Alice"`, and the response includes the new version

#### Scenario: Stale base version

- **WHEN** a client POSTs `{ content: "...", baseVersion: 7 }` but the current board version is 8
- **THEN** the response is HTTP 409 with the current content and version included so the client can present a conflict resolution UI

#### Scenario: Content too large

- **WHEN** a client POSTs content whose UTF-8 byte length exceeds 5120
- **THEN** the response is HTTP 413 and the board state is unchanged

#### Scenario: Wrong edit key

- **WHEN** a client POSTs to `/board/:id/edit/wrongKey`
- **THEN** the response is HTTP 403 and the board state is unchanged

### Requirement: History capture and trim

Every successful save SHALL append an entry to `board_history` with `{ ts, editor_name, content_hash, content }`. After the insert, the system SHALL trim history to the 10 most recent entries per board. The history SHALL never store the edit key.

#### Scenario: Save appends history

- **WHEN** a save succeeds
- **THEN** a new row is inserted into `board_history` for that board, with `ts = now`, `editor_name` from the save body, and the full content snapshot

#### Scenario: 11th save trims oldest entry

- **WHEN** a board has 10 history entries and an 11th save succeeds
- **THEN** the oldest entry is deleted; only the 10 most recent remain

#### Scenario: History does not store edit key

- **WHEN** any history row is inspected
- **THEN** the row contains no edit key field

### Requirement: Revert as a new history entry

The system SHALL accept revert operations via `POST /board/:id/edit/:key/revert` with a body containing `{ historyId, baseVersion, editorName }`. The revert SHALL load the historic content and run the same save path with that content. The revert SHALL append a new history entry rather than rewriting older entries.

#### Scenario: Revert appends new history

- **WHEN** a client successfully reverts to history entry id 5 from a base version of 9
- **THEN** the board content becomes the entry-5 content, the board version becomes 10, and a new history entry is appended with the editor name suffixed to indicate a revert

#### Scenario: Revert respects optimistic concurrency

- **WHEN** a client POSTs revert with `baseVersion: 7` but the current version is 8
- **THEN** the response is HTTP 409 and the board state is unchanged

### Requirement: Presence heartbeat for editor awareness

The system SHALL accept presence heartbeats via the editor route every 5 seconds with `{ sessionId, name }`. The system SHALL return active editors (`last_seen` within 20 seconds) on every editor loader call. Older entries SHALL be pruned opportunistically.

#### Scenario: Heartbeat refreshes presence

- **WHEN** a client POSTs a heartbeat for `sessionId = "s1", name = "Alice"`
- **THEN** the `board_presence` row for `(slot_id, "s1")` is upserted with `last_seen = now` and `name = "Alice"`

#### Scenario: Stale presence ages out

- **WHEN** a presence row's `last_seen` is older than 20 seconds and any client calls `getPresence`
- **THEN** the row is omitted from the returned roster and may be deleted opportunistically

#### Scenario: Roster surfaced to editors

- **WHEN** the editor loader runs
- **THEN** it returns the current presence roster (excluding stale rows) for display in the editor UI

### Requirement: Editor name persistence

The editor SHALL prompt for a display name on first use if `localStorage['pvtch.board.editorName']` is empty. The display name SHALL be persisted to localStorage and attached to subsequent saves and presence heartbeats. The server SHALL trim, strip control characters, and cap the name at 50 characters; an empty name after trimming SHALL be replaced with `"Anonymous editor"`.

#### Scenario: First edit prompts for name

- **WHEN** an editor loads with no `pvtch.board.editorName` value in localStorage
- **THEN** a prompt is shown before the textarea is enabled, and the entered name is persisted

#### Scenario: Subsequent edits reuse stored name

- **WHEN** an editor loads with a stored `pvtch.board.editorName`
- **THEN** the name is auto-attached to saves and heartbeats and the prompt is not shown

#### Scenario: Server normalizes empty name

- **WHEN** a client POSTs a save with `editorName = "   "`
- **THEN** the server stores `editor_name = "Anonymous editor"` in the history row

### Requirement: Server-side markdown rendering, XSS-safe by configuration

The system SHALL render markdown to HTML on the server using markdown-it configured with `html: false` so that any raw HTML in the source is escaped to text rather than parsed. The system SHALL override `validateLink` to allow only `http(s):` and `mailto:` URL schemes (plus relative `/...` and fragment `#...` URLs). No separate HTML sanitizer is required.

#### Scenario: Raw HTML in source is escaped to text

- **WHEN** the markdown source contains `<script>alert(1)</script>`
- **THEN** the rendered HTML contains the literal text `&lt;script&gt;alert(1)&lt;/script&gt;` and no parsed `<script>` element

#### Scenario: Raw img tag with onerror is escaped to text

- **WHEN** the markdown source contains `<img src=x onerror=alert(1)>`
- **THEN** the rendered HTML contains the literal text of that string and no parsed `<img>` element with an `onerror` attribute

#### Scenario: javascript: href rejected

- **WHEN** the markdown source contains `[click](javascript:alert(1))`
- **THEN** the rendered HTML does not contain a `javascript:` href; markdown-it's `validateLink` rejects the URL

#### Scenario: javascript: bare URL rejected by linkify

- **WHEN** the markdown source contains a bare `javascript:alert(1)` URL detected by linkify
- **THEN** the rendered HTML does not contain a clickable `javascript:` link

#### Scenario: Allowed markdown survives

- **WHEN** the markdown source contains headings, lists, http/https links, mailto links, code spans, and bold/italic
- **THEN** the rendered HTML includes those tags with valid attributes

### Requirement: Owner-only management UI

The system SHALL serve `GET /board` as an authenticated management UI listing the current user's boards. Each row SHALL display the board name, last-updated time, the public URL, the edit URL via a secret-copy component (so the key is not displayed by default), and actions to rotate the edit key or delete the board.

#### Scenario: Authenticated user views their boards

- **WHEN** an authenticated user requests `/board`
- **THEN** the page lists their boards with the URLs and management actions

#### Scenario: Unauthenticated user is redirected

- **WHEN** an unauthenticated client requests `/board`
- **THEN** the user is redirected to login (or `/private` on a private instance) per the existing auth-middleware behavior

#### Scenario: Edit URL is not displayed in plaintext by default

- **WHEN** the management UI renders a row
- **THEN** the edit URL is wrapped in a secret-copy component that hides the key until the user clicks reveal or copy

### Requirement: Edit-key rotation

The system SHALL support owner-initiated rotation of an edit key via `POST /board/:id/rotate-key`. After rotation, the previous key SHALL be invalid; subsequent save and presence requests with the old key SHALL receive HTTP 403.

#### Scenario: Rotate-key replaces the key

- **WHEN** the owner POSTs to `/board/abc123/rotate-key`
- **THEN** the board's `edit_key` becomes a newly generated nanoid, the response includes the new key for the management UI to display, and the prior key is no longer accepted

#### Scenario: Active editor with old key sees 403

- **WHEN** an editor with the old key attempts to save after rotation
- **THEN** the save action returns HTTP 403 and the editor displays a message indicating the URL was rotated

### Requirement: Owner-only deletion

The system SHALL support owner-initiated deletion via `POST /board/:id/delete`. Deletion SHALL remove the board row and cascade-delete its history and presence rows. After deletion, both `GET /board/:id` and `GET /board/:id/edit/:key` SHALL return 404.

#### Scenario: Owner deletes a board

- **WHEN** the owner POSTs to `/board/12345-abcd1234/delete`
- **THEN** the loader verifies the userId portion of the boardId matches the authenticated user, the board row, history, and presence rows are removed, and the user is redirected to `/board`

#### Scenario: Non-owner cannot delete

- **WHEN** an authenticated user POSTs to `/board/{otherUserId}-abcd1234/delete` for a board they do not own
- **THEN** the request is rejected (403 or redirect away) and no rows are deleted

#### Scenario: Read-only route after deletion

- **WHEN** any client requests `/board/12345-abcd1234` after deletion
- **THEN** the response is 404

#### Scenario: Edit route after deletion

- **WHEN** any client requests `/board/12345-abcd1234/edit/anyKey` after deletion
- **THEN** the response is 404

### Requirement: Per-user storage caps

The system SHALL enforce the following storage caps:

- 5 boards per user
- 5120 bytes per content revision (UTF-8)
- 10 history entries per board

#### Scenario: Cap is enforced at create time

- **WHEN** a 6th create is attempted
- **THEN** the request is rejected without inserting a new row

#### Scenario: Cap is enforced at save time

- **WHEN** a save submits content larger than 5120 bytes (UTF-8)
- **THEN** the response is HTTP 413 and the board state is unchanged

#### Scenario: History trim is enforced

- **WHEN** an 11th save succeeds for a board
- **THEN** the oldest history entry is deleted; the count returns to 10
