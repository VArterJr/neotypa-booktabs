import type { IncomingMessage, ServerResponse } from 'node:http';
import { Router } from '../http/router.js';
import { readJson } from '../http/body.js';
import { sendJson, sendNoContent } from '../http/response.js';
import { clearSessionCookie, createSession, readSessionId, setSessionCookie, deleteSession, getUserIdForSession, hashPassword, verifyPassword, cleanupExpiredSessions } from '../auth.js';
import type { SqliteFileDb } from '../db/db.js';
import {
  createBookmark,
  createFolder,
  createGroup,
  createUser,
  createWorkspace,
  deleteBookmark,
  deleteFolder,
  deleteGroup,
  deleteWorkspace,
  findUserByUsername,
  getState,
  getUserById,
  moveBookmarkToGroup,
  moveFolderToWorkspace,
  moveGroupToFolder,
  reorderBookmarksInGroup,
  reorderFolders,
  reorderGroupsInFolder,
  reorderWorkspaces,
  updateBookmark,
  updateFolder,
  updateGroup,
  updatePreferences,
  updateWorkspace
} from '../db/queries.js';
import { descriptionSchema, parseOrThrow, passwordSchema, tagsSchema, titleSchema, urlSchema, usernameSchema, importStrategySchema, importHtmlSchema } from './validation.js';
import type { UserPreferences, ViewMode } from '@app/shared';
import { exportToNetscape, importFromNetscape, type ImportOptions } from './import-export.js';

export function registerApiRoutes(router: Router, dbFile: SqliteFileDb): void {
  router.on('GET', '/api/me', async (req, res) => {
    const userId = await requireMaybeUserId(dbFile, req);
    if (!userId) return sendJson(res, 200, null);

    const user = await dbFile.withRead((db) => getUserById(db, userId));
    return sendJson(res, 200, user);
  });

  router.on('POST', '/api/auth/register', async (req, res) => {
    const body = await readJson<any>(req);
    const username = parseOrThrow(usernameSchema, body.username);
    const password = parseOrThrow(passwordSchema, body.password);

    await dbFile.withWrite(async (db) => {
      const existing = findUserByUsername(db, username);
      if (existing) throw new Error('Username already exists');
      const hashedPassword = await hashPassword(password);
      createUser(db, username, hashedPassword);
      // Clean up expired sessions periodically on user operations
      cleanupExpiredSessions(db);
    });

    sendNoContent(res);
  });

  router.on('POST', '/api/auth/login', async (req, res) => {
    const body = await readJson<any>(req);
    const username = parseOrThrow(usernameSchema, body.username);
    const password = parseOrThrow(passwordSchema, body.password);

    const { user, sessionId } = await dbFile.withWrite(async (db) => {
      const found = findUserByUsername(db, username);
      if (!found) throw new Error('Invalid username or password');
      
      const isValid = await verifyPassword(password, found.password);
      if (!isValid) throw new Error('Invalid username or password');
      
      const sessionId = createSession(db, found.id);
      const user = getUserById(db, found.id);
      if (!user) throw new Error('User not found');
      
      // Clean up expired sessions periodically
      cleanupExpiredSessions(db);
      
      return { user, sessionId };
    });

    setSessionCookie(res, sessionId);
    sendJson(res, 200, user);
  });

  router.on('POST', '/api/auth/logout', async (req, res) => {
    const sid = readSessionId(req);
    if (sid) {
      await dbFile.withWrite((db) => deleteSession(db, sid));
    }
    clearSessionCookie(res);
    sendNoContent(res);
  });

  router.on('GET', '/api/state', async (req, res) => {
    const userId = await requireUserId(dbFile, req);
    const state = await dbFile.withRead((db) => getState(db, userId));
    sendJson(res, 200, state);
  });

  router.on('PUT', '/api/preferences', async (req, res) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);

    const patch: Partial<UserPreferences> = {};
    if (typeof body.theme === 'string') patch.theme = body.theme;
    if (typeof body.viewMode === 'string') patch.viewMode = body.viewMode as ViewMode;

    const prefs = await dbFile.withWrite((db) => updatePreferences(db, userId, patch));
    sendJson(res, 200, prefs);
  });

  // Workspaces
  router.on('POST', '/api/workspaces', async (req, res) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const title = parseOrThrow(titleSchema, body.title);
    const workspace = await dbFile.withWrite((db) => createWorkspace(db, userId, title));
    sendJson(res, 201, workspace);
  });

  router.on('PUT', '/api/workspaces/:id', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const title = parseOrThrow(titleSchema, body.title);
    const workspace = await dbFile.withWrite((db) => updateWorkspace(db, userId, params.id, title));
    sendJson(res, 200, workspace);
  });

  router.on('DELETE', '/api/workspaces/:id', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    await dbFile.withWrite((db) => deleteWorkspace(db, userId, params.id));
    sendNoContent(res);
  });

  router.on('PUT', '/api/workspaces/reorder', async (req, res) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : null;
    if (!orderedIds) throw new Error('orderedIds required');
    await dbFile.withWrite((db) => reorderWorkspaces(db, userId, orderedIds));
    sendNoContent(res);
  });

  // Folders
  router.on('POST', '/api/folders', async (req, res) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const workspaceId = String(body.workspaceId ?? '');
    const title = parseOrThrow(titleSchema, body.title);
    const folder = await dbFile.withWrite((db) => createFolder(db, userId, workspaceId, title));
    sendJson(res, 201, folder);
  });

  router.on('PUT', '/api/folders/:id', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const title = parseOrThrow(titleSchema, body.title);
    const folder = await dbFile.withWrite((db) => updateFolder(db, userId, params.id, title));
    sendJson(res, 200, folder);
  });

  router.on('DELETE', '/api/folders/:id', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    await dbFile.withWrite((db) => deleteFolder(db, userId, params.id));
    sendNoContent(res);
  });

  router.on('PUT', '/api/folders/reorder', async (req, res) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const workspaceId = String(body.workspaceId ?? '');
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : null;
    if (!orderedIds) throw new Error('orderedIds required');
    await dbFile.withWrite((db) => reorderFolders(db, userId, workspaceId, orderedIds));
    sendNoContent(res);
  });

  router.on('PUT', '/api/folders/:id/move', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const workspaceId = String(body.workspaceId ?? '');
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : null;
    if (!orderedIds) throw new Error('orderedIds required');
    await dbFile.withWrite((db) => moveFolderToWorkspace(db, userId, params.id, workspaceId, orderedIds));
    sendNoContent(res);
  });

  // Groups
  router.on('POST', '/api/groups', async (req, res) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const folderId = String(body.folderId ?? '');
    const title = parseOrThrow(titleSchema, body.title);
    const group = await dbFile.withWrite((db) => createGroup(db, userId, folderId, title));
    sendJson(res, 201, group);
  });

  router.on('PUT', '/api/groups/:id', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const title = parseOrThrow(titleSchema, body.title);
    const group = await dbFile.withWrite((db) => updateGroup(db, userId, params.id, title));
    sendJson(res, 200, group);
  });

  router.on('DELETE', '/api/groups/:id', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    await dbFile.withWrite((db) => deleteGroup(db, userId, params.id));
    sendNoContent(res);
  });

  router.on('PUT', '/api/folders/:id/groups/reorder', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : null;
    if (!orderedIds) throw new Error('orderedIds required');
    await dbFile.withWrite((db) => reorderGroupsInFolder(db, userId, params.id, orderedIds));
    sendNoContent(res);
  });

  router.on('PUT', '/api/groups/:id/move', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const folderId = String(body.folderId ?? '');
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : null;
    if (!orderedIds) throw new Error('orderedIds required');
    await dbFile.withWrite((db) => moveGroupToFolder(db, userId, params.id, folderId, orderedIds));
    sendNoContent(res);
  });

  // Bookmarks
  router.on('POST', '/api/bookmarks', async (req, res) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const groupId = String(body.groupId ?? '');
    const url = parseOrThrow(urlSchema, body.url);
    const title = parseOrThrow(titleSchema, body.title);
    const description = parseOrThrow(descriptionSchema, body.description ?? '');
    const tags = parseOrThrow(tagsSchema, body.tags ?? []);

    const bookmark = await dbFile.withWrite((db) => createBookmark(db, userId, groupId, { url, title, description, tags }));
    sendJson(res, 201, bookmark);
  });

  router.on('PUT', '/api/bookmarks/:id', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);

    const patch: any = {};
    if (body.url !== undefined) patch.url = parseOrThrow(urlSchema, body.url);
    if (body.title !== undefined) patch.title = parseOrThrow(titleSchema, body.title);
    if (body.description !== undefined) patch.description = parseOrThrow(descriptionSchema, body.description);
    if (body.tags !== undefined) patch.tags = parseOrThrow(tagsSchema, body.tags);

    const bookmark = await dbFile.withWrite((db) => updateBookmark(db, userId, params.id, patch));
    sendJson(res, 200, bookmark);
  });

  router.on('DELETE', '/api/bookmarks/:id', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    await dbFile.withWrite((db) => deleteBookmark(db, userId, params.id));
    sendNoContent(res);
  });

  router.on('PUT', '/api/groups/:id/bookmarks/reorder', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : null;
    if (!orderedIds) throw new Error('orderedIds required');
    await dbFile.withWrite((db) => reorderBookmarksInGroup(db, userId, params.id, orderedIds));
    sendNoContent(res);
  });

  router.on('PUT', '/api/bookmarks/:id/move', async (req, res, params) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    const groupId = String(body.groupId ?? '');
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map(String) : null;
    if (!orderedIds) throw new Error('orderedIds required');
    await dbFile.withWrite((db) => moveBookmarkToGroup(db, userId, params.id, groupId, orderedIds));
    sendNoContent(res);
  });

  // Import/Export
  router.on('GET', '/api/export', async (req, res) => {
    const userId = await requireUserId(dbFile, req);
    const state = await dbFile.withRead((db) => getState(db, userId));
    
    const html = exportToNetscape(state.workspaces, state.folders, state.groups, state.bookmarks);
    
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="bookmarks.html"');
    res.writeHead(200);
    res.end(html);
  });

  router.on('POST', '/api/import', async (req, res) => {
    const userId = await requireUserId(dbFile, req);
    const body = await readJson<any>(req);
    
    const html = parseOrThrow(importHtmlSchema, body.html);
    const strategy = body.strategy ? parseOrThrow(importStrategySchema, body.strategy) : 'flatten';
    
    const options: ImportOptions = {
      strategy,
      rootFolderName: typeof body.rootFolderName === 'string' 
        ? body.rootFolderName 
        : 'Imported Bookmarks'
    };

    const result = await dbFile.withWrite((db) => 
      importFromNetscape(db, userId, html, options)
    );

    sendJson(res, 200, result);
  });
}

async function requireUserId(dbFile: SqliteFileDb, req: IncomingMessage): Promise<string> {
  const sid = readSessionId(req);
  if (!sid) throw new Error('Not authenticated');
  const userId = await dbFile.withWrite((db) => getUserIdForSession(db, sid));
  if (!userId) throw new Error('Not authenticated');
  return userId;
}

async function requireMaybeUserId(dbFile: SqliteFileDb, req: IncomingMessage): Promise<string | null> {
  const sid = readSessionId(req);
  if (!sid) return null;
  return await dbFile.withWrite((db) => getUserIdForSession(db, sid));
}
