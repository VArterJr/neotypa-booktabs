import { randomUUID } from 'node:crypto';
import type { Database } from 'sql.js';
import type { AppState, Bookmark, Folder, Group, User, UserPreferences, ViewMode, Workspace } from '@app/shared';
import { all, nowIso, one, run } from './util.js';

/**
 * Find a user by username
 * Note: Returns the password hash for authentication purposes
 */
export function findUserByUsername(db: Database, username: string): { id: string; username: string; password: string; theme: string; view_mode: string; bookmark_view_mode: string; bookmarks_per_container: number } | null {
  const rows = all<any>(db, 'SELECT id, username, password, theme, view_mode, bookmark_view_mode, bookmarks_per_container FROM users WHERE username = ?', [username]);
  return rows[0] ?? null;
}

/**
 * Get user by ID without password hash
 */
export function getUserById(db: Database, userId: string): User | null {
  const rows = all<any>(db, 'SELECT id, username, theme, view_mode, bookmark_view_mode, bookmarks_per_container FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) return null;
  const u = one(rows);
  return {
    id: u.id,
    username: u.username,
    preferences: { 
      theme: u.theme, 
      viewMode: u.view_mode as ViewMode,
      bookmarkViewMode: u.bookmark_view_mode as any,
      bookmarksPerContainer: u.bookmarks_per_container
    }
  };
}

/**
 * Create a new user with starter folder and group
 * @param password Should be a hashed password
 */
export function createUser(db: Database, username: string, password: string): User {
  const id = randomUUID();
  const now = nowIso();
  run(db, 'INSERT INTO users (id, username, password, theme, view_mode, bookmark_view_mode, bookmarks_per_container, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    id,
    username,
    password,
    'light',
    'tabbed',
    'card',
    20,
    now
  ]);
  // Seed with a starter workspace, folder, and group so the UI isn't empty.
  const workspace = createWorkspace(db, id, 'Personal');
  const folder = createFolder(db, id, workspace.id, 'Main');
  createGroup(db, id, folder.id, 'Links');
  return one([getUserById(db, id)!]);
}

export function updatePreferences(db: Database, userId: string, patch: Partial<UserPreferences>): UserPreferences {
  const current = getUserById(db, userId);
  if (!current) throw new Error('User not found');
  const theme = patch.theme ?? current.preferences.theme;
  const viewMode = patch.viewMode ?? current.preferences.viewMode;
  const bookmarkViewMode = patch.bookmarkViewMode ?? current.preferences.bookmarkViewMode;
  const bookmarksPerContainer = patch.bookmarksPerContainer ?? current.preferences.bookmarksPerContainer;
  run(db, 'UPDATE users SET theme = ?, view_mode = ?, bookmark_view_mode = ?, bookmarks_per_container = ? WHERE id = ?', [theme, viewMode, bookmarkViewMode, bookmarksPerContainer, userId]);
  return { theme, viewMode, bookmarkViewMode, bookmarksPerContainer };
}

export function getState(db: Database, userId: string): AppState {
  const workspaces = all<any>(db, 'SELECT id, user_id, title, position FROM workspaces WHERE user_id = ? ORDER BY position ASC', [userId]).map(toWorkspace);
  const folders = all<any>(db, 'SELECT id, user_id, workspace_id, title, position FROM folders WHERE user_id = ? ORDER BY position ASC', [userId]).map(toFolder);
  const groups = all<any>(db, 'SELECT id, user_id, folder_id, title, position FROM groups WHERE user_id = ? ORDER BY position ASC', [userId]).map(toGroup);

  const bookmarksRaw = all<any>(
    db,
    'SELECT id, user_id, group_id, url, title, description, position FROM bookmarks WHERE user_id = ? ORDER BY position ASC',
    [userId]
  );

  const tagRows = all<any>(
    db,
    `SELECT bt.bookmark_id AS bookmark_id, t.name AS name
     FROM bookmark_tags bt
     JOIN tags t ON t.id = bt.tag_id
     JOIN bookmarks b ON b.id = bt.bookmark_id
     WHERE b.user_id = ?`,
    [userId]
  );

  const tagsByBookmark = new Map<string, string[]>();
  for (const r of tagRows) {
    const arr = tagsByBookmark.get(r.bookmark_id) ?? [];
    arr.push(r.name);
    tagsByBookmark.set(r.bookmark_id, arr);
  }

  const bookmarks: Bookmark[] = bookmarksRaw.map((b: any) => ({
    id: b.id,
    userId: b.user_id,
    groupId: b.group_id,
    url: b.url,
    title: b.title,
    description: b.description,
    position: b.position,
    tags: (tagsByBookmark.get(b.id) ?? []).sort((a, b2) => a.localeCompare(b2))
  }));

  return { workspaces, folders, groups, bookmarks };
}

// Workspaces
export function createWorkspace(db: Database, userId: string, title: string): Workspace {
  const id = randomUUID();
  const pos = nextPosition(db, 'workspaces', 'user_id', userId);
  run(db, 'INSERT INTO workspaces (id, user_id, title, position, created_at) VALUES (?, ?, ?, ?, ?)', [id, userId, title, pos, nowIso()]);
  return { id, userId, title, position: pos };
}

export function updateWorkspace(db: Database, userId: string, workspaceId: string, title: string): Workspace {
  mustOwn(db, 'workspaces', workspaceId, userId);
  run(db, 'UPDATE workspaces SET title = ? WHERE id = ?', [title, workspaceId]);
  const w = one(all<any>(db, 'SELECT id, user_id, title, position FROM workspaces WHERE id = ?', [workspaceId]));
  return toWorkspace(w);
}

export function deleteWorkspace(db: Database, userId: string, workspaceId: string): void {
  mustOwn(db, 'workspaces', workspaceId, userId);
  run(db, 'DELETE FROM workspaces WHERE id = ?', [workspaceId]);
}

export function reorderWorkspaces(db: Database, userId: string, orderedIds: string[]): void {
  const owned = new Set(all<any>(db, 'SELECT id FROM workspaces WHERE user_id = ?', [userId]).map((r: any) => r.id));
  if (orderedIds.length !== owned.size) throw new Error('orderedIds must include all workspaces');
  orderedIds.forEach((id) => {
    if (!owned.has(id)) throw new Error('Invalid workspace id');
  });
  orderedIds.forEach((id, idx) => run(db, 'UPDATE workspaces SET position = ? WHERE id = ?', [idx, id]));
}

// Folders
export function createFolder(db: Database, userId: string, workspaceId: string, title: string): Folder {
  mustOwn(db, 'workspaces', workspaceId, userId);
  const id = randomUUID();
  const pos = nextPosition(db, 'folders', 'workspace_id', workspaceId);
  run(db, 'INSERT INTO folders (id, user_id, workspace_id, title, position, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, userId, workspaceId, title, pos, nowIso()]);
  return { id, userId, workspaceId, title, position: pos };
}

export function updateFolder(db: Database, userId: string, folderId: string, title: string): Folder {
  mustOwn(db, 'folders', folderId, userId);
  run(db, 'UPDATE folders SET title = ? WHERE id = ?', [title, folderId]);
  const f = one(all<any>(db, 'SELECT id, user_id, workspace_id, title, position FROM folders WHERE id = ?', [folderId]));
  return toFolder(f);
}

export function deleteFolder(db: Database, userId: string, folderId: string): void {
  mustOwn(db, 'folders', folderId, userId);
  run(db, 'DELETE FROM folders WHERE id = ?', [folderId]);
}

export function reorderFolders(db: Database, userId: string, workspaceId: string, orderedIds: string[]): void {
  mustOwn(db, 'workspaces', workspaceId, userId);
  const owned = new Set(all<any>(db, 'SELECT id FROM folders WHERE user_id = ? AND workspace_id = ?', [userId, workspaceId]).map((r: any) => r.id));
  if (orderedIds.length !== owned.size) throw new Error('orderedIds must include all folders in workspace');
  orderedIds.forEach((id) => {
    if (!owned.has(id)) throw new Error('Invalid folder id');
  });
  orderedIds.forEach((id, idx) => run(db, 'UPDATE folders SET position = ? WHERE id = ?', [idx, id]));
}

export function moveFolderToWorkspace(db: Database, userId: string, folderId: string, workspaceId: string, orderedIds: string[]): void {
  mustOwn(db, 'folders', folderId, userId);
  mustOwn(db, 'workspaces', workspaceId, userId);

  run(db, 'UPDATE folders SET workspace_id = ? WHERE id = ?', [workspaceId, folderId]);
  // normalize ordering for target workspace
  reorderFolders(db, userId, workspaceId, orderedIds);
}

export function createGroup(db: Database, userId: string, folderId: string, title: string): Group {
  mustOwn(db, 'folders', folderId, userId);
  const id = randomUUID();
  const pos = nextPosition(db, 'groups', 'folder_id', folderId);
  run(db, 'INSERT INTO groups (id, user_id, folder_id, title, position, created_at) VALUES (?, ?, ?, ?, ?, ?)', [
    id,
    userId,
    folderId,
    title,
    pos,
    nowIso()
  ]);
  return { id, userId, folderId, title, position: pos };
}

export function updateGroup(db: Database, userId: string, groupId: string, title: string): Group {
  mustOwn(db, 'groups', groupId, userId);
  run(db, 'UPDATE groups SET title = ? WHERE id = ?', [title, groupId]);
  const g = one(all<any>(db, 'SELECT id, user_id, folder_id, title, position FROM groups WHERE id = ?', [groupId]));
  return toGroup(g);
}

export function deleteGroup(db: Database, userId: string, groupId: string): void {
  mustOwn(db, 'groups', groupId, userId);
  run(db, 'DELETE FROM groups WHERE id = ?', [groupId]);
}

export function reorderGroupsInFolder(db: Database, userId: string, folderId: string, orderedIds: string[]): void {
  mustOwn(db, 'folders', folderId, userId);
  const owned = new Set(all<any>(db, 'SELECT id FROM groups WHERE user_id = ? AND folder_id = ?', [userId, folderId]).map((r: any) => r.id));
  if (orderedIds.length !== owned.size) throw new Error('orderedIds must include all groups in folder');
  orderedIds.forEach((id) => {
    if (!owned.has(id)) throw new Error('Invalid group id');
  });
  orderedIds.forEach((id, idx) => run(db, 'UPDATE groups SET position = ? WHERE id = ?', [idx, id]));
}

export function moveGroupToFolder(db: Database, userId: string, groupId: string, folderId: string, orderedIds: string[]): void {
  mustOwn(db, 'groups', groupId, userId);
  mustOwn(db, 'folders', folderId, userId);

  run(db, 'UPDATE groups SET folder_id = ? WHERE id = ?', [folderId, groupId]);
  // normalize ordering for target folder
  reorderGroupsInFolder(db, userId, folderId, orderedIds);
}

export function createBookmark(
  db: Database,
  userId: string,
  groupId: string,
  data: { url: string; title: string; description: string; tags: string[] }
): Bookmark {
  mustOwn(db, 'groups', groupId, userId);
  const id = randomUUID();
  const pos = nextPosition(db, 'bookmarks', 'group_id', groupId);
  run(db, 'INSERT INTO bookmarks (id, user_id, group_id, url, title, description, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    id,
    userId,
    groupId,
    data.url,
    data.title,
    data.description,
    pos,
    nowIso()
  ]);
  setBookmarkTags(db, userId, id, data.tags);
  return { id, userId, groupId, url: data.url, title: data.title, description: data.description, tags: data.tags, position: pos };
}

export function updateBookmark(
  db: Database,
  userId: string,
  bookmarkId: string,
  patch: Partial<{ url: string; title: string; description: string; tags: string[] }>
): Bookmark {
  mustOwn(db, 'bookmarks', bookmarkId, userId);
  const current = one(all<any>(db, 'SELECT id, user_id, group_id, url, title, description, position FROM bookmarks WHERE id = ?', [bookmarkId]));
  const url = patch.url ?? current.url;
  const title = patch.title ?? current.title;
  const description = patch.description ?? current.description;
  run(db, 'UPDATE bookmarks SET url = ?, title = ?, description = ? WHERE id = ?', [url, title, description, bookmarkId]);
  if (patch.tags) setBookmarkTags(db, userId, bookmarkId, patch.tags);

  const tags = getBookmarkTags(db, bookmarkId);
  return { id: current.id, userId: current.user_id, groupId: current.group_id, url, title, description, tags, position: current.position };
}

export function deleteBookmark(db: Database, userId: string, bookmarkId: string): void {
  mustOwn(db, 'bookmarks', bookmarkId, userId);
  run(db, 'DELETE FROM bookmarks WHERE id = ?', [bookmarkId]);
}

export function reorderBookmarksInGroup(db: Database, userId: string, groupId: string, orderedIds: string[]): void {
  mustOwn(db, 'groups', groupId, userId);
  const owned = new Set(all<any>(db, 'SELECT id FROM bookmarks WHERE user_id = ? AND group_id = ?', [userId, groupId]).map((r: any) => r.id));
  if (orderedIds.length !== owned.size) throw new Error('orderedIds must include all bookmarks in group');
  orderedIds.forEach((id) => {
    if (!owned.has(id)) throw new Error('Invalid bookmark id');
  });
  orderedIds.forEach((id, idx) => run(db, 'UPDATE bookmarks SET position = ? WHERE id = ?', [idx, id]));
}

export function moveBookmarkToGroup(db: Database, userId: string, bookmarkId: string, groupId: string, orderedIds: string[]): void {
  mustOwn(db, 'bookmarks', bookmarkId, userId);
  mustOwn(db, 'groups', groupId, userId);
  run(db, 'UPDATE bookmarks SET group_id = ? WHERE id = ?', [groupId, bookmarkId]);
  reorderBookmarksInGroup(db, userId, groupId, orderedIds);
}

function nextPosition(db: Database, table: string, scopeCol: string, scopeVal: string): number {
  const rows = all<any>(db, `SELECT COALESCE(MAX(position), -1) AS max_pos FROM ${table} WHERE ${scopeCol} = ?`, [scopeVal]);
  return Number(rows[0]?.max_pos ?? -1) + 1;
}

function mustOwn(db: Database, table: string, id: string, userId: string): void {
  const rows = all<any>(db, `SELECT id FROM ${table} WHERE id = ? AND user_id = ?`, [id, userId]);
  if (rows.length === 0) throw new Error('Not found');
}

function toWorkspace(r: any): Workspace {
  return { id: r.id, userId: r.user_id, title: r.title, position: Number(r.position) };
}

function toFolder(r: any): Folder {
  return { id: r.id, userId: r.user_id, workspaceId: r.workspace_id, title: r.title, position: Number(r.position) };
}

function toGroup(r: any): Group {
  return { id: r.id, userId: r.user_id, folderId: r.folder_id, title: r.title, position: Number(r.position) };
}

function getBookmarkTags(db: Database, bookmarkId: string): string[] {
  return all<any>(
    db,
    `SELECT t.name AS name
     FROM bookmark_tags bt
     JOIN tags t ON t.id = bt.tag_id
     WHERE bt.bookmark_id = ?`,
    [bookmarkId]
  ).map((r: any) => r.name);
}

function setBookmarkTags(db: Database, userId: string, bookmarkId: string, tags: string[]): void {
  run(db, 'DELETE FROM bookmark_tags WHERE bookmark_id = ?', [bookmarkId]);
  const clean = Array.from(new Set(tags.map((t) => t.trim()).filter(Boolean))).slice(0, 50);
  for (const name of clean) {
    const tagId = ensureTag(db, userId, name);
    run(db, 'INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)', [bookmarkId, tagId]);
  }
}

function ensureTag(db: Database, userId: string, name: string): string {
  const existing = all<any>(db, 'SELECT id FROM tags WHERE user_id = ? AND name = ?', [userId, name]);
  if (existing.length > 0) return existing[0]!.id;
  const id = randomUUID();
  run(db, 'INSERT INTO tags (id, user_id, name, created_at) VALUES (?, ?, ?, ?)', [id, userId, name, nowIso()]);
  return id;
}
