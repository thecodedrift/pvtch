import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobScheduler } from '../../do/helpers/job-scheduler';

// Hand-rolled SqlStorage shim over better-sqlite3. Cloudflare's `exec()`
// doesn't distinguish reads from writes; better-sqlite3 does, so we try
// .all() and fall back to .run() if SQLite refuses to return rows.
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

interface JobRow {
  id: string;
  status: string;
  scheduled_at: number;
  idempotency_key: string | undefined;
}

let database: Database.Database;
let sql: SqlStorage;
let scheduler: JobScheduler;
let setAlarm: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-15T12:00:00Z'));
  database = new Database(':memory:');
  sql = createSqlStorage(database);
  setAlarm = vi.fn();
  const ctx = {
    storage: { sql, setAlarm },
  } as unknown as DurableObjectState;
  scheduler = new JobScheduler(sql, ctx);
});

afterEach(() => {
  vi.useRealTimers();
  database.close();
});

function rowsByKey(key: string): JobRow[] {
  return database
    .prepare(
      `SELECT id, status, scheduled_at, idempotency_key
       FROM jobs WHERE idempotency_key = ?
       ORDER BY scheduled_at ASC`
    )
    .all(key) as JobRow[];
}

describe('JobScheduler — recurring handler re-arm (Bug 2)', () => {
  it('a handler can re-schedule itself with the same idempotency key', async () => {
    const id1 = scheduler.schedule(0, 'recurring', {}, { key: 'recurring' });
    expect(id1).toBeDefined();

    let rescheduledId: string | undefined;
    await scheduler.processAlarm({
      scheduled: () => {
        rescheduledId = scheduler.schedule(
          86400,
          'recurring',
          {},
          { key: 'recurring' }
        );
      },
    });

    // The reschedule from inside the handler must succeed — pre-fix this
    // returned undefined because the handler's own row was 'running' and
    // matched the dedupe gate.
    expect(rescheduledId).toBeDefined();

    const rows = rowsByKey('recurring');
    expect(rows).toHaveLength(2);
    const completed = rows.find((r) => r.status === 'completed');
    const pending = rows.find((r) => r.status === 'pending');
    expect(completed).toBeDefined();
    expect(pending).toBeDefined();
    // Pending row should be scheduled for ~24h later
    expect(pending?.scheduled_at).toBe(Date.now() + 86400 * 1000);
  });

  it('still dedupes a fresh schedule when a pending job already exists', () => {
    const a = scheduler.schedule(60, 't', {}, { key: 'k' });
    const b = scheduler.schedule(60, 't', {}, { key: 'k' });
    expect(a).toBeDefined();
    expect(b).toBeUndefined();
    expect(rowsByKey('k')).toHaveLength(1);
  });
});

describe('JobScheduler — reaper index (Bug 3)', () => {
  it('idx_jobs_reaper exists with the expected partial predicate', () => {
    const indexes = database
      .prepare(
        `SELECT name, sql FROM sqlite_master
         WHERE type = 'index' AND name = 'idx_jobs_reaper'`
      )
      .all() as { name: string; sql: string }[];
    expect(indexes).toHaveLength(1);
    const indexSql = indexes[0]?.sql ?? '';
    expect(indexSql).toContain('created_at');
    expect(indexSql).toContain("status IN ('completed', 'dead')");
  });

  it('reaper DELETE uses the partial index (EXPLAIN QUERY PLAN)', () => {
    // Seed a few rows so SQLite has something to plan over.
    scheduler.schedule(60, 't', {});
    const cutoff = Date.now();
    const plan = database
      .prepare(
        `EXPLAIN QUERY PLAN
         DELETE FROM jobs
         WHERE status IN ('completed', 'dead') AND created_at < ?`
      )
      .all(cutoff) as { detail: string }[];
    const detail = plan.map((p) => p.detail).join(' | ');
    expect(detail).toMatch(/idx_jobs_reaper/);
  });
});
