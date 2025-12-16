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

export interface Folder {
  id: Id;
  userId: Id;
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
  folders: Folder[];
  groups: Group[];
  bookmarks: Bookmark[];
}

export interface ApiErrorResponse {
  error: string;
}
