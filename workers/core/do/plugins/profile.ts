import { RpcTarget } from 'cloudflare:workers';
import { migrate, type Migrations } from '../helpers/migrate';

const profileMigrations: Migrations = {
  1: (sql) => {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS profile (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  },
};

export class Profile extends RpcTarget {
  private sql: SqlStorage;

  constructor(sql: SqlStorage) {
    super();
    this.sql = sql;
    migrate(sql, profileMigrations, '_profile_version');
  }

  getTwitchName(): string | undefined {
    const rows = this.sql
      .exec(`SELECT value FROM profile WHERE key = 'twitch_name'`)
      .toArray() as unknown as { value: string }[];

    return rows[0]?.value;
  }

  setTwitchName(name: string): void {
    const now = Date.now();
    this.sql.exec(
      `INSERT OR REPLACE INTO profile (key, value, updated_at) VALUES ('twitch_name', ?, ?)`,
      name,
      now
    );
  }
}
