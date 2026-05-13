import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { User } from '../../do/user';
import { JobScheduler } from '../../do/helpers/job-scheduler';

// Hand-rolled SqlStorage shim — see job-scheduler.test.ts for the rationale.
// Duplicated intentionally so each test file stands alone.
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
  vi.restoreAllMocks();
  vi.useRealTimers();
  database.close();
});

function makeUser(): User {
  const ctx = {
    id: { name: 'twitch:test-user' },
    storage: { sql, setAlarm: vi.fn() },
  } as unknown as DurableObjectState;
  const env = {} as Env;
  return new User(ctx, env);
}

function pendingSyncProfileCount(): number {
  const rows = database
    .prepare(
      `SELECT COUNT(*) AS c FROM jobs
       WHERE idempotency_key = 'sync-profile' AND status = 'pending'`
    )
    .all() as { c: number }[];
  return rows[0]?.c ?? 0;
}

describe('User.ensureProfileSync — per-instance latch (Bug 1)', () => {
  it('only delegates to the scheduler once per DO instance', () => {
    // Spy on schedule() before constructing the User. The latch must skip
    // the call on subsequent invocations — without it, every translate
    // request would hit the scheduler's idempotency SELECT.
    const scheduleSpy = vi.spyOn(JobScheduler.prototype, 'schedule');

    const user = makeUser();
    user.ensureProfileSync();
    user.ensureProfileSync();
    user.ensureProfileSync();

    expect(scheduleSpy).toHaveBeenCalledTimes(1);
    expect(pendingSyncProfileCount()).toBe(1);
  });

  it('a new DO instance re-arms the sync (latch resets per instance)', () => {
    const scheduleSpy = vi.spyOn(JobScheduler.prototype, 'schedule');

    const user1 = makeUser();
    user1.ensureProfileSync();
    user1.ensureProfileSync();
    expect(scheduleSpy).toHaveBeenCalledTimes(1);

    // Simulate a cold start: a fresh User instance against the same SQL.
    // The latch is per-instance, so the second user must call schedule()
    // again — the scheduler's own dedupe handles the existing row.
    const user2 = makeUser();
    user2.ensureProfileSync();
    expect(scheduleSpy).toHaveBeenCalledTimes(2);
    expect(pendingSyncProfileCount()).toBe(1);
  });
});
