# storage Specification

## Purpose

Cloudflare Workers storage layer: context injection for bindings, per-user SQLite-backed Durable Object with plugin architecture (Progress, Lingo, JobScheduler), and schema migration system.

## Requirements

### Requirement: Cloudflare binding context injection

The system SHALL provide React Router contexts for: (1) `cloudflareEnvironmentContext` exposing the worker's `Env` bindings, (2) `cloudflareExecutionContext` exposing the `ExecutionContext`, (3) `userContext` for authenticated Twitch user data. These contexts SHALL be set in the request handler middleware and accessed via `context.get()` in loaders and actions.

#### Scenario: Access env bindings in loader

- **WHEN** a route loader calls `context.get(cloudflareEnvironmentContext)`
- **THEN** it receives the Cloudflare `Env` object with KV, DO, and AI bindings

#### Scenario: Access user context

- **WHEN** a route loader calls `context.get(userContext)` after authentication middleware
- **THEN** it receives the authenticated user's Twitch id, login, and displayName

### Requirement: Per-user SQLite-backed Durable Object

The system SHALL provide a `User` Durable Object class that extends `DurableObject<Env>` with SQLite storage. Each instance SHALL be keyed by `twitch:{userId}` where `userId` is the Twitch user ID. The User DO SHALL serve as a thin shell that holds plugin instances and delegates alarm processing to the JobScheduler.

#### Scenario: DO instance addressing

- **WHEN** a route resolves a token to a userId via `isValidToken()`
- **THEN** the User DO is accessed via `env.PVTCH_USER.idFromName("twitch:{userId}")`

#### Scenario: Constructor wiring

- **WHEN** a User DO instance is constructed
- **THEN** it creates `Progress`, `Lingo`, and `JobScheduler` plugin instances, passing `ctx.storage.sql` (and `ctx` for JobScheduler)

### Requirement: Plugin accessor methods

The User DO SHALL expose plugins via accessor methods: `progress()` returns the Progress plugin instance, `lingo()` returns the Lingo plugin instance. These methods SHALL return the plugin instance directly with no additional processing.

#### Scenario: Access progress plugin

- **WHEN** a route calls `stub.progress()`
- **THEN** the Progress plugin instance is returned

#### Scenario: Access lingo plugin

- **WHEN** a route calls `stub.lingo()`
- **THEN** the Lingo plugin instance is returned

### Requirement: Alarm delegation to JobScheduler

The User DO SHALL implement an `alarm()` method that delegates to `this.scheduler.processAlarm(this)`. The User DO SHALL implement the `JobSchedulerHost` interface with a `scheduled(job)` method that dispatches jobs by task name.

#### Scenario: Alarm fires

- **WHEN** the DO alarm fires
- **THEN** `alarm()` calls `this.scheduler.processAlarm(this)` which processes all due jobs

### Requirement: Wrangler v3 migration

The wrangler configuration SHALL include a v3 migration tag that adds `User` as a new SQLite class. The `PVTCH_USER` binding SHALL be added to the durable_objects bindings. The existing `PvtchBackend` class and `PVTCH_BACKEND` binding SHALL be retained during the transition period.

#### Scenario: v3 migration tag

- **WHEN** the wrangler config is deployed
- **THEN** the migrations array includes `{ "tag": "v3", "new_sqlite_classes": ["User"] }`

#### Scenario: Both bindings coexist

- **WHEN** the worker environment is initialized
- **THEN** both `PVTCH_BACKEND` and `PVTCH_USER` bindings are available on `Env`

### Requirement: Progress plugin with constructor-based migrations

The Progress plugin SHALL accept `SqlStorage` in its constructor and call `migrate(sql, progressMigrations, '_progress_version')` to ensure the schema is current. It SHALL manage a `progress` table with columns: `name TEXT PRIMARY KEY`, `value REAL NOT NULL`, `updated_at INTEGER NOT NULL`.

#### Scenario: Constructor runs migrations

- **WHEN** a Progress plugin is constructed with `new Progress(sql)`
- **THEN** `migrate()` creates the `_progress_version` table and the `progress` table if they don't exist

#### Scenario: Get existing progress

- **WHEN** `get("default")` is called and a row with name "default" exists
- **THEN** the numeric value is returned

#### Scenario: Get nonexistent progress

- **WHEN** `get("unknown")` is called and no row with that name exists
- **THEN** `undefined` is returned

#### Scenario: Set progress value

- **WHEN** `set("default", 75)` is called
- **THEN** a row is inserted or replaced with name "default", value 75, and current timestamp

### Requirement: Lingo plugin with constructor-based migrations

The Lingo plugin SHALL accept `SqlStorage` in its constructor and call `migrate(sql, lingoMigrations, '_lingo_version')` to ensure the schema is current. It SHALL manage a `lingo_config` table with columns: `key TEXT PRIMARY KEY`, `value TEXT NOT NULL`, `updated_at INTEGER NOT NULL`. The config object contains `bots` (string array) and `language` (string).

#### Scenario: Constructor runs migrations

- **WHEN** a Lingo plugin is constructed with `new Lingo(sql)`
- **THEN** `migrate()` creates the `_lingo_version` table and the `lingo_config` table if they don't exist

#### Scenario: Get existing config

- **WHEN** `getConfig()` is called and a config row exists
- **THEN** the JSON-parsed config object is returned with `bots` and `language` fields

#### Scenario: Get when no config exists

- **WHEN** `getConfig()` is called and no config row exists
- **THEN** `undefined` is returned

#### Scenario: Set lingo config

- **WHEN** `setConfig({ bots: ["nightbot"], language: "en" })` is called
- **THEN** a row is inserted or replaced with key "config", the JSON value, and current timestamp

#### Scenario: Import lingo config (temporary migration)

- **WHEN** `import(...)` is called and no config row exists
- **THEN** a row is inserted with the imported config. If a config already exists, no changes are made.

### Requirement: JobScheduler plugin with constructor-based migrations

The JobScheduler plugin SHALL accept `SqlStorage` and `DurableObjectState` in its constructor and call `migrate(sql, jobSchedulerMigrations, '_job_scheduler_version')` to ensure the schema is current. It SHALL manage a `jobs` table with columns: `id TEXT PRIMARY KEY`, `task TEXT NOT NULL`, `payload TEXT NOT NULL DEFAULT '{}'`, `scheduled_at INTEGER NOT NULL`, `cron TEXT`, `status TEXT NOT NULL DEFAULT 'pending'`, `attempt INTEGER NOT NULL DEFAULT 0`, `max_retries INTEGER NOT NULL DEFAULT 3`, `backoff_base_seconds INTEGER NOT NULL DEFAULT 30`, `last_error TEXT`, `idempotency_key TEXT`, `created_at INTEGER NOT NULL`.

#### Scenario: Constructor runs migrations

- **WHEN** a JobScheduler is constructed with `new JobScheduler(sql, ctx)`
- **THEN** `migrate()` creates the `_job_scheduler_version` table and the `jobs` table with indexes if they don't exist

#### Scenario: Schedule one-shot job

- **WHEN** `schedule(60, "cleanup", { userId: "123" })` is called
- **THEN** a job is inserted with `scheduled_at` = now + 60s, status "pending", and the alarm is set

#### Scenario: Idempotency key deduplication

- **WHEN** `schedule(0, "task", {}, { key: "unique-key" })` is called and a non-dead job with key "unique-key" exists
- **THEN** scheduling is skipped (no duplicate job created)

#### Scenario: Successful one-shot job

- **WHEN** the alarm fires and a pending one-shot job is due
- **THEN** `host.scheduled()` is called, the job is marked "completed"

#### Scenario: Failed job with retries remaining

- **WHEN** a job fails and `attempt < max_retries`
- **THEN** the job is rescheduled with exponential backoff delay and attempt is incremented

#### Scenario: Failed job with retries exhausted

- **WHEN** a one-shot job fails and `attempt >= max_retries`
- **THEN** the job is marked "dead" with the error recorded in `last_error`

#### Scenario: Alarm sync

- **WHEN** jobs are processed or scheduled
- **THEN** the DO alarm is set to the `MIN(scheduled_at)` of all pending jobs
