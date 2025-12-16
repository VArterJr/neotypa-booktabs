import type { Database } from 'sql.js';

export function nowIso(): string {
  return new Date().toISOString();
}

export function one<T>(rows: T[]): T {
  if (rows.length !== 1) throw new Error('Expected exactly one row');
  return rows[0]!;
}

export function all<T>(db: Database, sql: string, params: any[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const out: T[] = [];
  while (stmt.step()) out.push(stmt.getAsObject() as T);
  stmt.free();
  return out;
}

export function run(db: Database, sql: string, params: any[] = []): void {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
}
