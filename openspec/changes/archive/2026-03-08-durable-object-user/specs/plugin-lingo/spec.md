## ADDED Requirements

### Requirement: Plugin contract with constructor-based migrations

The Lingo plugin SHALL accept `SqlStorage` in its constructor and call `migrate(sql, lingoMigrations, '_lingo_version')` to ensure the schema is current. DO constructors run on every cold start (after eviction and deploys), so migrations are always applied before the plugin is used.

#### Scenario: Constructor runs migrations

- **WHEN** a Lingo plugin is constructed with `new Lingo(sql)`
- **THEN** `migrate()` creates the `_lingo_version` table and the `lingo_config` table if they don't exist

#### Scenario: Constructor on existing DO instance

- **WHEN** a Lingo plugin is constructed on a DO that already has current schema
- **THEN** `migrate()` performs one SELECT on `_lingo_version`, finds the version is current, and returns immediately

### Requirement: Lingo config table schema

The Lingo plugin SHALL manage a `lingo_config` table with columns: `key TEXT PRIMARY KEY`, `value TEXT NOT NULL`, `updated_at INTEGER NOT NULL`. This table SHALL be created by migration 1 in the `_lingo_version` migration set. The table uses a single row with key `"config"` to store the JSON-serialized lingo configuration.

#### Scenario: Table structure

- **WHEN** migrations have run
- **THEN** the `lingo_config` table exists with `key`, `value`, and `updated_at` columns

### Requirement: Get lingo config

The plugin SHALL provide a `getConfig()` method that returns the parsed lingo configuration object, or `null` if no config exists. The config object contains `bots` (string array) and `language` (string).

#### Scenario: Get existing config

- **WHEN** `getConfig()` is called and a config row exists
- **THEN** the JSON-parsed config object is returned with `bots` and `language` fields

#### Scenario: Get when no config exists

- **WHEN** `getConfig()` is called and no config row exists
- **THEN** `null` is returned

### Requirement: Set lingo config

The plugin SHALL provide a `setConfig(config)` method that inserts or replaces the config row with the JSON-serialized config and current timestamp.

#### Scenario: Save new config

- **WHEN** `setConfig({ bots: ["nightbot"], language: "en" })` is called
- **THEN** a row is inserted with key "config", the JSON value, and current timestamp

#### Scenario: Update existing config

- **WHEN** `setConfig(...)` is called and a config row already exists
- **THEN** the row is updated with the new JSON value and current timestamp

### Requirement: Import lingo config (temporary migration)

The plugin SHALL provide an `import(config)` method that inserts a config row only if no config currently exists. This method is temporary and used for migrating data from the old PvtchBackend DO. The import SHALL be a no-op if a config already exists, ensuring it only runs once.

#### Scenario: Import into empty config

- **WHEN** `import({ bots: ["nightbot"], language: "en" })` is called and no config row exists
- **THEN** a row is inserted with the imported config

#### Scenario: Import skipped when config exists

- **WHEN** `import(...)` is called and a config row already exists
- **THEN** no changes are made (existing config is preserved)
