# storage Specification

## Purpose
Generic key-value storage layer using Cloudflare Durable Objects with TTL strategies, size limits, alarm-based cleanup, key normalization, and context injection for Cloudflare bindings.
## Requirements
### Requirement: Set value with TTL
The system SHALL provide a `set(value, options?)` method that stores a string value in the Durable Object's SQLite storage. The value MUST NOT exceed 5KB. An optional `TTLOptions` parameter SHALL specify the TTL strategy and duration. Default TTL SHALL be 25 hours with PRESERVE_ON_UPDATE strategy. After storing the value, an alarm SHALL be scheduled at the expiration time.

#### Scenario: Set with default TTL
- **WHEN** `set("data")` is called without TTL options
- **THEN** the value is stored with a 25-hour expiration using PRESERVE_ON_UPDATE strategy

#### Scenario: Set with custom TTL
- **WHEN** `set("data", { strategy: "PRESERVE_ON_FETCH", ttlMs: 2592000000 })` is called
- **THEN** the value is stored with a 30-day expiration using PRESERVE_ON_FETCH strategy

#### Scenario: Value exceeds size limit
- **WHEN** `set` is called with a value larger than 5KB
- **THEN** an error is thrown

#### Scenario: Overwrite existing value
- **WHEN** `set` is called on a DO that already has a value
- **THEN** the old value is replaced and the alarm is rescheduled

### Requirement: Get value with strategy-based TTL refresh
The system SHALL provide a `get()` method that returns the stored string value (or empty string if none exists). When the TTL strategy is PRESERVE_ON_FETCH, reading the value SHALL reset the expiration to `now + ttl` and reschedule the alarm.

#### Scenario: Get with PRESERVE_ON_UPDATE
- **WHEN** `get()` is called and the strategy is PRESERVE_ON_UPDATE
- **THEN** the value is returned without modifying the expiration

#### Scenario: Get with PRESERVE_ON_FETCH
- **WHEN** `get()` is called and the strategy is PRESERVE_ON_FETCH
- **THEN** the value is returned and the expiration is reset to `now + ttl`

#### Scenario: Get when no value exists
- **WHEN** `get()` is called and no value has been stored
- **THEN** an empty string is returned

### Requirement: Alarm-based expiration cleanup
The system SHALL implement an `alarm()` method that checks the stored expiration timestamp. If the current time exceeds the expiration, all storage for the DO instance SHALL be deleted.

#### Scenario: Expired data cleanup
- **WHEN** the alarm fires and the expiration timestamp has passed
- **THEN** all data in the DO instance is deleted via `storage.deleteAll()`

#### Scenario: Alarm fires before expiration
- **WHEN** the alarm fires but the expiration has been extended (e.g., by a PRESERVE_ON_FETCH read)
- **THEN** no data is deleted

### Requirement: Key normalization
The system SHALL provide a `normalizeKey(token, id)` function that produces a consistent Durable Object instance name in the format `{token}::{id}`. All widget routes MUST use this function when addressing DO instances.

#### Scenario: Normalize key
- **WHEN** `normalizeKey("abc123", "progress-default")` is called
- **THEN** the string `"abc123::progress-default"` is returned

### Requirement: Cloudflare binding context injection
The system SHALL provide React Router contexts for: (1) `cloudflareEnvironmentContext` exposing the worker's `Env` bindings, (2) `cloudflareExecutionContext` exposing the `ExecutionContext`, (3) `userContext` for authenticated Twitch user data. These contexts SHALL be set in the request handler middleware and accessed via `context.get()` in loaders and actions.

#### Scenario: Access env bindings in loader
- **WHEN** a route loader calls `context.get(cloudflareEnvironmentContext)`
- **THEN** it receives the Cloudflare `Env` object with KV, DO, and AI bindings

#### Scenario: Access user context
- **WHEN** a route loader calls `context.get(userContext)` after authentication middleware
- **THEN** it receives the authenticated user's Twitch id, login, and displayName

