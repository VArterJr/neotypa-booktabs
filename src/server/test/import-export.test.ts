import { describe, it, expect } from 'vitest';
import { exportToNetscape, exportToJson, importFromJson } from '../api/import-export.js';
import type { Folder, Group, Bookmark, Workspace, JsonExportFormat } from '@app/shared';
import initSqlJs from 'sql.js';
import type { Database } from 'sql.js';
import { SCHEMA_SQL } from '../db/schema.js';
import { all, run } from '../db/util.js';

describe('Import/Export', () => {
  describe('exportToNetscape', () => {
    it('should export bookmarks in Netscape format', () => {
      const workspaces: Workspace[] = [
        { id: 'w1', userId: 'u1', title: 'Personal', position: 0 }
      ];
      
      const folders: Folder[] = [
        { id: 'f1', userId: 'u1', workspaceId: 'w1', title: 'Work', position: 0 }
      ];
      
      const groups: Group[] = [
        { id: 'g1', userId: 'u1', folderId: 'f1', title: 'Dev Tools', position: 0 }
      ];
      
      const bookmarks: Bookmark[] = [
        {
          id: 'b1',
          userId: 'u1',
          groupId: 'g1',
          url: 'https://github.com',
          title: 'GitHub',
          description: 'Code hosting',
          tags: [],
          position: 0
        }
      ];

      const html = exportToNetscape(workspaces, folders, groups, bookmarks);

      expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
      expect(html).toContain('<H1>Bookmarks</H1>');
      expect(html).toContain('<H3>Personal</H3>');
      expect(html).toContain('<H3>Work</H3>');
      expect(html).toContain('<H3>Dev Tools</H3>');
      expect(html).toContain('HREF="https://github.com"');
      expect(html).toContain('>GitHub</A>');
      expect(html).toContain('<DD>Code hosting');
    });

    it('should escape HTML entities', () => {
      const workspaces: Workspace[] = [
        { id: 'w1', userId: 'u1', title: 'Test', position: 0 }
      ];
      
      const folders: Folder[] = [
        { id: 'f1', userId: 'u1', workspaceId: 'w1', title: 'Folder with <tag>', position: 0 }
      ];
      
      const groups: Group[] = [
        { id: 'g1', userId: 'u1', folderId: 'f1', title: 'Group & More', position: 0 }
      ];
      
      const bookmarks: Bookmark[] = [
        {
          id: 'b1',
          userId: 'u1',
          groupId: 'g1',
          url: 'https://example.com?param=value&other=2',
          title: 'Title "with quotes"',
          description: '',
          tags: [],
          position: 0
        }
      ];

      const html = exportToNetscape(workspaces, folders, groups, bookmarks);

      expect(html).toContain('&lt;tag&gt;');
      expect(html).toContain('&amp; More');
      expect(html).toContain('&amp;other=2');
      expect(html).toContain('&quot;with quotes&quot;');
    });

    it('should handle empty collections', () => {
      const html = exportToNetscape([], [], [], []);

      expect(html).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
      expect(html).toContain('<H1>Bookmarks</H1>');
      // Should have the basic structure but no folder/group/bookmark tags
      expect(html).not.toContain('<DT>');
    });

    it('should respect position ordering', () => {
      const workspaces: Workspace[] = [
        { id: 'w1', userId: 'u1', title: 'Workspace', position: 0 }
      ];
      
      const folders: Folder[] = [
        { id: 'f2', userId: 'u1', workspaceId: 'w1', title: 'Second', position: 1 },
        { id: 'f1', userId: 'u1', workspaceId: 'w1', title: 'First', position: 0 }
      ];
      
      const groups: Group[] = [
        { id: 'g2', userId: 'u1', folderId: 'f1', title: 'Group B', position: 1 },
        { id: 'g1', userId: 'u1', folderId: 'f1', title: 'Group A', position: 0 }
      ];
      
      const bookmarks: Bookmark[] = [
        {
          id: 'b2',
          userId: 'u1',
          groupId: 'g1',
          url: 'https://second.com',
          title: 'Second',
          description: '',
          tags: [],
          position: 1
        },
        {
          id: 'b1',
          userId: 'u1',
          groupId: 'g1',
          url: 'https://first.com',
          title: 'First',
          description: '',
          tags: [],
          position: 0
        }
      ];

      const html = exportToNetscape(workspaces, folders, groups, bookmarks);

      // Check that "First" appears before "Second" in each category
      const firstFolderIndex = html.indexOf('First</H3>');
      const secondFolderIndex = html.indexOf('Second</H3>');
      expect(firstFolderIndex).toBeLessThan(secondFolderIndex);

      const groupAIndex = html.indexOf('Group A</H3>');
      const groupBIndex = html.indexOf('Group B</H3>');
      expect(groupAIndex).toBeLessThan(groupBIndex);

      const firstBookmarkIndex = html.indexOf('>First</A>');
      const secondBookmarkIndex = html.indexOf('>Second</A>');
      expect(firstBookmarkIndex).toBeLessThan(secondBookmarkIndex);
    });
  });

  describe('exportToJson', () => {
    it('should export bookmarks to JSON format', () => {
      const workspaces: Workspace[] = [
        { id: 'w1', userId: 'u1', title: 'Personal', position: 0 }
      ];
      
      const folders: Folder[] = [
        { id: 'f1', userId: 'u1', workspaceId: 'w1', title: 'Work', position: 0 }
      ];
      
      const groups: Group[] = [
        { id: 'g1', userId: 'u1', folderId: 'f1', title: 'Dev Tools', position: 0 }
      ];
      
      const bookmarks: Bookmark[] = [
        {
          id: 'b1',
          userId: 'u1',
          groupId: 'g1',
          url: 'https://github.com',
          title: 'GitHub',
          description: 'Code hosting',
          tags: ['dev', 'code'],
          position: 0
        }
      ];

      const json = exportToJson(workspaces, folders, groups, bookmarks);

      expect(json.version).toBe(1);
      expect(json.exportedAt).toBeTruthy();
      expect(json.workspaces).toHaveLength(1);
      expect(json.workspaces[0].title).toBe('Personal');
      expect(json.workspaces[0].folders).toHaveLength(1);
      expect(json.workspaces[0].folders[0].title).toBe('Work');
      expect(json.workspaces[0].folders[0].groups).toHaveLength(1);
      expect(json.workspaces[0].folders[0].groups[0].title).toBe('Dev Tools');
      expect(json.workspaces[0].folders[0].groups[0].bookmarks).toHaveLength(1);
      expect(json.workspaces[0].folders[0].groups[0].bookmarks[0]).toEqual({
        url: 'https://github.com',
        title: 'GitHub',
        description: 'Code hosting',
        tags: ['dev', 'code'],
        position: 0
      });
    });

    it('should handle multiple workspaces with nested data', () => {
      const workspaces: Workspace[] = [
        { id: 'w1', userId: 'u1', title: 'Work', position: 0 },
        { id: 'w2', userId: 'u1', title: 'Personal', position: 1 }
      ];
      
      const folders: Folder[] = [
        { id: 'f1', userId: 'u1', workspaceId: 'w1', title: 'Projects', position: 0 },
        { id: 'f2', userId: 'u1', workspaceId: 'w2', title: 'Fun', position: 0 }
      ];
      
      const groups: Group[] = [
        { id: 'g1', userId: 'u1', folderId: 'f1', title: 'Client A', position: 0 },
        { id: 'g2', userId: 'u1', folderId: 'f2', title: 'Games', position: 0 }
      ];
      
      const bookmarks: Bookmark[] = [
        {
          id: 'b1',
          userId: 'u1',
          groupId: 'g1',
          url: 'https://client-a.com',
          title: 'Client A Site',
          description: '',
          tags: [],
          position: 0
        },
        {
          id: 'b2',
          userId: 'u1',
          groupId: 'g2',
          url: 'https://game.com',
          title: 'Game',
          description: 'Fun game',
          tags: ['game', 'entertainment'],
          position: 0
        }
      ];

      const json = exportToJson(workspaces, folders, groups, bookmarks);

      expect(json.workspaces).toHaveLength(2);
      expect(json.workspaces[0].title).toBe('Work');
      expect(json.workspaces[1].title).toBe('Personal');
      expect(json.workspaces[0].folders[0].groups[0].bookmarks[0].title).toBe('Client A Site');
      expect(json.workspaces[1].folders[0].groups[0].bookmarks[0].title).toBe('Game');
      expect(json.workspaces[1].folders[0].groups[0].bookmarks[0].tags).toEqual(['game', 'entertainment']);
    });

    it('should respect position ordering', () => {
      const workspaces: Workspace[] = [
        { id: 'w1', userId: 'u1', title: 'Second', position: 1 },
        { id: 'w2', userId: 'u1', title: 'First', position: 0 }
      ];
      
      const folders: Folder[] = [
        { id: 'f1', userId: 'u1', workspaceId: 'w2', title: 'Folder B', position: 1 },
        { id: 'f2', userId: 'u1', workspaceId: 'w2', title: 'Folder A', position: 0 }
      ];
      
      const groups: Group[] = [
        { id: 'g1', userId: 'u1', folderId: 'f2', title: 'Group 2', position: 1 },
        { id: 'g2', userId: 'u1', folderId: 'f2', title: 'Group 1', position: 0 }
      ];
      
      const bookmarks: Bookmark[] = [
        {
          id: 'b1',
          userId: 'u1',
          groupId: 'g2',
          url: 'https://second.com',
          title: 'Second',
          description: '',
          tags: [],
          position: 1
        },
        {
          id: 'b2',
          userId: 'u1',
          groupId: 'g2',
          url: 'https://first.com',
          title: 'First',
          description: '',
          tags: [],
          position: 0
        }
      ];

      const json = exportToJson(workspaces, folders, groups, bookmarks);

      expect(json.workspaces[0].title).toBe('First');
      expect(json.workspaces[1].title).toBe('Second');
      expect(json.workspaces[0].folders[0].title).toBe('Folder A');
      expect(json.workspaces[0].folders[1].title).toBe('Folder B');
      expect(json.workspaces[0].folders[0].groups[0].title).toBe('Group 1');
      expect(json.workspaces[0].folders[0].groups[1].title).toBe('Group 2');
      expect(json.workspaces[0].folders[0].groups[0].bookmarks[0].title).toBe('First');
      expect(json.workspaces[0].folders[0].groups[0].bookmarks[1].title).toBe('Second');
    });

    it('should handle empty collections', () => {
      const json = exportToJson([], [], [], []);

      expect(json.version).toBe(1);
      expect(json.workspaces).toEqual([]);
    });
  });

  describe('importFromJson', () => {
    async function createTestDb(): Promise<Database> {
      const SQL = await initSqlJs();
      const db = new SQL.Database();
      db.exec(SCHEMA_SQL);
      // Create a test user
      run(db, `INSERT INTO users (id, username, password, theme, view_mode, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`, ['test-user', 'testuser', 'hashedpass', 'light', 'tabbed']);
      return db;
    }

    it('should import JSON data correctly', async () => {
      const db = await createTestDb();
      const userId = 'test-user';

      const jsonData: JsonExportFormat = {
        version: 1,
        exportedAt: new Date().toISOString(),
        workspaces: [
          {
            title: 'Personal',
            position: 0,
            folders: [
              {
                title: 'Work',
                position: 0,
                groups: [
                  {
                    title: 'Dev Tools',
                    position: 0,
                    bookmarks: [
                      {
                        url: 'https://github.com',
                        title: 'GitHub',
                        description: 'Code hosting',
                        tags: ['dev', 'code'],
                        position: 0
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const result = await importFromJson(db, userId, jsonData);

      expect(result.foldersCreated).toBe(1);
      expect(result.groupsCreated).toBe(1);
      expect(result.bookmarksCreated).toBe(1);
      expect(result.bookmarksSkipped).toBe(0);
      expect(result.warnings).toEqual([]);

      // Verify data was created
      const workspaces = all<any>(db, 'SELECT * FROM workspaces WHERE user_id = ?', [userId]);
      expect(workspaces).toHaveLength(1);

      const folders = all<any>(db, 'SELECT * FROM folders WHERE user_id = ?', [userId]);
      expect(folders).toHaveLength(1);

      const groups = all<any>(db, 'SELECT * FROM groups WHERE user_id = ?', [userId]);
      expect(groups).toHaveLength(1);

      const bookmarks = all<any>(db, 'SELECT * FROM bookmarks WHERE user_id = ?', [userId]);
      expect(bookmarks).toHaveLength(1);
    });

    it('should import multiple workspaces', async () => {
      const db = await createTestDb();
      const userId = 'test-user';

      const jsonData: JsonExportFormat = {
        version: 1,
        exportedAt: new Date().toISOString(),
        workspaces: [
          {
            title: 'Work',
            position: 0,
            folders: [
              {
                title: 'Projects',
                position: 0,
                groups: [
                  {
                    title: 'Client A',
                    position: 0,
                    bookmarks: []
                  }
                ]
              }
            ]
          },
          {
            title: 'Personal',
            position: 1,
            folders: [
              {
                title: 'Hobbies',
                position: 0,
                groups: [
                  {
                    title: 'Reading',
                    position: 0,
                    bookmarks: [
                      {
                        url: 'https://example.com',
                        title: 'Example',
                        description: 'Test',
                        tags: ['test'],
                        position: 0
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      const result = await importFromJson(db, userId, jsonData);

      expect(result.foldersCreated).toBe(2);
      expect(result.groupsCreated).toBe(2);
      expect(result.bookmarksCreated).toBe(1);

      const workspaces = all<any>(db, 'SELECT * FROM workspaces WHERE user_id = ?', [userId]);
      expect(workspaces).toHaveLength(2);
    });

    it('should reject unsupported version', async () => {
      const db = await createTestDb();
      const userId = 'test-user';

      const jsonData: any = {
        version: 999,
        exportedAt: new Date().toISOString(),
        workspaces: []
      };

      await expect(importFromJson(db, userId, jsonData)).rejects.toThrow('Unsupported JSON export version');
    });

    it('should handle tags correctly', async () => {
      const db = await createTestDb();
      const userId = 'test-user';

      const jsonData: JsonExportFormat = {
        version: 1,
        exportedAt: new Date().toISOString(),
        workspaces: [
          {
            title: 'Test',
            position: 0,
            folders: [
              {
                title: 'Test Folder',
                position: 0,
                groups: [
                  {
                    title: 'Test Group',
                    position: 0,
                    bookmarks: [
                      {
                        url: 'https://example.com',
                        title: 'Example',
                        description: '',
                        tags: ['tag1', 'tag2', 'tag3'],
                        position: 0
                      }
                    ]
                  }
                ]
              }
            ]
          }
        ]
      };

      await importFromJson(db, userId, jsonData);

      const tags = all<any>(db, 'SELECT * FROM tags WHERE user_id = ?', [userId]);
      expect(tags).toHaveLength(3);

      const bookmarkTags = all<any>(db, 'SELECT * FROM bookmark_tags');
      expect(bookmarkTags).toHaveLength(3);
    });
  });
});
