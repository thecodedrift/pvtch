## Context

PVTCH currently uses `PvtchBackend`, a generic KV-style Durable Object where each data item (progress value, lingo config) gets its own DO instance addressed by `{token}::{dataKey}`. This was a simple starting point, but limits extensibility: there's no way to query across a user's data, schedule background work, or add new storage types without spawning more DO instances.

The Taskless project has a proven pattern for SQLite-backed DOs with a migration helper and job scheduler. We'll adopt these patterns for the new User DO.

Current DO addressing: `env.PVTCH_BACKEND.idFromName("token::progress::default")`
New DO addressing: `env.PVTCH_USER.idFromName("twitch:userId")`

Routes already resolve `token → userId` via `isValidToken()` before touching DOs, so the addressing change is straightforward.

## Goals / Non-Goals

**Goals:**

- One SQLite-backed DO per user with structured tables
- Plugin architecture where each plugin (Progress, Lingo, JobScheduler) manages its own tables and migrations independently
- Constructor-based migrations: each plugin runs `migrate()` in its constructor, which re-runs on every DO cold start
- Migrate existing lingo configs from old DOs via a temporary route-level migration path
- Bring in JobScheduler for future use (scheduling, background work)
- Clean separation: User DO is a thin shell, plugins are self-contained

**Non-Goals:**

- Migrating ephemeral progress data (25h TTL, will expire naturally)
- Removing `PvtchBackend` in this change (kept for migration reads)
- Adding new features beyond the current progress/lingo functionality
- Changing URL structure or token system
- Using the JobScheduler for anything yet (just wiring it in)

## Decisions

### 1. One DO per user, keyed by `twitch:{userId}`

Each user gets a single DO instance containing all their data in SQLite tables. The key uses `twitch:` prefix to namespace by auth provider (future-proofing if other providers are added).

Alternative: Keep one-DO-per-data-item pattern → rejected because it prevents cross-data queries, makes scheduling impossible, and scales poorly as widgets grow.

### 2. Plugin architecture with `SqlStorage` injection

Each plugin receives `SqlStorage` in its constructor and is self-contained:

- Runs `migrate()` in its constructor to ensure schema is current
- Manages its own migration version table (e.g., `_progress_version`)
- Exposes typed public methods
- No awareness of the parent DO, other plugins, or `Env`

DO constructors run on every cold start (including after eviction and after deploys), so constructor-based migrations always pick up new schema changes.

The JobScheduler additionally receives `DurableObjectState` (for alarm access).

Alternative: Monolithic DO with all logic in one class → rejected because it doesn't scale as widgets are added and couples unrelated concerns.

### 3. Migrations run in constructor

DO constructors run on every cold start — when a DO is first accessed, after eviction from memory, and after deploys (which cause eviction). This means `migrate()` in the constructor reliably picks up new migrations after every deploy. No need for an `update()` guard on every method.

### 4. User DO exposes plugins via accessor methods

```
stub.progress().get("default")
stub.lingo().getConfig()
```

The User DO returns plugin instances directly. It's a thin shell: constructor creates plugins (which run their own migrations), accessors return them, `alarm()` delegates to scheduler.

### 5. Lazy lingo migration at the route level

Lingo config migration happens in route code, not inside the DO:

1. Route gets new User DO stub
2. Route calls `stub.lingo().getConfig()`
3. If null, route fetches from old `PVTCH_BACKEND` using the token
4. If found, route calls `stub.lingo().import(parsedConfig)`

This keeps plugins env-free (no `PVTCH_BACKEND` dependency) and makes migration fully synchronous inside the DO. The migration code is temporary and lives in userland where it's easy to remove.

Alternative: Plugins receive `Env` and handle migration internally → rejected because it couples plugins to the old system and makes them harder to test.

### 6. Progress data not migrated

Progress values have a 25h TTL and are set by chatbot commands (ephemeral). They'll expire from old DOs naturally. New writes go to the User DO immediately. Users may see a one-time reset of active progress bars, but these get re-set quickly by normal usage.

### 7. Bring in migrator and job scheduler from Taskless

The `migrate()` helper and `JobScheduler` are copied from `taskless/workers/storage/src/helpers/` into `workers/core/do/helpers/`. Both use the same constructor-based migration pattern.

## Risks / Trade-offs

- **Lingo config loss window**: If a user has a lingo config in the old DO and it expires (30d TTL) before they access any lingo route on the new system, their config is lost. Mitigation: 30 days is a long window; deploy and the migration runs on first access.
- **Two DO systems running simultaneously**: During transition, both `PVTCH_BACKEND` and `PVTCH_USER` exist. Increases complexity briefly. Mitigation: Old DO is read-only (no new writes), remove after lingo TTL window passes.
- **JobScheduler alarm ownership**: The scheduler manages the DO's single alarm slot. If other code needs alarms, it must go through the scheduler. This is intentional — the scheduler multiplexes jobs over the single alarm.
- **Plugin migration version table proliferation**: Each plugin adds a `_pluginname_version` table. This is fine for SQLite (cheap) and provides clear isolation between plugins.

## Migration Plan

1. **Deploy new code**: New `User` DO class, updated routes, temporary migration blocks
2. **Wrangler v3 migration**: Adds `User` as new SQLite class alongside `PvtchBackend`
3. **Transition period** (~30 days): Both DOs coexist. Old DO is read-only. Lingo configs migrate on first access.
4. **Cleanup deploy**: Remove `PvtchBackend` class, `PVTCH_BACKEND` binding, migration blocks in routes, `normalizeKey` utility, and old DO from wrangler config
