import path from 'node:path';

export const CONFIG = {
  port: numberFromEnv('PORT', 8787),
  dbPath: process.env.DB_PATH ?? path.resolve(process.cwd(), 'data', 'app.sqlite'),
  publicDir: process.env.PUBLIC_DIR ?? path.resolve(process.cwd(), 'dist', 'client')
};

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}
