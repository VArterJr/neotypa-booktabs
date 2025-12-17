/**
 * Import/Export utilities for Netscape Bookmark Format
 * 
 * Netscape format is an HTML-based format used by most browsers.
 * Our system has a 3-level hierarchy: Folder → Group → Bookmark
 * 
 * Import strategies for deeper nesting:
 * - 'flatten': All nested folders beyond depth 2 become groups
 * - 'skip': Skip bookmarks in folders deeper than supported depth
 * - 'root': Place deeper bookmarks in a root-level folder
 */

import type { Bookmark, Folder, Group, Workspace } from '@app/shared';
import type { JsonExportFormat, JsonWorkspace, JsonFolder, JsonGroup, JsonBookmark } from '@app/shared';
import type { Database } from 'sql.js';
import { createFolder, createGroup, createBookmark, createWorkspace } from '../db/queries.js';
import { all } from '../db/util.js';

export type ImportStrategy = 'flatten' | 'skip' | 'root';

export interface ImportOptions {
  strategy: ImportStrategy;
  rootFolderName?: string; // Used when strategy is 'root'
}

export interface ImportResult {
  foldersCreated: number;
  groupsCreated: number;
  bookmarksCreated: number;
  bookmarksSkipped: number;
  warnings: string[];
}

interface ParsedFolder {
  title: string;
  children: (ParsedFolder | ParsedBookmark)[];
  isPage?: boolean;      // Start.me PAGE attribute
  isTabBook?: boolean;   // Start.me BOOKMARKS attribute
}

interface ParsedBookmark {
  url: string;
  title: string;
  addDate?: number;
  icon?: string;
}

/**
 * Export bookmarks to Netscape format
 */
export function exportToNetscape(
  workspaces: Workspace[],
  folders: Folder[],
  groups: Group[],
  bookmarks: Bookmark[]
): string {
  const lines: string[] = [];
  
  lines.push('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
  lines.push('<!-- This is an automatically generated file.');
  lines.push('     It will be read and overwritten.');
  lines.push('     DO NOT EDIT! -->');
  lines.push('<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">');
  lines.push('<TITLE>Bookmarks</TITLE>');
  lines.push('<H1>Bookmarks</H1>');
  lines.push('<DL><p>');

  // Sort workspaces by position
  const sortedWorkspaces = [...workspaces].sort((a, b) => a.position - b.position);

  for (const workspace of sortedWorkspaces) {
    const workspaceFolders = folders
      .filter(f => f.workspaceId === workspace.id)
      .sort((a, b) => a.position - b.position);

    lines.push(`    <DT><H3>${escapeHtml(workspace.title)}</H3>`);
    lines.push('    <DL><p>');

    for (const folder of workspaceFolders) {
      const folderGroups = groups
        .filter(g => g.folderId === folder.id)
        .sort((a, b) => a.position - b.position);

      lines.push(`        <DT><H3>${escapeHtml(folder.title)}</H3>`);
      lines.push('        <DL><p>');

      for (const group of folderGroups) {
        const groupBookmarks = bookmarks
          .filter(b => b.groupId === group.id)
          .sort((a, b) => a.position - b.position);

        lines.push(`            <DT><H3>${escapeHtml(group.title)}</H3>`);
        lines.push('            <DL><p>');

        for (const bookmark of groupBookmarks) {
          const attrs: string[] = [
            `HREF="${escapeHtml(bookmark.url)}"`,
          ];
          
          lines.push(`                <DT><A ${attrs.join(' ')}>${escapeHtml(bookmark.title)}</A>`);
          
          if (bookmark.description) {
            lines.push(`                <DD>${escapeHtml(bookmark.description)}`);
          }
        }

        lines.push('            </DL><p>');
      }

      lines.push('        </DL><p>');
    }

    lines.push('    </DL><p>');
  }

  lines.push('</DL><p>');
  
  return lines.join('\n');
}

/**
 * Import bookmarks from Netscape format
 */
export async function importFromNetscape(
  db: Database,
  userId: string,
  html: string,
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    foldersCreated: 0,
    groupsCreated: 0,
    bookmarksCreated: 0,
    bookmarksSkipped: 0,
    warnings: []
  };

  const parsed = parseNetscapeHtml(html);
  
  // Ensure there's a default workspace for import
  const workspace = ensureDefaultWorkspace(db, userId);
  
  await processImportStructure(db, userId, workspace.id, parsed, options, result, 0);

  return result;
}

/**
 * Parse Netscape HTML into a tree structure
 */
function parseNetscapeHtml(html: string): (ParsedFolder | ParsedBookmark)[] {
  const items: (ParsedFolder | ParsedBookmark)[] = [];
  
  // Remove comments and normalize whitespace
  let content = html.replace(/<!--[\s\S]*?-->/g, '');
  
  // Find the main DL tag
  const mainDlMatch = content.match(/<DL[^>]*>([\s\S]*)<\/DL>/i);
  if (!mainDlMatch) {
    return items;
  }
  
  content = mainDlMatch[1];
  
  return parseDlContent(content);
}

/**
 * Parse the content of a DL (definition list) tag
 */
function parseDlContent(content: string): (ParsedFolder | ParsedBookmark)[] {
  const items: (ParsedFolder | ParsedBookmark)[] = [];
  let pos = 0;
  
  while (pos < content.length) {
    // Look for <DT> tags
    const dtMatch = content.slice(pos).match(/<DT[^>]*>/i);
    if (!dtMatch) break;
    
    pos += dtMatch.index! + dtMatch[0].length;
    
    // Check if it's a folder (H3) or bookmark (A)
    const h3Match = content.slice(pos).match(/<H3([^>]*)>(.*?)<\/H3>/i);
    const aMatch = content.slice(pos).match(/<A\s+([^>]*)>(.*?)<\/A>/i);
    
    if (h3Match) {
      const h3Attrs = h3Match[1];
      const title = decodeHtml(h3Match[2]);
      pos += h3Match[0].length;
      
      // Check for Start.me-specific attributes
      const isPage = /PAGE\s*=\s*["']true["']/i.test(h3Attrs);
      const isTabBook = /BOOKMARKS\s*=\s*["']true["']/i.test(h3Attrs);
      
      // Look for nested DL - must manually match to handle nesting
      let children: (ParsedFolder | ParsedBookmark)[] = [];
      const dlStart = content.slice(pos).match(/<DL[^>]*>/i);
      
      if (dlStart) {
        const dlStartPos = pos + dlStart.index!;
        const dlContentStart = dlStartPos + dlStart[0].length;
        
        // Find matching closing </DL> by counting nesting levels
        let depth = 1;
        let searchPos = dlContentStart;
        let dlEndPos = -1;
        
        while (searchPos < content.length && depth > 0) {
          const nextOpen = content.slice(searchPos).search(/<DL[^>]*>/i);
          const nextClose = content.slice(searchPos).search(/<\/DL>/i);
          
          if (nextClose === -1) break; // No more closing tags
          
          if (nextOpen !== -1 && nextOpen < nextClose) {
            // Opening tag comes first
            depth++;
            searchPos += nextOpen + 3; // Move past "<DL"
          } else {
            // Closing tag comes first
            depth--;
            if (depth === 0) {
              dlEndPos = searchPos + nextClose;
              break;
            }
            searchPos += nextClose + 5; // Move past "</DL>"
          }
        }
        
        if (dlEndPos !== -1) {
          const dlContent = content.substring(dlContentStart, dlEndPos);
          children = parseDlContent(dlContent);
          pos = dlEndPos + 5; // Move past "</DL>"
        } else {
          pos = dlContentStart;
        }
      }
      
      items.push({ title, children, isPage, isTabBook });
    } else if (aMatch) {
      const attrs = aMatch[1];
      const title = decodeHtml(aMatch[2]);
      
      const hrefMatch = attrs.match(/HREF\s*=\s*["']([^"']+)["']/i);
      if (hrefMatch) {
        const url = decodeHtml(hrefMatch[1]);
        
        // Check for ADD_DATE
        const addDateMatch = attrs.match(/ADD_DATE\s*=\s*["']?(\d+)["']?/i);
        const addDate = addDateMatch ? parseInt(addDateMatch[1], 10) : undefined;
        
        items.push({ url, title, addDate });
      }
      
      pos += aMatch[0].length;
      
      // Check for description (DD tag)
      const ddMatch = content.slice(pos).match(/<DD[^>]*>(.*?)(?=<DT|<\/DL|$)/is);
      if (ddMatch) {
        // Note: We could store description but our current structure doesn't support it at folder level
        pos += ddMatch[0].length;
      }
    } else {
      // Skip to next position
      pos++;
    }
  }
  
  return items;
}

/**
 * Process the parsed structure and insert into database
 */
async function processImportStructure(
  db: Database,
  userId: string,
  workspaceId: string,
  items: (ParsedFolder | ParsedBookmark)[],
  options: ImportOptions,
  result: ImportResult,
  depth: number
): Promise<void> {
  // Simple flat import:
  // - Items with BOOKMARKS="true" become Folders
  // - H3 items under those become Groups
  // - Bookmarks go into their Groups
  // If no BOOKMARKS attribute, treat H3 as folders, nested H3 as groups
  
  for (const item of items) {
    if ('url' in item) {
      // Bookmark at root level - skip with warning
      result.warnings.push(`Bookmark "${item.title}" at root level, skipping`);
      result.bookmarksSkipped++;
      continue;
    }

    // Skip PAGE="true" containers - just process their children
    if (item.isPage) {
      await processImportStructure(db, userId, workspaceId, item.children, options, result, depth + 1);
      continue;
    }

    // If this has BOOKMARKS="true", it's a folder/tab book
    if (item.isTabBook) {
      const folder = createFolder(db, userId, workspaceId, item.title);
      result.foldersCreated++;
      
      // All H3 children are groups
      for (const child of item.children) {
        if ('url' in child) {
          // Bookmark directly under folder - put in "Unsorted" group
          let group = tryGetOrCreateGroup(db, userId, folder.id, 'Unsorted', result);
          try {
            createBookmark(db, userId, group.id, {
              url: child.url,
              title: child.title || child.url,
              description: '',
              tags: []
            });
            result.bookmarksCreated++;
          } catch (err) {
            result.warnings.push(`Failed to import bookmark "${child.title}": ${err}`);
            result.bookmarksSkipped++;
          }
        } else {
          // H3 under tab book = group
          const group = createGroup(db, userId, folder.id, child.title);
          result.groupsCreated++;
          
          // Add all bookmarks from this group
          await addBookmarksToGroup(db, userId, group.id, child.children, options, result);
        }
      }
    } else {
      // No special attributes - treat as folder, children as groups
      const folder = createFolder(db, userId, workspaceId, item.title);
      result.foldersCreated++;
      
      await processFolderChildren(db, userId, folder.id, item.children, options, result);
    }
  }
}

/**
 * Add bookmarks and nested content to a group
 */
async function addBookmarksToGroup(
  db: Database,
  userId: string,
  groupId: string,
  items: (ParsedFolder | ParsedBookmark)[],
  options: ImportOptions,
  result: ImportResult
): Promise<void> {
  for (const item of items) {
    if ('url' in item) {
      // Direct bookmark
      try {
        createBookmark(db, userId, groupId, {
          url: item.url,
          title: item.title || item.url,
          description: '',
          tags: []
        });
        result.bookmarksCreated++;
      } catch (err) {
        result.warnings.push(`Failed to import bookmark "${item.title}": ${err}`);
        result.bookmarksSkipped++;
      }
    } else {
      // Nested folder - flatten bookmarks based on strategy
      if (options.strategy === 'flatten') {
        const bookmarks = flattenBookmarks(item);
        for (const bookmark of bookmarks) {
          try {
            createBookmark(db, userId, groupId, {
              url: bookmark.url,
              title: bookmark.title || bookmark.url,
              description: '',
              tags: []
            });
            result.bookmarksCreated++;
          } catch (err) {
            result.warnings.push(`Failed to import bookmark "${bookmark.title}": ${err}`);
            result.bookmarksSkipped++;
          }
        }
      } else if (options.strategy === 'skip') {
        const count = countBookmarks(item);
        result.bookmarksSkipped += count;
        result.warnings.push(`Skipped ${count} bookmarks in nested folder "${item.title}"`);
      }
    }
  }
}

/**
 * Process children of a folder - convert to groups and bookmarks
 */
async function processFolderChildren(
  db: Database,
  userId: string,
  folderId: string,
  items: (ParsedFolder | ParsedBookmark)[],
  options: ImportOptions,
  result: ImportResult
): Promise<void> {
  for (const item of items) {
    if ('url' in item) {
      // Bookmark directly under folder - create a default "Unsorted" group
      let group = tryGetOrCreateGroup(db, userId, folderId, 'Unsorted', result);
      try {
        createBookmark(db, userId, group.id, {
          url: item.url,
          title: item.title || item.url,
          description: '',
          tags: []
        });
        result.bookmarksCreated++;
      } catch (err) {
        result.warnings.push(`Failed to import bookmark "${item.title}": ${err}`);
        result.bookmarksSkipped++;
      }
    } else {
      // It's a folder - treat as a group
      const group = createGroup(db, userId, folderId, item.title);
      result.groupsCreated++;

      // Add all bookmarks from this group
      await addBookmarksToGroup(db, userId, group.id, item.children, options, result);
    }
  }
}

/**
 * Get or create a group with the given name
 */
function tryGetOrCreateGroup(
  db: Database,
  userId: string,
  folderId: string,
  groupName: string,
  result: ImportResult
): Group {
  // Check if group already exists
  const existing = all<any>(
    db,
    'SELECT id, user_id, folder_id, title, position FROM groups WHERE user_id = ? AND folder_id = ? AND title = ?',
    [userId, folderId, groupName]
  );
  
  if (existing.length > 0) {
    const r = existing[0];
    return { id: r.id, userId: r.user_id, folderId: r.folder_id, title: r.title, position: Number(r.position) };
  }
  
  // Create new group
  const group = createGroup(db, userId, folderId, groupName);
  result.groupsCreated++;
  return group;
}

/**
 * Flatten all bookmarks from a folder tree
 */
function flattenBookmarks(folder: ParsedFolder): ParsedBookmark[] {
  const bookmarks: ParsedBookmark[] = [];
  
  for (const child of folder.children) {
    if ('url' in child) {
      bookmarks.push(child);
    } else {
      bookmarks.push(...flattenBookmarks(child));
    }
  }
  
  return bookmarks;
}

/**
 * Count total bookmarks in a folder tree
 */
function countBookmarks(folder: ParsedFolder): number {
  let count = 0;
  
  for (const child of folder.children) {
    if ('url' in child) {
      count++;
    } else {
      count += countBookmarks(child);
    }
  }
  
  return count;
}

/**
 * Escape HTML entities for output
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Decode HTML entities from input
 */
function decodeHtml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

/**
 * Get or create a default workspace for importing
 */
function ensureDefaultWorkspace(db: Database, userId: string): Workspace {
  const existing = all<any>(db, 'SELECT id, user_id, title, position FROM workspaces WHERE user_id = ? ORDER BY position ASC LIMIT 1', [userId]);
  if (existing.length > 0) {
    return {
      id: existing[0].id,
      userId: existing[0].user_id,
      title: existing[0].title,
      position: existing[0].position
    };
  }
  // No workspace exists, create a default one
  return createWorkspace(db, userId, 'Imported');
}

/**
 * Export all user data to JSON format with full hierarchy
 */
export function exportToJson(
  workspaces: Workspace[],
  folders: Folder[],
  groups: Group[],
  bookmarks: Bookmark[]
): JsonExportFormat {
  // Sort workspaces by position
  const sortedWorkspaces = [...workspaces].sort((a, b) => a.position - b.position);

  const jsonWorkspaces: JsonWorkspace[] = sortedWorkspaces.map((workspace) => {
    const workspaceFolders = folders
      .filter((f) => f.workspaceId === workspace.id)
      .sort((a, b) => a.position - b.position);

    const jsonFolders: JsonFolder[] = workspaceFolders.map((folder) => {
      const folderGroups = groups
        .filter((g) => g.folderId === folder.id)
        .sort((a, b) => a.position - b.position);

      const jsonGroups: JsonGroup[] = folderGroups.map((group) => {
        const groupBookmarks = bookmarks
          .filter((b) => b.groupId === group.id)
          .sort((a, b) => a.position - b.position);

        const jsonBookmarks: JsonBookmark[] = groupBookmarks.map((bookmark) => ({
          url: bookmark.url,
          title: bookmark.title,
          description: bookmark.description,
          tags: bookmark.tags,
          position: bookmark.position,
        }));

        return {
          title: group.title,
          position: group.position,
          bookmarks: jsonBookmarks,
        };
      });

      return {
        title: folder.title,
        position: folder.position,
        groups: jsonGroups,
      };
    });

    return {
      title: workspace.title,
      position: workspace.position,
      folders: jsonFolders,
    };
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    workspaces: jsonWorkspaces,
  };
}

/**
 * Import data from JSON format
 */
export async function importFromJson(
  db: Database,
  userId: string,
  data: JsonExportFormat
): Promise<ImportResult> {
  const result: ImportResult = {
    foldersCreated: 0,
    groupsCreated: 0,
    bookmarksCreated: 0,
    bookmarksSkipped: 0,
    warnings: [],
  };

  // Validate version
  if (data.version !== 1) {
    throw new Error(`Unsupported JSON export version: ${data.version}`);
  }

  // Import each workspace
  for (const jsonWorkspace of data.workspaces) {
    // Create workspace
    const workspace = createWorkspace(db, userId, jsonWorkspace.title);

    // Import folders
    for (const jsonFolder of jsonWorkspace.folders) {
      const folder = createFolder(db, userId, workspace.id, jsonFolder.title);
      result.foldersCreated++;

      // Import groups
      for (const jsonGroup of jsonFolder.groups) {
        const group = createGroup(db, userId, folder.id, jsonGroup.title);
        result.groupsCreated++;

        // Import bookmarks
        for (const jsonBookmark of jsonGroup.bookmarks) {
          try {
            createBookmark(db, userId, group.id, {
              url: jsonBookmark.url,
              title: jsonBookmark.title,
              description: jsonBookmark.description,
              tags: jsonBookmark.tags,
            });
            result.bookmarksCreated++;
          } catch (err) {
            result.warnings.push(
              `Failed to import bookmark "${jsonBookmark.title}": ${err instanceof Error ? err.message : String(err)}`
            );
            result.bookmarksSkipped++;
          }
        }
      }
    }
  }

  return result;
}
