import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Progress } from '../../do/plugins/progress';
import { Lingo } from '../../do/plugins/lingo';
import { Profile } from '../../do/plugins/profile';

// Baseline coverage for the simple key/value plugins on the User DO. Each
// is a thin RpcTarget over a single SQLite table; the goal here is to
// document expected behavior (round-tripping, default values, JSON config
// shape) so future refactors have a regression net.

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
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  database = new Database(':memory:');
  sql = createSqlStorage(database);
});

afterEach(() => {
  vi.useRealTimers();
  database.close();
});

describe('Progress plugin', () => {
  it('returns undefined for an unset key', () => {
    const progress = new Progress(sql);
    expect(progress.get('subgoal')).toBeUndefined();
  });

  it('round-trips a value through set/get', () => {
    const progress = new Progress(sql);
    progress.set('subgoal', 42);
    expect(progress.get('subgoal')).toBe(42);
  });

  it('overwrites an existing value (INSERT OR REPLACE)', () => {
    const progress = new Progress(sql);
    progress.set('subgoal', 10);
    progress.set('subgoal', 20);
    expect(progress.get('subgoal')).toBe(20);
  });

  it('keys are independent', () => {
    const progress = new Progress(sql);
    progress.set('a', 1);
    progress.set('b', 2);
    expect(progress.get('a')).toBe(1);
    expect(progress.get('b')).toBe(2);
  });

  it('preserves fractional values', () => {
    const progress = new Progress(sql);
    progress.set('pct', 33.5);
    expect(progress.get('pct')).toBe(33.5);
  });
});

describe('Lingo plugin', () => {
  it('returns undefined when no config has been set', () => {
    const lingo = new Lingo(sql);
    expect(lingo.getConfig()).toBeUndefined();
  });

  it('round-trips a config through setConfig/getConfig', () => {
    const lingo = new Lingo(sql);
    const config = { bots: ['nightbot', 'streamlabs'], language: 'spanish' };
    lingo.setConfig(config);
    expect(lingo.getConfig()).toEqual(config);
  });

  it('setConfig overwrites the previous config', () => {
    const lingo = new Lingo(sql);
    lingo.setConfig({ bots: ['a'], language: 'french' });
    lingo.setConfig({ bots: ['b', 'c'], language: 'german' });
    expect(lingo.getConfig()).toEqual({
      bots: ['b', 'c'],
      language: 'german',
    });
  });

  it('import() inserts only when no config exists', () => {
    const lingo = new Lingo(sql);
    const initial = { bots: ['a'], language: 'english' };
    expect(lingo.import(initial)).toEqual(initial);

    // Second import is a no-op — returns the existing config, not the new one.
    const second = lingo.import({ bots: ['b'], language: 'japanese' });
    expect(second).toEqual(initial);
    expect(lingo.getConfig()).toEqual(initial);
  });
});

describe('Profile plugin', () => {
  it('returns undefined when no twitch name is set', () => {
    const profile = new Profile(sql);
    expect(profile.getTwitchName()).toBeUndefined();
  });

  it('round-trips a twitch name through setTwitchName/getTwitchName', () => {
    const profile = new Profile(sql);
    profile.setTwitchName('streamerX');
    expect(profile.getTwitchName()).toBe('streamerX');
  });

  it('setTwitchName overwrites a prior value', () => {
    const profile = new Profile(sql);
    profile.setTwitchName('first');
    profile.setTwitchName('second');
    expect(profile.getTwitchName()).toBe('second');
  });
});
