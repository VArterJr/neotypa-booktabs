import type { AppState, Bookmark, Folder, Group, User, UserPreferences, ViewMode, Workspace } from '@app/shared';
import { apiFetch } from '../api/http';

export interface StoreState {
  user: User | null;
  app: AppState;
  selectedWorkspaceId: string | null;
  selectedFolderId: string | null;
  selectedGroupId: string | null;
  loading: boolean;
  error: string | null;
}

type Listener = (state: StoreState) => void;

export class AppStore {
  private state: StoreState;
  private listeners = new Set<Listener>();

  constructor() {
    this.state = {
      user: null,
      app: { workspaces: [], folders: [], groups: [], bookmarks: [] },
      selectedWorkspaceId: null,
      selectedFolderId: null,
      selectedGroupId: null,
      loading: false,
      error: null
    };
  }

  get(): StoreState {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private set(patch: Partial<StoreState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  async bootstrap(): Promise<void> {
    this.set({ loading: true, error: null });
    try {
      const me = await apiFetch<User | null>('/api/me', { method: 'GET' });
      this.set({ user: me });
      if (me) await this.refreshState();
    } catch (e) {
      this.set({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      this.set({ loading: false });
    }
  }

  async refreshState(): Promise<void> {
    const app = await apiFetch<AppState>('/api/state', { method: 'GET' });
    let selectedWorkspaceId = this.state.selectedWorkspaceId;
    let selectedFolderId = this.state.selectedFolderId;
    let selectedGroupId = this.state.selectedGroupId;

    // Select first workspace if current not found
    if (!selectedWorkspaceId || !app.workspaces.some(w => w.id === selectedWorkspaceId)) {
      selectedWorkspaceId = app.workspaces[0]?.id ?? null;
    }

    // Select first folder in workspace if current not found
    const foldersInWorkspace = selectedWorkspaceId ? app.folders.filter(f => f.workspaceId === selectedWorkspaceId) : [];
    if (!selectedFolderId || !foldersInWorkspace.some(f => f.id === selectedFolderId)) {
      selectedFolderId = foldersInWorkspace[0]?.id ?? null;
    }

    // Select first group in folder if current not found
    const groupsForFolder = selectedFolderId ? app.groups.filter(g => g.folderId === selectedFolderId) : [];
    if (!selectedGroupId || !groupsForFolder.some(g => g.id === selectedGroupId)) {
      selectedGroupId = groupsForFolder[0]?.id ?? null;
    }

    this.set({ app, selectedWorkspaceId, selectedFolderId, selectedGroupId });
  }

  selectFolder(folderId: string): void {
    const folder = this.state.app.folders.find((f) => f.id === folderId);
    if (!folder) return;
    const groupsForFolder = this.state.app.groups.filter((g) => g.folderId === folderId);
    const selectedGroupId = groupsForFolder[0]?.id ?? null;
    this.set({ selectedWorkspaceId: folder.workspaceId, selectedFolderId: folderId, selectedGroupId });
  }

  selectGroup(groupId: string): void {
    const group = this.state.app.groups.find((g) => g.id === groupId);
    if (!group) return;
    const folder = this.state.app.folders.find((f) => f.id === group.folderId);
    if (!folder) return;
    this.set({ selectedWorkspaceId: folder.workspaceId, selectedFolderId: group.folderId, selectedGroupId: groupId });
  }

  selectWorkspace(workspaceId: string): void {
    const workspaceExists = this.state.app.workspaces.some((w) => w.id === workspaceId);
    if (!workspaceExists) return;
    const foldersInWorkspace = this.state.app.folders.filter((f) => f.workspaceId === workspaceId);
    const selectedFolderId = foldersInWorkspace[0]?.id ?? null;
    const groupsForFolder = selectedFolderId ? this.state.app.groups.filter((g) => g.folderId === selectedFolderId) : [];
    const selectedGroupId = groupsForFolder[0]?.id ?? null;
    this.set({ selectedWorkspaceId: workspaceId, selectedFolderId, selectedGroupId });
  }

  // Auth
  async register(username: string, password: string): Promise<void> {
    await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    await this.login(username, password);
  }

  async login(username: string, password: string): Promise<void> {
    const me = await apiFetch<User>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    this.set({ user: me });
    await this.refreshState();
  }

  async logout(): Promise<void> {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    this.set({ 
      user: null, 
      app: { workspaces: [], folders: [], groups: [], bookmarks: [] }, 
      selectedWorkspaceId: null, 
      selectedFolderId: null, 
      selectedGroupId: null 
    });
  }

  // Preferences
  async setTheme(theme: string): Promise<void> {
    const prefs = await apiFetch<UserPreferences>('/api/preferences', { method: 'PUT', body: JSON.stringify({ theme }) });
    if (this.state.user) this.set({ user: { ...this.state.user, preferences: prefs } });
  }

  async setViewMode(viewMode: ViewMode): Promise<void> {
    const prefs = await apiFetch<UserPreferences>('/api/preferences', { method: 'PUT', body: JSON.stringify({ viewMode }) });
    if (this.state.user) this.set({ user: { ...this.state.user, preferences: prefs } });
  }

  async setBookmarkViewMode(bookmarkViewMode: string): Promise<void> {
    const prefs = await apiFetch<UserPreferences>('/api/preferences', { method: 'PUT', body: JSON.stringify({ bookmarkViewMode }) });
    if (this.state.user) this.set({ user: { ...this.state.user, preferences: prefs } });
  }

  async setBookmarksPerContainer(bookmarksPerContainer: number): Promise<void> {
    const prefs = await apiFetch<UserPreferences>('/api/preferences', { method: 'PUT', body: JSON.stringify({ bookmarksPerContainer }) });
    if (this.state.user) this.set({ user: { ...this.state.user, preferences: prefs } });
  }

  // Workspaces
  async createWorkspace(title: string): Promise<void> {
    const workspace = await apiFetch<Workspace>('/api/workspaces', { method: 'POST', body: JSON.stringify({ title }) });
    this.set({ app: { ...this.state.app, workspaces: [...this.state.app.workspaces, workspace].sort(byPosition) } });
    this.set({ selectedWorkspaceId: workspace.id });
  }

  async updateWorkspace(id: string, title: string): Promise<void> {
    const workspace = await apiFetch<Workspace>(`/api/workspaces/${id}`, { method: 'PUT', body: JSON.stringify({ title }) });
    this.set({ app: { ...this.state.app, workspaces: this.state.app.workspaces.map(w => (w.id === id ? workspace : w)) } });
  }

  async deleteWorkspace(id: string): Promise<void> {
    await apiFetch(`/api/workspaces/${id}`, { method: 'DELETE' });
    await this.refreshState();
  }

  async reorderWorkspaces(orderedIds: string[]): Promise<void> {
    await apiFetch('/api/workspaces/reorder', { method: 'PUT', body: JSON.stringify({ orderedIds }) });
    await this.refreshState();
  }

  // Folders
  async createFolder(title: string): Promise<void> {
    const workspaceId = this.state.selectedWorkspaceId;
    if (!workspaceId) throw new Error('No workspace selected');
    const folder = await apiFetch<Folder>('/api/folders', { method: 'POST', body: JSON.stringify({ workspaceId, title }) });
    this.set({ app: { ...this.state.app, folders: [...this.state.app.folders, folder].sort(byPosition) } });
    this.set({ selectedFolderId: folder.id });
  }

  async updateFolder(id: string, title: string): Promise<void> {
    const folder = await apiFetch<Folder>(`/api/folders/${id}`, { method: 'PUT', body: JSON.stringify({ title }) });
    this.set({ app: { ...this.state.app, folders: this.state.app.folders.map(f => (f.id === id ? folder : f)) } });
  }

  async deleteFolder(id: string): Promise<void> {
    await apiFetch(`/api/folders/${id}`, { method: 'DELETE' });
    await this.refreshState();
  }

  async reorderFolders(orderedIds: string[]): Promise<void> {
    const workspaceId = this.state.selectedWorkspaceId;
    if (!workspaceId) throw new Error('No workspace selected');
    await apiFetch('/api/folders/reorder', { method: 'PUT', body: JSON.stringify({ workspaceId, orderedIds }) });
    await this.refreshState();
  }

  async moveFolder(id: string, workspaceId: string, orderedIds: string[]): Promise<void> {
    await apiFetch(`/api/folders/${id}/move`, { method: 'PUT', body: JSON.stringify({ workspaceId, orderedIds }) });
    await this.refreshState();
  }

  // Groups
  async createGroup(folderId: string, title: string): Promise<void> {
    const group = await apiFetch<Group>('/api/groups', { method: 'POST', body: JSON.stringify({ folderId, title }) });
    this.set({ app: { ...this.state.app, groups: [...this.state.app.groups, group].sort(byPosition) } });
    this.set({ selectedGroupId: group.id });
  }

  async updateGroup(id: string, title: string): Promise<void> {
    const group = await apiFetch<Group>(`/api/groups/${id}`, { method: 'PUT', body: JSON.stringify({ title }) });
    this.set({ app: { ...this.state.app, groups: this.state.app.groups.map(g => (g.id === id ? group : g)) } });
  }

  async deleteGroup(id: string): Promise<void> {
    await apiFetch(`/api/groups/${id}`, { method: 'DELETE' });
    await this.refreshState();
  }

  async moveGroup(id: string, folderId: string, orderedIds: string[]): Promise<void> {
    await apiFetch(`/api/groups/${id}/move`, { method: 'PUT', body: JSON.stringify({ folderId, orderedIds }) });
    await this.refreshState();
  }

  async reorderGroups(folderId: string, orderedIds: string[]): Promise<void> {
    await apiFetch(`/api/folders/${folderId}/groups/reorder`, { method: 'PUT', body: JSON.stringify({ orderedIds }) });
    await this.refreshState();
  }

  // Bookmarks
  async createBookmark(groupId: string, data: Omit<Bookmark, 'id' | 'userId' | 'groupId' | 'position'>): Promise<void> {
    await apiFetch<Bookmark>('/api/bookmarks', { method: 'POST', body: JSON.stringify({ groupId, ...data }) });
    await this.refreshState();
  }

  async updateBookmark(id: string, data: Partial<Omit<Bookmark, 'id' | 'userId' | 'groupId' | 'position'>>): Promise<void> {
    await apiFetch<Bookmark>(`/api/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
    await this.refreshState();
  }

  async deleteBookmark(id: string): Promise<void> {
    await apiFetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
    await this.refreshState();
  }

  async moveBookmark(id: string, groupId: string, orderedIds: string[]): Promise<void> {
    await apiFetch(`/api/bookmarks/${id}/move`, { method: 'PUT', body: JSON.stringify({ groupId, orderedIds }) });
    await this.refreshState();
  }

  async reorderBookmarks(groupId: string, orderedIds: string[]): Promise<void> {
    await apiFetch(`/api/groups/${groupId}/bookmarks/reorder`, { method: 'PUT', body: JSON.stringify({ orderedIds }) });
    await this.refreshState();
  }
}

function byPosition<T extends { position: number }>(a: T, b: T): number {
  return a.position - b.position;
}
