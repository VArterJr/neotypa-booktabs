import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import bcrypt from 'bcrypt';
import { getCookies, setCookie } from './http/cookies.js';
import type { Database } from 'sql.js';
import { all, nowIso, one, run } from './db/util.js';

const COOKIE_NAME = 'sid';
const SALT_ROUNDS = 10;
const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days in seconds

export function readSessionId(req: IncomingMessage): string | null {
  const cookies = getCookies(req);
  return cookies[COOKIE_NAME] ?? null;
}

export function setSessionCookie(res: ServerResponse, sessionId: string): void {
  setCookie(res, COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE
  });
}

export function clearSessionCookie(res: ServerResponse): void {
  setCookie(res, COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: false,
    expires: new Date(0)
  });
}

export function createSession(db: Database, userId: string): string {
  const id = randomUUID();
  const now = nowIso();
  run(db, 'INSERT INTO sessions (id, user_id, created_at, last_seen_at) VALUES (?, ?, ?, ?)', [id, userId, now, now]);
  return id;
}

export function deleteSession(db: Database, sessionId: string): void {
  run(db, 'DELETE FROM sessions WHERE id = ?', [sessionId]);
}

export function getUserIdForSession(db: Database, sessionId: string): string | null {
  const rows = all<{ user_id: string; created_at: string }>(db, 'SELECT user_id, created_at FROM sessions WHERE id = ?', [sessionId]);
  if (rows.length === 0) return null;
  
  const session = one(rows);
  const createdAt = new Date(session.created_at);
  const now = new Date();
  const ageInSeconds = (now.getTime() - createdAt.getTime()) / 1000;
  
  // Session expired - delete it
  if (ageInSeconds > SESSION_MAX_AGE) {
    run(db, 'DELETE FROM sessions WHERE id = ?', [sessionId]);
    return null;
  }
  
  run(db, 'UPDATE sessions SET last_seen_at = ? WHERE id = ?', [nowIso(), sessionId]);
  return session.user_id;
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

/**
 * Clean up expired sessions from the database
 * @returns void
 */
export function cleanupExpiredSessions(db: Database): void {
  const cutoff = new Date(Date.now() - SESSION_MAX_AGE * 1000).toISOString();
  run(db, 'DELETE FROM sessions WHERE created_at < ?', [cutoff]);
}
