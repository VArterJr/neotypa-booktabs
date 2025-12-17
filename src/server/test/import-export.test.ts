import { describe, it, expect } from 'vitest';
import { exportToNetscape } from '../api/import-export.js';
import type { Folder, Group, Bookmark, Workspace } from '@app/shared';

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
});
