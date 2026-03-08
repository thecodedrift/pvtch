import type { Migrations } from '../migrate';

export const jobSchedulerMigrations: Migrations = {
  1: (sql) => {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        task TEXT NOT NULL,
        payload TEXT NOT NULL DEFAULT '{}',
        scheduled_at INTEGER NOT NULL,
        cron TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        attempt INTEGER NOT NULL DEFAULT 0,
        max_retries INTEGER NOT NULL DEFAULT 3,
        backoff_base_seconds INTEGER NOT NULL DEFAULT 30,
        last_error TEXT,
        created_at INTEGER NOT NULL
      )
    `);
    sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_jobs_pending
       ON jobs(scheduled_at) WHERE status = 'pending'`
    );
  },
  2: (sql) => {
    sql.exec(`ALTER TABLE jobs ADD COLUMN idempotency_key TEXT`);
    sql.exec(
      `CREATE UNIQUE INDEX idx_jobs_idempotency
       ON jobs(idempotency_key) WHERE idempotency_key IS NOT NULL AND status NOT IN ('dead')`
    );
  },
};
