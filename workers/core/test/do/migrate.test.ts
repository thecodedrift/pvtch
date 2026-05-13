import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { migrate, type Migrations } from '../../do/helpers/migrate';

// Baseline coverage for the schema-version migrate() helper. Plugins on the
// User DO each call migrate() with their own version table, so the helper's
// behavior (idempotent, sequential, isolated per table) is load-bearing.

function createSqlStorage(database: Database.Database): SqlStorage {
  const exec = (query: string, ...bindings: unknown[]) => {
    const stmt = database.prepare(query);
    let rows: Record<string, unknown>[] = [];
    try {
      rows = stmt.all(...bindings) as Record<string, unknown>[];
    } catch {
      stmt.run(...bindings);
    }
    return {
      toArray: () => rows,
      [Symbol.iterator]: () => rows[Symbol.iterator](),
      raw: () => ({ [Symbol.iterator]: () => [][Symbol.iterator]() }),
      columnNames: [],
      rowsRead: rows.length,
      rowsWritten: 0,
    };
  };
  return { exec } as unknown as SqlStorage;
}

let database: Database.Database;
let sql: SqlStorage;

beforeEach(() => {
  database = new Database(':memory:');
  sql = createSqlStorage(database);
});

afterEach(() => {
  database.close();
});

function currentVersion(table: string): number {
  const rows = database
    .prepare(`SELECT version FROM ${table} LIMIT 1`)
    .all() as { version: number }[];
  return rows[0]?.version ?? 0;
}

describe('migrate()', () => {
  it('runs all migrations on a fresh database', () => {
    const migrations: Migrations = {
      1: (s) => s.exec(`CREATE TABLE a (x INTEGER)`),
      2: (s) => s.exec(`CREATE TABLE b (y INTEGER)`),
    };
    migrate(sql, migrations, '_test_v');
    expect(currentVersion('_test_v')).toBe(2);

    const tables = database
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name IN ('a','b') ORDER BY name`
      )
      .all() as { name: string }[];
    expect(tables.map((t) => t.name)).toEqual(['a', 'b']);
  });

  it('is idempotent on a second call', () => {
    let runCount = 0;
    const migrations: Migrations = {
      1: (s) => {
        runCount++;
        s.exec(`CREATE TABLE only_once (x INTEGER)`);
      },
    };
    migrate(sql, migrations, '_test_v');
    migrate(sql, migrations, '_test_v');
    expect(runCount).toBe(1);
    expect(currentVersion('_test_v')).toBe(1);
  });

  it('only runs newly-added migrations', () => {
    let v2Ran = 0;

    migrate(
      sql,
      {
        1: (s) => s.exec(`CREATE TABLE t (x INTEGER)`),
      },
      '_test_v'
    );
    expect(currentVersion('_test_v')).toBe(1);

    migrate(
      sql,
      {
        1: (s) => s.exec(`CREATE TABLE t (x INTEGER)`),
        2: (s) => {
          v2Ran++;
          s.exec(`ALTER TABLE t ADD COLUMN y INTEGER`);
        },
      },
      '_test_v'
    );
    expect(v2Ran).toBe(1);
    expect(currentVersion('_test_v')).toBe(2);
  });

  it('runs migrations in numeric order', () => {
    const order: number[] = [];
    const migrations: Migrations = {
      3: () => order.push(3),
      1: () => order.push(1),
      2: () => order.push(2),
    };
    migrate(sql, migrations, '_test_v');
    expect(order).toEqual([1, 2, 3]);
    expect(currentVersion('_test_v')).toBe(3);
  });

  it('isolates migration state per version-table name', () => {
    migrate(
      sql,
      { 1: (s) => s.exec(`CREATE TABLE x_table (a INTEGER)`) },
      '_x_v'
    );
    migrate(
      sql,
      { 1: (s) => s.exec(`CREATE TABLE y_table (a INTEGER)`) },
      '_y_v'
    );
    expect(currentVersion('_x_v')).toBe(1);
    expect(currentVersion('_y_v')).toBe(1);
  });

  it('no-op when migrations object is empty', () => {
    migrate(sql, {}, '_test_v');
    const tables = database
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='_test_v'`
      )
      .all() as { name: string }[];
    // Empty migrations means targetVersion <= 0 → helper returns early.
    expect(tables).toHaveLength(0);
  });
});
