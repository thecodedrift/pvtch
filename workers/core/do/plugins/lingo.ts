import { RpcTarget } from 'cloudflare:workers';
import { migrate, type Migrations } from '../helpers/migrate';

export type LingoPluginConfig = {
  bots: string[];
  language: string;
};

const lingoMigrations: Migrations = {
  1: (sql) => {
    sql.exec(`
      CREATE TABLE IF NOT EXISTS lingo_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
  },
};

export class Lingo extends RpcTarget {
  private sql: SqlStorage;

  constructor(sql: SqlStorage) {
    super();
    this.sql = sql;
    migrate(sql, lingoMigrations, '_lingo_version');
  }

  getConfig(): LingoPluginConfig | undefined {
    const rows = this.sql
      .exec(`SELECT value FROM lingo_config WHERE key = 'config'`)
      .toArray() as unknown as { value: string }[];

    const row = rows[0];
    if (!row) return undefined;

    return JSON.parse(row.value) as LingoPluginConfig;
  }

  setConfig(config: LingoPluginConfig): LingoPluginConfig {
    const now = Date.now();
    this.sql.exec(
      `INSERT OR REPLACE INTO lingo_config (key, value, updated_at) VALUES ('config', ?, ?)`,
      JSON.stringify(config),
      now
    );
    return config;
  }

  /**
   * Import config from old PvtchBackend DO. Only inserts if no config exists.
   * Temporary — remove after migration period.
   */
  import(config: LingoPluginConfig): LingoPluginConfig {
    const existing = this.getConfig();
    if (existing) return existing;
    return this.setConfig(config);
  }
}
