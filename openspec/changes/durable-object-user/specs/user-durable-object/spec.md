## ADDED Requirements

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
