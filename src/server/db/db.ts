import fs from 'node:fs/promises';
import path from 'node:path';
import lockfile from 'proper-lockfile';
import initSqlJs from 'sql.js';
import type { Database, SqlJsStatic } from 'sql.js';
import { SCHEMA_SQL } from './schema.js';

export class SqliteFileDb {
  private sql: SqlJsStatic | null = null;
  private db: Database | null = null;
  private readonly dbPath: string;
  private readonly lockPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    this.lockPath = `${dbPath}.lock`;
  }

  async open(): Promise<void> {
    if (this.db) return;

    this.sql = await initSqlJs({});
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

    const buf = await fs
      .readFile(this.dbPath)
      .catch((e: unknown) => (isNotFoundError(e) ? null : Promise.reject(e)));

    this.db = buf ? new this.sql.Database(new Uint8Array(buf)) : new this.sql.Database();
    this.db.exec(SCHEMA_SQL);
    await this.persist();
  }

  async withWrite<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
    await this.open();
    if (!this.db) throw new Error('DB not open');

    await fs.mkdir(path.dirname(this.lockPath), { recursive: true });
    await fs.writeFile(this.lockPath, '', { flag: 'a' });

    const release = await lockfile.lock(this.lockPath, { retries: { retries: 10, factor: 1.2, minTimeout: 25, maxTimeout: 250 } });
    try {
      this.db.exec('BEGIN');
      const result = await fn(this.db);
      this.db.exec('COMMIT');
      await this.persist();
      return result;
    } catch (e) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore
      }
      throw e;
    } finally {
      await release();
    }
  }

  async withRead<T>(fn: (db: Database) => T | Promise<T>): Promise<T> {
    await this.open();
    if (!this.db) throw new Error('DB not open');
    return await fn(this.db);
  }

  private async persist(): Promise<void> {
    if (!this.db) return;
    const data = this.db.export();
    await fs.writeFile(this.dbPath, Buffer.from(data));
  }
}

function isNotFoundError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && 'code' in e && (e as any).code === 'ENOENT';
}
