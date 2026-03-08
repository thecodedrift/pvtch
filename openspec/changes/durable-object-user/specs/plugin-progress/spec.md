## ADDED Requirements

### Requirement: Plugin contract with constructor-based migrations

The Progress plugin SHALL accept `SqlStorage` in its constructor and call `migrate(sql, progressMigrations, '_progress_version')` to ensure the schema is current. DO constructors run on every cold start (after eviction and deploys), so migrations are always applied before the plugin is used.

#### Scenario: Constructor runs migrations

- **WHEN** a Progress plugin is constructed with `new Progress(sql)`
- **THEN** `migrate()` creates the `_progress_version` table and the `progress` table if they don't exist

#### Scenario: Constructor on existing DO instance

- **WHEN** a Progress plugin is constructed on a DO that already has current schema
- **THEN** `migrate()` performs one SELECT on `_progress_version`, finds the version is current, and returns immediately

### Requirement: Progress table schema

The Progress plugin SHALL manage a `progress` table with columns: `name TEXT PRIMARY KEY`, `value REAL NOT NULL`, `updated_at INTEGER NOT NULL`. This table SHALL be created by migration 1 in the `_progress_version` migration set.

#### Scenario: Table structure

- **WHEN** migrations have run
- **THEN** the `progress` table exists with `name`, `value`, and `updated_at` columns

### Requirement: Get progress value

The plugin SHALL provide a `get(name: string)` method that returns the numeric value for the given progress name, or `null` if no row exists.

#### Scenario: Get existing progress

- **WHEN** `get("default")` is called and a row with name "default" exists
- **THEN** the numeric value is returned

#### Scenario: Get nonexistent progress

- **WHEN** `get("unknown")` is called and no row with that name exists
- **THEN** `null` is returned

### Requirement: Set progress value

The plugin SHALL provide a `set(name: string, value: number)` method that inserts or replaces the progress row with the given name, value, and current timestamp.

#### Scenario: Set new progress

- **WHEN** `set("default", 75)` is called and no row with name "default" exists
- **THEN** a new row is inserted with name "default", value 75, and current timestamp

#### Scenario: Update existing progress

- **WHEN** `set("default", 80)` is called and a row with name "default" already exists
- **THEN** the row is updated with value 80 and current timestamp
