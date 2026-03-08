import { RpcTarget } from 'cloudflare:workers';
import { migrate, type Migrations } from '../helpers/migrate';

const progressMigrations: Migrations = {
  1: (sql) => {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS progress (
        name TEXT PRIMARY KEY,
        value REAL NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  },
};

export class Progress extends RpcTarget {
  private sql: SqlStorage;

  constructor(sql: SqlStorage) {
    super();
    this.sql = sql;
    migrate(sql, progressMigrations, '_progress_version');
  }

  get(name: string): number | undefined {
    const rows = this.sql
      .exec(`SELECT value FROM progress WHERE name = ?`, name)
      .toArray() as unknown as { value: number }[];

    const row = rows[0];
    return row ? row.value : undefined;
  }

  set(name: string, value: number): number {
    const now = Date.now();
    this.sql.exec(
      `INSERT OR REPLACE INTO progress (name, value, updated_at) VALUES (?, ?, ?)`,
      name,
      value,
      now
    );
    return value;
  }
}
