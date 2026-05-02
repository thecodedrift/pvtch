## ADDED Requirements

### Requirement: Board plugin on the User Durable Object

The `User` Durable Object SHALL expose a `Board` plugin alongside the existing `Progress`, `Lingo`, and `Profile` plugins. The plugin SHALL be instantiated in the User DO constructor, passed `ctx.storage.sql`, and exposed via a `board()` accessor method that returns the plugin instance directly.

#### Scenario: Constructor wires the Board plugin

- **WHEN** a User DO instance is constructed
- **THEN** a `Board` instance is created with `ctx.storage.sql`, stored on the DO, and migrations are applied

#### Scenario: Access board plugin

- **WHEN** a route calls `stub.board()`
- **THEN** the Board plugin instance is returned with no additional processing

### Requirement: Board plugin SQLite schema (migration v1)

The Board plugin SHALL apply a v1 migration that creates three tables keyed internally by `slot_id` (the random portion of the public boardId; the userId portion is redundant with the DO name):

- `boards (slot_id TEXT PRIMARY KEY, edit_key TEXT NOT NULL, name TEXT NOT NULL DEFAULT 'Untitled', content TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`
- `board_history (id INTEGER PRIMARY KEY AUTOINCREMENT, slot_id TEXT NOT NULL, ts INTEGER NOT NULL, editor_name TEXT NOT NULL, content_hash TEXT NOT NULL, content TEXT NOT NULL, FOREIGN KEY (slot_id) REFERENCES boards(slot_id) ON DELETE CASCADE)` plus an index on `(slot_id, ts DESC)`
- `board_presence (slot_id TEXT NOT NULL, session_id TEXT NOT NULL, name TEXT NOT NULL, last_seen INTEGER NOT NULL, PRIMARY KEY (slot_id, session_id))` plus an index on `(slot_id, last_seen DESC)`

The migration SHALL use the same `migrate(sql, migrations, '_board_version')` pattern as the existing plugins.

#### Scenario: First-time migration creates all tables and indexes

- **WHEN** a User DO is constructed for the first time
- **THEN** the three Board tables and their indexes exist in `ctx.storage.sql`

#### Scenario: Re-running migrations is a no-op

- **WHEN** an existing User DO is constructed and the `_board_version` row already records v1
- **THEN** the migration is not re-applied and no schema changes occur

### Requirement: Board route resolves User DO directly from URL

The system SHALL resolve the owning User DO for a board route by parsing the boardId from the URL path — the userId portion of `${twitchUserId}-${slotId}` is used directly as `env.PVTCH_USER.idFromName("twitch:{twitchUserId}")`. No KV mapping is consulted on the read or edit path.

#### Scenario: Read-only route resolves DO via URL parsing

- **WHEN** the read-only loader receives `/board/12345-abcd1234`
- **THEN** it parses `userId = "12345"` from the URL, accesses `env.PVTCH_USER.idFromName("twitch:12345")`, and calls `board().read("abcd1234")` to fetch content — no KV access occurs

#### Scenario: Edit route resolves DO via URL parsing

- **WHEN** the edit loader receives `/board/12345-abcd1234/edit/someKey`
- **THEN** it parses the boardId, accesses `env.PVTCH_USER.idFromName("twitch:12345")`, and calls `board().readForEdit("abcd1234", "someKey")` — no KV access occurs

#### Scenario: Malformed boardId short-circuits before any DO access

- **WHEN** any board route receives a malformed boardId
- **THEN** the loader returns 404 without calling `idFromName` or any DO method
