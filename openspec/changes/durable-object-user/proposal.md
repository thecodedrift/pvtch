## Why

The current PvtchBackend Durable Object uses a one-instance-per-data-item pattern with KV-style get/set, making it difficult to add new features, schedule work, or query across a user's data. Migrating to a single SQLite-backed DO per user enables structured storage, plugin-based extensibility, and a foundation for scheduled jobs.

## What Changes

- New `User` Durable Object class (SQLite-backed, one instance per user keyed by `twitch:{userId}`)
- Plugin architecture: `Progress`, `Lingo`, and `JobScheduler` plugins injected with `SqlStorage`, each managing their own migrations in the constructor
- SQL-based migration system (`migrate` helper) brought in from Taskless reference implementation
- Job scheduler brought in from Taskless reference implementation
- Route updates: switch from `PVTCH_BACKEND` to `PVTCH_USER`, address DOs by `twitch:{userId}` instead of `token::dataKey`
- Temporary `lingo().import()` method for migrating existing lingo configs from old DOs at the route level
- Progress data is ephemeral (25h TTL) and will not be migrated -- new writes go directly to the new DO
- `normalizeKey` utility retired
- Wrangler v3 migration adding `User` as a new SQLite class
- **BREAKING**: Old `PvtchBackend` DO retained temporarily for lingo migration reads but no longer written to

## Capabilities

### New Capabilities

- `user-durable-object`: Per-user SQLite-backed Durable Object with plugin architecture, migration system, and job scheduler
- `plugin-progress`: Progress plugin providing typed get/set operations with SQL storage and self-managed schema migrations
- `plugin-lingo`: Lingo plugin providing config storage with SQL, self-managed schema migrations, and temporary import method for KV migration
- `plugin-job-scheduler`: Job scheduler plugin for scheduling one-shot and recurring jobs with retry, backoff, and cron support

### Modified Capabilities

- `storage`: Requirements change from single-value-per-DO KV pattern to per-user SQLite with plugin-managed tables. Context injection and key normalization requirements removed.

## Impact

- **Durable Objects**: New `User` class added alongside existing `PvtchBackend` (temporary coexistence)
- **Wrangler config**: New DO binding `PVTCH_USER`, v3 migration tag, `PvtchBackend` retained during transition
- **All widget routes**: Updated to resolve `token → userId`, address `PVTCH_USER` DO, and call plugin methods
- **Lingo routes**: Temporary migration block added to import old config on first access
- **worker-configuration.d.ts**: Updated with new `PVTCH_USER` binding type
- **New files**: `do/user.ts`, `do/plugins/progress.ts`, `do/plugins/lingo.ts`, `helpers/migrate.ts`, `helpers/job-scheduler.ts` (and its migrations)
- **Removed**: `normalizeKey` utility no longer needed
