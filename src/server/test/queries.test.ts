import { describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';

import { SCHEMA_SQL } from '../db/schema.js';
import {
  createBookmark,
  createFolder,
  createGroup,
  createUser,
  getState,
  moveBookmarkToGroup,
  reorderBookmarksInGroup,
  reorderFolders,
  reorderGroupsInFolder,
  updateBookmark
} from '../db/queries.js';

async function makeDb() {
  const SQL = await initSqlJs({});
  const db = new SQL.Database();
  db.exec(SCHEMA_SQL);
  return db;
}

describe('db/queries', () => {
  it('creates a user with starter data', async () => {
    const db = await makeDb();
    const user = createUser(db, 'alice', 'pw');

    const state = getState(db, user.id);
    expect(state.folders.length).toBe(1);
    expect(state.groups.length).toBe(1);
    expect(state.bookmarks.length).toBe(0);
  });

  it('reorders folders and groups', async () => {
    const db = await makeDb();
    const user = createUser(db, 'bob', 'pw');
    const state = getState(db, user.id);
    const workspaceId = state.workspaces[0]!.id;

    const f1 = createFolder(db, user.id, workspaceId, 'A');
    const f2 = createFolder(db, user.id, workspaceId, 'B');

    reorderFolders(db, user.id, workspaceId, [f2.id, f1.id, ...getState(db, user.id).folders.filter(f => f.id !== f1.id && f.id !== f2.id).map(f => f.id)]);

    const state1 = getState(db, user.id);
    expect(state1.folders[0]!.id).toBe(f2.id);

    const g1 = createGroup(db, user.id, f1.id, 'G1');
    const g2 = createGroup(db, user.id, f1.id, 'G2');
    reorderGroupsInFolder(db, user.id, f1.id, [g2.id, g1.id, ...getState(db, user.id).groups.filter(g => g.folderId === f1.id && g.id !== g1.id && g.id !== g2.id).map(g => g.id)]);

    const state2 = getState(db, user.id);
    const gs = state2.groups.filter(g => g.folderId === f1.id);
    expect(gs[0]!.id).toBe(g2.id);
  });

  it('moves and reorders bookmarks with tags', async () => {
    const db = await makeDb();
    const user = createUser(db, 'cara', 'pw');
    const initialState = getState(db, user.id);
    const workspaceId = initialState.workspaces[0]!.id;

    const folder = createFolder(db, user.id, workspaceId, 'F');
    const g1 = createGroup(db, user.id, folder.id, 'G1');
    const g2 = createGroup(db, user.id, folder.id, 'G2');

    const b1 = createBookmark(db, user.id, g1.id, { url: 'https://example.com/1', title: 'One', description: '', tags: ['a', 'b'] });
    const b2 = createBookmark(db, user.id, g1.id, { url: 'https://example.com/2', title: 'Two', description: '', tags: ['b', 'c'] });

    reorderBookmarksInGroup(db, user.id, g1.id, [b2.id, b1.id]);
    let state = getState(db, user.id);
    expect(state.bookmarks.filter(b => b.groupId === g1.id)[0]!.id).toBe(b2.id);

    moveBookmarkToGroup(db, user.id, b1.id, g2.id, [b1.id]);
    state = getState(db, user.id);
    expect(state.bookmarks.find(b => b.id === b1.id)!.groupId).toBe(g2.id);

    const updated = updateBookmark(db, user.id, b2.id, { tags: ['x', 'y', 'x'] });
    expect(updated.tags.sort()).toEqual(['x', 'y']);
  });
});
