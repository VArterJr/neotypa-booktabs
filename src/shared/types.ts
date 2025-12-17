export type ViewMode = 'tabbed' | 'hierarchical';
export type BookmarkViewMode = 'grid' | 'cloud' | 'card' | 'list';

export type Id = string;

export interface UserPreferences {
  theme: string;
  viewMode: ViewMode;
  bookmarkViewMode: BookmarkViewMode;
  bookmarksPerContainer: number;
}

export interface User {
  id: Id;
  username: string;
  preferences: UserPreferences;
}

export interface Workspace {
  id: Id;
  userId: Id;
  title: string;
  position: number;
}

export interface Folder {
  id: Id;
  userId: Id;
  workspaceId: Id;
  title: string;
  position: number;
}

export interface Group {
  id: Id;
  userId: Id;
  folderId: Id;
  title: string;
  position: number;
}

export interface Bookmark {
  id: Id;
  userId: Id;
  groupId: Id;
  url: string;
  title: string;
  description: string;
  tags: string[];
  position: number;
}

export interface AppState {
  workspaces: Workspace[];
  folders: Folder[];
  groups: Group[];
  bookmarks: Bookmark[];
}

export interface ApiErrorResponse {
  error: string;
}

export type ImportStrategy = 'flatten' | 'skip' | 'root';

export interface ImportResult {
  foldersCreated: number;
  groupsCreated: number;
  bookmarksCreated: number;
  bookmarksSkipped: number;
  warnings: string[];
}

/**
 * JSON export format that preserves the full hierarchy and all data
 */
export interface JsonExportFormat {
  version: number;
  exportedAt: string;
  workspaces: JsonWorkspace[];
}

export interface JsonWorkspace {
  title: string;
  position: number;
  folders: JsonFolder[];
}

export interface JsonFolder {
  title: string;
  position: number;
  groups: JsonGroup[];
}

export interface JsonGroup {
  title: string;
  position: number;
  bookmarks: JsonBookmark[];
}

export interface JsonBookmark {
  url: string;
  title: string;
  description: string;
  tags: string[];
  position: number;
}
