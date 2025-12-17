export type ViewMode = 'tabbed' | 'hierarchical';

export type Id = string;

export interface UserPreferences {
  theme: string;
  viewMode: ViewMode;
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
