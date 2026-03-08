## ADDED Requirements

### Requirement: Plugin contract with constructor-based migrations

The JobScheduler plugin SHALL accept `SqlStorage` and `DurableObjectState` in its constructor and call `migrate(sql, jobSchedulerMigrations, '_job_scheduler_version')` to ensure the schema is current. DO constructors run on every cold start (after eviction and deploys), so migrations are always applied before the plugin is used.

#### Scenario: Constructor runs migrations

- **WHEN** a JobScheduler is constructed with `new JobScheduler(sql, ctx)`
- **THEN** `migrate()` creates the `_job_scheduler_version` table and the `jobs` table with indexes if they don't exist

#### Scenario: Constructor on existing DO instance

- **WHEN** a JobScheduler is constructed on a DO that already has current schema
- **THEN** `migrate()` performs one SELECT on `_job_scheduler_version`, finds the version is current, and returns immediately

### Requirement: Jobs table schema

The JobScheduler SHALL manage a `jobs` table with columns: `id TEXT PRIMARY KEY`, `task TEXT NOT NULL`, `payload TEXT NOT NULL DEFAULT '{}'`, `scheduled_at INTEGER NOT NULL`, `cron TEXT`, `status TEXT NOT NULL DEFAULT 'pending'`, `attempt INTEGER NOT NULL DEFAULT 0`, `max_retries INTEGER NOT NULL DEFAULT 3`, `backoff_base_seconds INTEGER NOT NULL DEFAULT 30`, `last_error TEXT`, `idempotency_key TEXT`, `created_at INTEGER NOT NULL`. A partial index on `scheduled_at` WHERE `status = 'pending'` SHALL be created for efficient alarm processing. A unique partial index on `idempotency_key` WHERE `idempotency_key IS NOT NULL AND status NOT IN ('dead')` SHALL be created for deduplication.

#### Scenario: Table and indexes created

- **WHEN** migrations have run
- **THEN** the `jobs` table exists with all columns and both indexes

### Requirement: Schedule one-shot and recurring jobs

The plugin SHALL provide a `schedule(when, task, payload, options?)` method. The `when` parameter SHALL accept: a `Date` (absolute time), a `number` (seconds from now), or a `string` (cron expression for recurring). After inserting the job, the DO alarm SHALL be synced to the earliest pending job's `scheduled_at`.

#### Scenario: Schedule one-shot job by seconds

- **WHEN** `schedule(60, "cleanup", { userId: "123" })` is called
- **THEN** a job is inserted with `scheduled_at` = now + 60s, status "pending", and the alarm is set

#### Scenario: Schedule recurring cron job

- **WHEN** `schedule("0 */6 * * *", "sync", {})` is called
- **THEN** a job is inserted with the next cron occurrence as `scheduled_at` and the cron expression stored

#### Scenario: Idempotency key deduplication

- **WHEN** `schedule(0, "task", {}, { key: "unique-key" })` is called and a non-dead job with key "unique-key" exists
- **THEN** scheduling is skipped (no duplicate job created)

### Requirement: Process alarm with retry and backoff

The `processAlarm(host)` method SHALL process all due jobs (where `scheduled_at <= now` and `status = 'pending'`). For each job, it SHALL call `host.scheduled({ task, payload })`. On success: one-shot jobs are marked "completed", cron jobs are rescheduled to next occurrence. On failure: retry with exponential backoff (`base * 2^attempt` seconds) up to `max_retries`, then mark "dead" (one-shot) or reschedule fresh (cron). After processing, completed/dead jobs older than 30 days SHALL be reaped.

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
