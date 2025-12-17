import type { Bookmark, Folder, Group, ViewMode, ImportResult } from '@app/shared';
import type { StoreState } from '../state/store';
import { AppStore } from '../state/store';
import { DAISY_THEMES } from '../daisyThemes';
import { allowDrop, getDragPayload, setDragPayload } from './dnd';
import { escapeHtml, qs, qsa } from './util';
import { BASE_PATH } from '../config.js';
import { apiFetch } from '../api/http.js';

export function renderApp(root: HTMLElement, state: StoreState, store: AppStore): void {
  if (!state.user) {
    root.innerHTML = authHtml(state.error);
    wireAuth(root, store);
    return;
  }

  document.documentElement.setAttribute('data-theme', state.user.preferences.theme);

  root.innerHTML = appHtml(state);

  wireHeader(root, state, store);

  const viewMode = state.user.preferences.viewMode;
  if (viewMode === 'tabbed') {
    wireTabbed(root, state, store);
  } else {
    wireHierarchical(root, state, store);
  }

  wireModals(root, state, store);
}

function authHtml(error: string | null): string {
  return `
<div class="min-h-screen bg-base-200 flex items-center justify-center p-4">
  <div class="card bg-base-100 w-full max-w-md shadow">
    <div class="card-body">
      <h1 class="card-title">Sign in</h1>
      ${error ? `<div class="alert alert-error"><span>${escapeHtml(error)}</span></div>` : ''}
      <label class="form-control w-full">
        <div class="label"><span class="label-text">Username</span></div>
        <input id="auth-username" class="input input-bordered w-full" autocomplete="username" />
      </label>
      <label class="form-control w-full">
        <div class="label"><span class="label-text">Password</span></div>
        <input id="auth-password" type="password" class="input input-bordered w-full" autocomplete="current-password" />
      </label>
      <div class="card-actions justify-end gap-2 mt-2">
        <button id="auth-login" class="btn btn-primary">Login</button>
        <button id="auth-register" class="btn btn-ghost">Register</button>
      </div>
      <p class="text-xs opacity-70 mt-3">Passwords are stored as plain text in this MVP.</p>
    </div>
  </div>
</div>
`;
}

function appHtml(state: StoreState): string {
  const user = state.user!;
  const viewMode = user.preferences.viewMode;

  return `
<div class="min-h-screen bg-base-200">
  <header class="navbar bg-base-100 border-b border-base-300 sticky top-0 z-10">
    <div class="flex-1 gap-2">
      <div class="font-semibold text-lg px-2">Neotypa Booktabs</div>
      <div class="join">
        <button class="btn btn-sm join-item ${viewMode === 'tabbed' ? 'btn-active' : ''}" data-action="set-view" data-view="tabbed">Tabbed</button>
        <button class="btn btn-sm join-item ${viewMode === 'hierarchical' ? 'btn-active' : ''}" data-action="set-view" data-view="hierarchical">Hierarchical</button>
      </div>
    </div>
    <div class="flex-none gap-2">
      <button class="btn btn-sm btn-ghost gap-1" data-action="export-bookmarks" title="Export bookmarks">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span class="hidden sm:inline">Export</span>
      </button>
      <button class="btn btn-sm btn-ghost gap-1" data-action="import-bookmarks" title="Import bookmarks">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <span class="hidden sm:inline">Import</span>
      </button>
      <select id="theme-select" class="select select-bordered select-sm w-40">
        ${DAISY_THEMES.map((t) => `<option value="${escapeHtml(t)}" ${t === user.preferences.theme ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
      </select>
      <div class="dropdown dropdown-end">
        <div tabindex="0" role="button" class="btn btn-sm btn-ghost">
          ${escapeHtml(user.username)}
        </div>
        <ul tabindex="0" class="dropdown-content menu bg-base-100 rounded-box w-48 shadow">
          <li><a data-action="logout">Logout</a></li>
        </ul>
      </div>
    </div>
  </header>

  <main class="p-3 md:p-5">
    ${viewMode === 'tabbed' ? tabbedHtml(state) : hierarchicalHtml(state)}
  </main>

  ${modalsHtml()}
</div>
`;
}

function tabbedHtml(state: StoreState): string {
  const { workspaces, folders, groups, bookmarks } = state.app;
  const selectedWorkspaceId = state.selectedWorkspaceId;
  const selectedFolderId = state.selectedFolderId;

  // Workspace tabs
  const workspaceTabs = workspaces
    .sort((a, b) => a.position - b.position)
    .map((w) => {
      const active = w.id === selectedWorkspaceId;
      return `
        <a
          class="tab ${active ? 'tab-active' : ''}"
          role="tab"
          data-action="select-workspace"
          data-workspace-id="${escapeHtml(w.id)}"
          draggable="true"
          data-dnd-kind="workspace"
          data-dnd-id="${escapeHtml(w.id)}"
        >${escapeHtml(w.title)}</a>`;
    })
    .join('');

  // Folder tabs (filtered by selected workspace)
  const workspaceFolders = selectedWorkspaceId ? folders.filter((f) => f.workspaceId === selectedWorkspaceId) : [];
  const folderTabs = workspaceFolders
    .sort((a, b) => a.position - b.position)
    .map((f) => {
      const active = f.id === selectedFolderId;
      return `
        <a
          class="tab ${active ? 'tab-active' : ''}"
          role="tab"
          data-action="select-folder"
          data-folder-id="${escapeHtml(f.id)}"
          draggable="true"
          data-dnd-kind="folder"
          data-dnd-id="${escapeHtml(f.id)}"
        >${escapeHtml(f.title)}</a>`;
    })
    .join('');

  const selectedGroups = selectedFolderId ? groups.filter((g) => g.folderId === selectedFolderId).sort((a, b) => a.position - b.position) : [];

  const groupsHtml = selectedGroups
    .map((g) => {
      const bms = bookmarks.filter((b) => b.groupId === g.id).sort((a, b) => a.position - b.position);
      return groupCardHtml(g, bms, { showFolderDrop: false });
    })
    .join('');

  return `
<div class="flex flex-col gap-2 mb-4">
  <div role="tablist" class="tabs tabs-boxed overflow-x-auto" id="workspace-tabs">
    ${workspaceTabs}
    <a class="tab" role="tab" data-action="open-workspace-create">+ Workspace</a>
  </div>
  <div class="flex items-center justify-end gap-2">
    <button class="btn btn-xs" data-action="open-workspace-edit" ${selectedWorkspaceId ? '' : 'disabled'}>Edit workspace</button>
    <button class="btn btn-xs btn-ghost" data-action="delete-workspace" ${selectedWorkspaceId ? '' : 'disabled'}>Delete workspace</button>
  </div>
  <div role="tablist" class="tabs tabs-boxed overflow-x-auto" id="folder-tabs">
    ${folderTabs}
    <a class="tab" role="tab" data-action="open-folder-create" ${selectedWorkspaceId ? '' : 'disabled'}>+ Folder</a>
  </div>
  <div class="flex items-center justify-end gap-2">
    <button class="btn btn-sm" data-action="open-folder-edit" ${selectedFolderId ? '' : 'disabled'}>Edit folder</button>
    <button class="btn btn-sm btn-ghost" data-action="delete-folder" ${selectedFolderId ? '' : 'disabled'}>Delete folder</button>
    <button class="btn btn-sm" data-action="open-group-create" ${selectedFolderId ? '' : 'disabled'}>+ Group</button>
  </div>
</div>

<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="groups-grid">
  ${groupsHtml || emptyStateHtml('No groups yet. Create one to get started.')}
</div>
`;
}

function hierarchicalHtml(state: StoreState): string {
  const { workspaces, folders, groups, bookmarks } = state.app;
  const selectedWorkspaceId = state.selectedWorkspaceId;
  const selectedGroupId = state.selectedGroupId;

  // Workspace tabs
  const workspaceTabs = workspaces
    .sort((a, b) => a.position - b.position)
    .map((w) => {
      const active = w.id === selectedWorkspaceId;
      return `
        <a
          class="tab ${active ? 'tab-active' : ''}"
          role="tab"
          data-action="select-workspace"
          data-workspace-id="${escapeHtml(w.id)}"
          draggable="true"
          data-dnd-kind="workspace"
          data-dnd-id="${escapeHtml(w.id)}"
        >${escapeHtml(w.title)}</a>`;
    })
    .join('');

  // Filter folders by selected workspace
  const workspaceFolders = selectedWorkspaceId ? folders.filter((f) => f.workspaceId === selectedWorkspaceId) : [];

  const folderBlocks = workspaceFolders
    .sort((a, b) => a.position - b.position)
    .map((f) => {
      const gs = groups.filter((g) => g.folderId === f.id).sort((a, b) => a.position - b.position);
      return `
<details class="collapse collapse-arrow bg-base-100" open>
  <summary class="collapse-title font-medium flex items-center justify-between">
    <span
      class="truncate"
      draggable="true"
      data-dnd-kind="folder"
      data-dnd-id="${escapeHtml(f.id)}"
      data-action="select-folder"
      data-folder-id="${escapeHtml(f.id)}"
    >${escapeHtml(f.title)}</span>
    <span class="flex-none"></span>
  </summary>
  <div class="collapse-content">
    <div class="flex flex-col gap-1" data-folder-groups="${escapeHtml(f.id)}">
      ${
        gs
          .map((g) => {
            const active = g.id === selectedGroupId;
            return `
        <button
          class="btn btn-sm justify-start ${active ? 'btn-primary' : 'btn-ghost'}"
          data-action="select-group"
          data-group-id="${escapeHtml(g.id)}"
          draggable="true"
          data-dnd-kind="group"
          data-dnd-id="${escapeHtml(g.id)}"
          data-dnd-folder-id="${escapeHtml(f.id)}"
        >${escapeHtml(g.title)}</button>`;
          })
          .join('')
      }
      <button class="btn btn-sm btn-ghost justify-start" data-action="open-group-create" data-folder-id="${escapeHtml(f.id)}">+ Group</button>
    </div>
  </div>
</details>`;
    })
    .join('');

  const selectedBookmarks = selectedGroupId
    ? bookmarks.filter((b) => b.groupId === selectedGroupId).sort((a, b) => a.position - b.position)
    : [];

  const selectedGroup = selectedGroupId ? groups.find((g) => g.id === selectedGroupId) ?? null : null;

  return `
<div class="flex flex-col gap-2 mb-4">
  <div role="tablist" class="tabs tabs-boxed overflow-x-auto" id="workspace-tabs">
    ${workspaceTabs}
    <a class="tab" role="tab" data-action="open-workspace-create">+ Workspace</a>
  </div>
  <div class="flex items-center justify-end gap-2">
    <button class="btn btn-xs" data-action="open-workspace-edit" ${selectedWorkspaceId ? '' : 'disabled'}>Edit workspace</button>
    <button class="btn btn-xs btn-ghost" data-action="delete-workspace" ${selectedWorkspaceId ? '' : 'disabled'}>Delete workspace</button>
  </div>
</div>
<div class="grid grid-cols-1 md:grid-cols-12 gap-4">
  <aside class="md:col-span-4 lg:col-span-3 flex flex-col gap-3">
    <div class="flex gap-2">
      <button class="btn btn-sm" data-action="open-folder-create" ${selectedWorkspaceId ? '' : 'disabled'}>+ Folder</button>
      <button class="btn btn-sm" data-action="open-folder-edit" ${state.selectedFolderId ? '' : 'disabled'}>Edit</button>
      <button class="btn btn-sm btn-ghost" data-action="delete-folder" ${state.selectedFolderId ? '' : 'disabled'}>Delete</button>
    </div>
    <div class="flex flex-col gap-3">
      ${folderBlocks || emptyStateHtml('No folders yet. Create one to get started.')}
    </div>
  </aside>
  <section class="md:col-span-8 lg:col-span-9">
    <div class="card bg-base-100 shadow">
      <div class="card-body">
        <div class="flex items-center justify-between gap-2">
          <h2 class="card-title">${selectedGroup ? escapeHtml(selectedGroup.title) : 'Select a group'}</h2>
          <button class="btn btn-sm" data-action="open-bookmark-create" ${selectedGroupId ? '' : 'disabled'}>+ Bookmark</button>
        </div>
        <div class="divider my-2"></div>
        <div class="flex flex-col gap-2" id="bookmark-list" data-bookmark-group="${escapeHtml(selectedGroupId ?? '')}">
          ${selectedGroupId ? (selectedBookmarks.map((b) => bookmarkRowHtml(b)).join('') || emptyStateHtml('No bookmarks in this group yet.')) : emptyStateHtml('Pick a group from the left.')}
        </div>
      </div>
    </div>
  </section>
</div>
`;
}

function groupCardHtml(group: Group, bookmarks: Bookmark[], opts: { showFolderDrop: boolean }): string {
  return `
<div class="card bg-base-100 shadow" draggable="true" data-dnd-kind="group" data-dnd-id="${escapeHtml(group.id)}" data-dnd-folder-id="${escapeHtml(group.folderId)}">
  <div class="card-body">
    <div class="flex items-start justify-between gap-2">
      <h3 class="card-title text-base truncate" data-group-drop="${escapeHtml(group.id)}">${escapeHtml(group.title)}</h3>
      <div class="flex gap-1">
        <button class="btn btn-xs" data-action="open-group-edit" data-group-id="${escapeHtml(group.id)}">Edit</button>
        <button class="btn btn-xs btn-ghost" data-action="delete-group" data-group-id="${escapeHtml(group.id)}">Delete</button>
      </div>
    </div>

    <div class="flex justify-end">
      <button class="btn btn-xs" data-action="open-bookmark-create" data-group-id="${escapeHtml(group.id)}">+ Bookmark</button>
    </div>

    <div class="flex flex-col gap-2" data-bookmark-group="${escapeHtml(group.id)}">
      ${bookmarks.map((b) => bookmarkRowHtml(b)).join('') || emptyStateHtml('No bookmarks.')}
    </div>
  </div>
</div>
`;
}

function bookmarkRowHtml(b: Bookmark): string {
  const tags = b.tags.map((t) => `<span class="badge badge-outline">${escapeHtml(t)}</span>`).join(' ');
  return `
<div class="p-3 rounded-box bg-base-200" draggable="true" data-dnd-kind="bookmark" data-dnd-id="${escapeHtml(b.id)}" data-dnd-group-id="${escapeHtml(b.groupId)}">
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0">
      <a class="link link-primary font-medium break-all" href="${escapeHtml(b.url)}" target="_blank" rel="noreferrer">${escapeHtml(b.title || b.url)}</a>
      ${b.description ? `<div class="text-sm opacity-80 mt-1">${escapeHtml(b.description)}</div>` : ''}
      ${tags ? `<div class="flex flex-wrap gap-1 mt-2">${tags}</div>` : ''}
    </div>
    <div class="flex flex-col gap-1 flex-none">
      <button class="btn btn-xs" data-action="open-bookmark-edit" data-bookmark-id="${escapeHtml(b.id)}">Edit</button>
      <button class="btn btn-xs btn-ghost" data-action="delete-bookmark" data-bookmark-id="${escapeHtml(b.id)}">Delete</button>
    </div>
  </div>
</div>
`;
}

function emptyStateHtml(text: string): string {
  return `<div class="p-4 rounded-box bg-base-100 opacity-80 text-sm">${escapeHtml(text)}</div>`;
}

function modalsHtml(): string {
  return `
<dialog id="modal-workspace" class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg" id="modal-workspace-title">Workspace</h3>
    <form method="dialog" class="mt-4 flex flex-col gap-3" id="modal-workspace-form">
      <input type="hidden" name="mode" />
      <input type="hidden" name="id" />
      <label class="form-control w-full">
        <div class="label"><span class="label-text">Title</span></div>
        <input name="title" class="input input-bordered w-full" required />
      </label>
      <div class="modal-action">
        <button type="button" class="btn" value="cancel">Cancel</button>
        <button class="btn btn-primary" value="ok">Save</button>
      </div>
    </form>
  </div>
</dialog>

<dialog id="modal-folder" class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg" id="modal-folder-title">Folder</h3>
    <form method="dialog" class="mt-4 flex flex-col gap-3" id="modal-folder-form">
      <input type="hidden" name="mode" />
      <input type="hidden" name="id" />
      <label class="form-control w-full">
        <div class="label"><span class="label-text">Title</span></div>
        <input name="title" class="input input-bordered w-full" required />
      </label>
      <label class="form-control w-full" id="folder-workspace-selector-container">
        <div class="label"><span class="label-text">Workspace</span></div>
        <select name="workspaceId" class="select select-bordered w-full" id="folder-workspace-selector">
        </select>
      </label>
      <div class="modal-action">
        <button type="button" class="btn" value="cancel">Cancel</button>
        <button class="btn btn-primary" value="ok">Save</button>
      </div>
    </form>
  </div>
</dialog>

<dialog id="modal-group" class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg" id="modal-group-title">Group</h3>
    <form method="dialog" class="mt-4 flex flex-col gap-3" id="modal-group-form">
      <input type="hidden" name="mode" />
      <input type="hidden" name="id" />
      <label class="form-control w-full">
        <div class="label"><span class="label-text">Title</span></div>
        <input name="title" class="input input-bordered w-full" required />
      </label>
      <label class="form-control w-full" id="group-folder-selector-container">
        <div class="label"><span class="label-text">Folder</span></div>
        <select name="folderId" class="select select-bordered w-full" id="group-folder-selector">
        </select>
      </label>
      <div class="modal-action">
        <button type="button" class="btn" value="cancel">Cancel</button>
        <button class="btn btn-primary" value="ok">Save</button>
      </div>
    </form>
  </div>
</dialog>

<dialog id="modal-bookmark" class="modal">
  <div class="modal-box">
    <h3 class="font-bold text-lg" id="modal-bookmark-title">Bookmark</h3>
    <form method="dialog" class="mt-4 flex flex-col gap-3" id="modal-bookmark-form">
      <input type="hidden" name="mode" />
      <input type="hidden" name="id" />
      <input type="hidden" name="groupId" />
      <label class="form-control w-full">
        <div class="label"><span class="label-text">URL</span></div>
        <input name="url" class="input input-bordered w-full" required />
      </label>
      <label class="form-control w-full">
        <div class="label"><span class="label-text">Title</span></div>
        <input name="title" class="input input-bordered w-full" required />
      </label>
      <label class="form-control w-full">
        <div class="label"><span class="label-text">Description</span></div>
        <textarea name="description" class="textarea textarea-bordered w-full" rows="3"></textarea>
      </label>
      <label class="form-control w-full">
        <div class="label"><span class="label-text">Tags (comma-separated)</span></div>
        <input name="tags" class="input input-bordered w-full" />
      </label>
      <div class="modal-action">
        <button type="button" class="btn" value="cancel">Cancel</button>
        <button class="btn btn-primary" value="ok">Save</button>
      </div>
    </form>
  </div>
</dialog>

<dialog id="modal-import" class="modal">
  <div class="modal-box max-w-2xl">
    <h3 class="font-bold text-lg">Import Bookmarks</h3>
    <div class="mt-4 flex flex-col gap-4">
      <div class="alert alert-info">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        <div>
          <p class="text-sm">Import bookmarks in Netscape HTML format (exported from most browsers and Start.me).</p>
          <p class="text-sm mt-1"><strong>Note:</strong> Our structure is: Workspace → Folder (Tab Book) → Group (Tab) → Bookmark</p>
        </div>
      </div>
      
      <label class="form-control w-full">
        <div class="label"><span class="label-text">Select bookmark file</span></div>
        <input type="file" id="import-file-input" accept=".html,.htm" class="file-input file-input-bordered w-full" />
      </label>

      <label class="form-control w-full">
        <div class="label"><span class="label-text">How to handle deeply nested folders?</span></div>
        <select id="import-strategy" class="select select-bordered w-full">
          <option value="flatten">Flatten - Convert deeper folders into groups</option>
          <option value="skip">Skip - Ignore bookmarks in folders deeper than supported</option>
        </select>
        <div class="label">
          <span class="label-text-alt">Choose how to handle bookmarks in folders nested deeper than 3 levels</span>
        </div>
      </label>

      <div id="import-result" class="hidden">
        <div class="alert" id="import-result-alert">
          <div id="import-result-content"></div>
        </div>
      </div>

      <div class="modal-action">
        <button type="button" class="btn" id="import-cancel-btn">Cancel</button>
        <button type="button" class="btn btn-primary" id="import-submit-btn">Import</button>
      </div>
    </div>
  </div>
</dialog>
`;
}

function wireAuth(root: HTMLElement, store: AppStore): void {
  const username = qs<HTMLInputElement>(root, '#auth-username');
  const password = qs<HTMLInputElement>(root, '#auth-password');

  qs<HTMLButtonElement>(root, '#auth-login').addEventListener('click', async () => {
    await store.login(username.value, password.value);
  });

  qs<HTMLButtonElement>(root, '#auth-register').addEventListener('click', async () => {
    await store.register(username.value, password.value);
  });
}

function wireHeader(root: HTMLElement, state: StoreState, store: AppStore): void {
  qsa<HTMLButtonElement>(root, '[data-action="set-view"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const view = (btn.dataset.view ?? 'tabbed') as ViewMode;
      await store.setViewMode(view);
    });
  });

  qs<HTMLSelectElement>(root, '#theme-select').addEventListener('change', async (ev) => {
    const value = (ev.target as HTMLSelectElement).value;
    await store.setTheme(value);
  });

  qsa<HTMLElement>(root, '[data-action="logout"]').forEach((a) => {
    a.addEventListener('click', async () => {
      await store.logout();
    });
  });

  // Export bookmarks
  qsa<HTMLElement>(root, '[data-action="export-bookmarks"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const response = await fetch(`${BASE_PATH}/api/export`, {
          credentials: 'same-origin'
        });
        
        if (!response.ok) {
          throw new Error('Export failed');
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bookmarks-${new Date().toISOString().split('T')[0]}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } catch (err) {
        alert(`Export failed: ${err}`);
      }
    });
  });

  // Import bookmarks
  qsa<HTMLElement>(root, '[data-action="import-bookmarks"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openImportModal(root, store);
    });
  });

  // Generic click handling for selections
  qsa<HTMLElement>(root, '[data-action="select-workspace"]').forEach((el) => {
    el.addEventListener('click', () => {
      const workspaceId = el.dataset.workspaceId;
      if (workspaceId) store.selectWorkspace(workspaceId);
    });
  });

  qsa<HTMLElement>(root, '[data-action="select-folder"]').forEach((el) => {
    el.addEventListener('click', () => {
      const folderId = el.dataset.folderId;
      if (folderId) store.selectFolder(folderId);
    });
  });

  qsa<HTMLElement>(root, '[data-action="select-group"]').forEach((el) => {
    el.addEventListener('click', () => {
      const groupId = el.dataset.groupId;
      if (groupId) store.selectGroup(groupId);
    });
  });

  // Workspace DnD reorder
  qsa<HTMLElement>(root, '[data-dnd-kind="workspace"]').forEach((el) => {
    el.addEventListener('dragstart', (ev) => setDragPayload(ev as DragEvent, { kind: 'workspace', id: el.dataset.dndId! }));
    el.addEventListener('dragover', (ev) => {
      const payload = getDragPayload(ev as DragEvent);
      // Allow workspace reordering OR folder drops
      if (payload && (payload.kind === 'workspace' || payload.kind === 'folder')) {
        allowDrop(ev as DragEvent);
      }
    });
    el.addEventListener('drop', async (ev) => {
      const payload = getDragPayload(ev as DragEvent);
      if (!payload) return;
      (ev as DragEvent).preventDefault();

      if (payload.kind === 'workspace') {
        // Reorder workspaces
        const targetId = el.dataset.dndId!;
        if (payload.id === targetId) return;

        const tabs = qsa<HTMLElement>(root, '[data-dnd-kind="workspace"]');
        const ids = tabs.map((t) => t.dataset.dndId!).filter(Boolean);
        const from = ids.indexOf(payload.id);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0) return;
        ids.splice(from, 1);
        ids.splice(to, 0, payload.id);
        await store.reorderWorkspaces(ids);
      } else if (payload.kind === 'folder') {
        // Move folder to this workspace
        const targetWorkspaceId = el.dataset.dndId!;
        
        // Get all folders in the target workspace
        const foldersInWorkspace = state.app.folders
          .filter((f) => f.workspaceId === targetWorkspaceId)
          .sort((a, b) => a.position - b.position)
          .map((f) => f.id);

        // Add the dragged folder to the end
        const orderedIds = [...foldersInWorkspace, payload.id];
        await store.moveFolder(payload.id, targetWorkspaceId, orderedIds);
      }
    });
  });

  // Folder DnD reorder in both views
  qsa<HTMLElement>(root, '[data-dnd-kind="folder"]').forEach((el) => {
    el.addEventListener('dragstart', (ev) => setDragPayload(ev as DragEvent, { kind: 'folder', id: el.dataset.dndId! }));
    el.addEventListener('dragover', allowDrop);
    el.addEventListener('drop', async (ev) => {
      const payload = getDragPayload(ev as DragEvent);
      if (!payload || payload.kind !== 'folder') return;
      (ev as DragEvent).preventDefault();

      const targetId = el.dataset.dndId!;
      if (payload.id === targetId) return;

      const tabs = qsa<HTMLElement>(root, '[data-dnd-kind="folder"]');
      const ids = tabs.map((t) => t.dataset.dndId!).filter(Boolean);
      const from = ids.indexOf(payload.id);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return;
      ids.splice(from, 1);
      ids.splice(to, 0, payload.id);
      await store.reorderFolders(ids);
    });
  });

  // Allow dropping a group onto a folder tab to move it
  qsa<HTMLElement>(root, '[data-action="select-folder"][data-folder-id]').forEach((el) => {
    el.addEventListener('dragover', allowDrop);
    el.addEventListener('drop', async (ev) => {
      const payload = getDragPayload(ev as DragEvent);
      if (!payload || payload.kind !== 'group') return;
      (ev as DragEvent).preventDefault();

      const folderId = el.dataset.folderId!;
      if (payload.folderId === folderId) return;

      const groupsInFolder = state.app.groups
        .filter((g) => g.folderId === folderId)
        .sort((a, b) => a.position - b.position)
        .map((g) => g.id);

      const orderedIds = [...groupsInFolder, payload.id];
      await store.moveGroup(payload.id, folderId, orderedIds);
    });
  });
}

function wireTabbed(root: HTMLElement, state: StoreState, store: AppStore): void {
  // Groups DnD reorder inside the selected folder
  const folderId = state.selectedFolderId;
  if (folderId) {
    qsa<HTMLElement>(root, '[data-dnd-kind="group"]').forEach((el) => {
      el.addEventListener('dragstart', (ev) =>
        setDragPayload(ev as DragEvent, { kind: 'group', id: el.dataset.dndId!, folderId: el.dataset.dndFolderId! })
      );
    });

    const grid = root.querySelector<HTMLElement>('#groups-grid');
    if (grid) {
      grid.addEventListener('dragover', allowDrop);
      grid.addEventListener('drop', async (ev) => {
        const payload = getDragPayload(ev as DragEvent);
        if (!payload || payload.kind !== 'group') return;
        if (payload.folderId !== folderId) return;
        (ev as DragEvent).preventDefault();

        // reorder based on nearest group card
        const target = (ev.target as HTMLElement).closest('[data-dnd-kind="group"]') as HTMLElement | null;
        if (!target) return;
        const targetId = target.dataset.dndId!;
        if (targetId === payload.id) return;

        const cards = qsa<HTMLElement>(grid, '[data-dnd-kind="group"]');
        const ids = cards.map((c) => c.dataset.dndId!).filter(Boolean);
        const from = ids.indexOf(payload.id);
        const to = ids.indexOf(targetId);
        if (from < 0 || to < 0) return;
        ids.splice(from, 1);
        ids.splice(to, 0, payload.id);
        await store.reorderGroups(folderId, ids);
      });
    }
  }

  wireBookmarksDnD(root, state, store);
}

function wireHierarchical(root: HTMLElement, state: StoreState, store: AppStore): void {
  // Group reorder/move via dropping on group buttons within a folder block
  qsa<HTMLElement>(root, '[data-dnd-kind="group"]').forEach((el) => {
    el.addEventListener('dragstart', (ev) =>
      setDragPayload(ev as DragEvent, { kind: 'group', id: el.dataset.dndId!, folderId: el.dataset.dndFolderId! })
    );
  });

  qsa<HTMLElement>(root, '[data-folder-groups]').forEach((container) => {
    const folderId = container.getAttribute('data-folder-groups')!;
    container.addEventListener('dragover', allowDrop);
    container.addEventListener('drop', async (ev) => {
      const payload = getDragPayload(ev as DragEvent);
      if (!payload || payload.kind !== 'group') return;
      (ev as DragEvent).preventDefault();

      const targetBtn = (ev.target as HTMLElement).closest('[data-dnd-kind="group"]') as HTMLElement | null;
      const current = state.app.groups.filter((g) => g.folderId === folderId).sort((a, b) => a.position - b.position).map((g) => g.id);

      // If moving between folders, append then normalize
      if (payload.folderId !== folderId) {
        const orderedIds = [...current, payload.id];
        await store.moveGroup(payload.id, folderId, orderedIds);
        return;
      }

      if (!targetBtn) return;
      const targetId = targetBtn.dataset.dndId!;
      if (targetId === payload.id) return;

      const ids = current;
      const from = ids.indexOf(payload.id);
      const to = ids.indexOf(targetId);
      if (from < 0 || to < 0) return;
      ids.splice(from, 1);
      ids.splice(to, 0, payload.id);
      await store.reorderGroups(folderId, ids);
    });
  });

  wireBookmarksDnD(root, state, store);
}

function wireBookmarksDnD(root: HTMLElement, state: StoreState, store: AppStore): void {
  qsa<HTMLElement>(root, '[data-dnd-kind="bookmark"]').forEach((el) => {
    el.addEventListener('dragstart', (ev) =>
      setDragPayload(ev as DragEvent, { kind: 'bookmark', id: el.dataset.dndId!, groupId: el.dataset.dndGroupId! })
    );
  });

  // Drop on a group title to move bookmarks between groups
  qsa<HTMLElement>(root, '[data-group-drop]').forEach((el) => {
    el.addEventListener('dragover', allowDrop);
    el.addEventListener('drop', async (ev) => {
      const payload = getDragPayload(ev as DragEvent);
      if (!payload || payload.kind !== 'bookmark') return;
      (ev as DragEvent).preventDefault();
      const groupId = el.getAttribute('data-group-drop')!;
      if (payload.groupId === groupId) return;

      const current = state.app.bookmarks
        .filter((b) => b.groupId === groupId)
        .sort((a, b) => a.position - b.position)
        .map((b) => b.id);

      await store.moveBookmark(payload.id, groupId, [...current, payload.id]);
    });
  });

  // Reorder within a group by dropping on another bookmark row
  qsa<HTMLElement>(root, '[data-bookmark-group]').forEach((container) => {
    const groupId = container.getAttribute('data-bookmark-group')!;
    if (!groupId) return;

    container.addEventListener('dragover', allowDrop);
    container.addEventListener('drop', async (ev) => {
      const payload = getDragPayload(ev as DragEvent);
      if (!payload || payload.kind !== 'bookmark') return;
      if (payload.groupId !== groupId) return;
      (ev as DragEvent).preventDefault();

      const target = (ev.target as HTMLElement).closest('[data-dnd-kind="bookmark"]') as HTMLElement | null;
      if (!target) return;
      const targetId = target.dataset.dndId!;
      if (targetId === payload.id) return;

      const current = state.app.bookmarks
        .filter((b) => b.groupId === groupId)
        .sort((a, b) => a.position - b.position)
        .map((b) => b.id);

      const from = current.indexOf(payload.id);
      const to = current.indexOf(targetId);
      if (from < 0 || to < 0) return;
      current.splice(from, 1);
      current.splice(to, 0, payload.id);
      await store.reorderBookmarks(groupId, current);
    });
  });
}

function wireModals(root: HTMLElement, state: StoreState, store: AppStore): void {
  // Workspace modals
  qsa<HTMLElement>(root, '[data-action="open-workspace-create"]').forEach((btn) => {
    btn.addEventListener('click', () => openWorkspaceModal(root, { mode: 'create' }));
  });

  qsa<HTMLElement>(root, '[data-action="open-workspace-edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const workspaceId = state.selectedWorkspaceId;
      if (!workspaceId) return;
      const w = state.app.workspaces.find((x) => x.id === workspaceId);
      if (!w) return;
      openWorkspaceModal(root, { mode: 'edit', id: w.id, title: w.title });
    });
  });

  qsa<HTMLElement>(root, '[data-action="delete-workspace"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const workspaceId = state.selectedWorkspaceId;
      if (!workspaceId) return;
      if (!confirm('Delete this workspace (and all its contents)?')) return;
      await store.deleteWorkspace(workspaceId);
    });
  });

  // Open buttons
  qsa<HTMLElement>(root, '[data-action="open-folder-create"]').forEach((btn) => {
    btn.addEventListener('click', () => openFolderModal(root, state, { mode: 'create' }));
  });

  qsa<HTMLElement>(root, '[data-action="open-folder-edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const folderId = state.selectedFolderId;
      if (!folderId) return;
      const f = state.app.folders.find((x) => x.id === folderId);
      if (!f) return;
      openFolderModal(root, state, { mode: 'edit', id: f.id, title: f.title });
    });
  });

  qsa<HTMLElement>(root, '[data-action="delete-folder"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const folderId = state.selectedFolderId;
      if (!folderId) return;
      if (!confirm('Delete this folder (and its contents)?')) return;
      await store.deleteFolder(folderId);
    });
  });

  qsa<HTMLElement>(root, '[data-action="open-group-create"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const folderId = btn.getAttribute('data-folder-id') ?? state.selectedFolderId;
      if (!folderId) return;
      openGroupModal(root, state, { mode: 'create', folderId });
    });
  });

  qsa<HTMLElement>(root, '[data-action="open-group-edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-group-id')!;
      const group = state.app.groups.find((g) => g.id === id);
      if (!group) return;
      openGroupModal(root, state, { mode: 'edit', id: group.id, folderId: group.folderId, title: group.title });
    });
  });

  qsa<HTMLElement>(root, '[data-action="open-bookmark-create"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const groupId = btn.getAttribute('data-group-id') ?? state.selectedGroupId;
      if (!groupId) return;
      openBookmarkModal(root, { mode: 'create', groupId });
    });
  });

  qsa<HTMLElement>(root, '[data-action="open-bookmark-edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-bookmark-id')!;
      const b = state.app.bookmarks.find((x) => x.id === id);
      if (!b) return;
      openBookmarkModal(root, {
        mode: 'edit',
        id: b.id,
        groupId: b.groupId,
        url: b.url,
        title: b.title,
        description: b.description,
        tags: b.tags.join(', ')
      });
    });
  });

  qsa<HTMLElement>(root, '[data-action="delete-group"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-group-id')!;
      if (!confirm('Delete this group?')) return;
      await store.deleteGroup(id);
    });
  });

  qsa<HTMLElement>(root, '[data-action="delete-bookmark"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-bookmark-id')!;
      if (!confirm('Delete this bookmark?')) return;
      await store.deleteBookmark(id);
    });
  });

  // Group edit/delete quick actions in hierarchical sidebar
  qsa<HTMLElement>(root, '[data-dnd-kind="group"]').forEach((el) => {
    el.addEventListener('dblclick', () => {
      const id = el.getAttribute('data-dnd-id')!;
      const g = state.app.groups.find((x) => x.id === id);
      if (!g) return;
      openGroupModal(root, state, { mode: 'edit', id: g.id, folderId: g.folderId, title: g.title });
    });

    // Right-click disabled to prevent accidental deletion
    // Use double-click to edit, then delete from the edit modal if needed
  });

  // Folder edit/delete: double-click on folder title to edit
  qsa<HTMLElement>(root, '[data-dnd-kind="folder"]').forEach((el) => {
    el.addEventListener('dblclick', () => {
      const id = el.getAttribute('data-dnd-id')!;
      const f = state.app.folders.find((x) => x.id === id);
      if (!f) return;
      openFolderModal(root, state, { mode: 'edit', id: f.id, title: f.title });
    });

    // Right-click disabled to prevent accidental deletion
    // Use double-click to edit, then delete from the edit modal if needed
  });

  // Forms
  const workspaceDialog = qs<HTMLDialogElement>(root, '#modal-workspace');
  qs<HTMLButtonElement>(root, '#modal-workspace-form button[value="cancel"]').addEventListener('click', () => workspaceDialog.close());
  qs<HTMLFormElement>(root, '#modal-workspace-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const submitter = (ev as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === 'cancel') {
      workspaceDialog.close();
      return;
    }
    const form = ev.target as HTMLFormElement;
    const fd = new FormData(form);
    const mode = String(fd.get('mode'));
    const id = String(fd.get('id') ?? '');
    const title = String(fd.get('title') ?? '').trim();
    if (!title) return;

    if (mode === 'create') await store.createWorkspace(title);
    else await store.updateWorkspace(id, title);

    workspaceDialog.close();
  });

  const folderDialog = qs<HTMLDialogElement>(root, '#modal-folder');
  qs<HTMLButtonElement>(root, '#modal-folder-form button[value="cancel"]').addEventListener('click', () => folderDialog.close());
  qs<HTMLFormElement>(root, '#modal-folder-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const submitter = (ev as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === 'cancel') {
      folderDialog.close();
      return;
    }
    const form = ev.target as HTMLFormElement;
    const fd = new FormData(form);
    const mode = String(fd.get('mode'));
    const id = String(fd.get('id') ?? '');
    const title = String(fd.get('title') ?? '').trim();
    const newWorkspaceId = String(fd.get('workspaceId') ?? '');
    if (!title) return;

    if (mode === 'create') {
      await store.createFolder(title);
    } else {
      await store.updateFolder(id, title);
      
      // Check if workspace changed
      const folder = state.app.folders.find(f => f.id === id);
      if (folder && newWorkspaceId && folder.workspaceId !== newWorkspaceId) {
        // Move folder to new workspace
        const foldersInWorkspace = state.app.folders
          .filter((f) => f.workspaceId === newWorkspaceId)
          .sort((a, b) => a.position - b.position)
          .map((f) => f.id);
        const orderedIds = [...foldersInWorkspace, id];
        await store.moveFolder(id, newWorkspaceId, orderedIds);
      }
    }

    folderDialog.close();
  });

  const groupDialog = qs<HTMLDialogElement>(root, '#modal-group');
  qs<HTMLButtonElement>(root, '#modal-group-form button[value="cancel"]').addEventListener('click', () => groupDialog.close());
  qs<HTMLFormElement>(root, '#modal-group-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const submitter = (ev as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === 'cancel') {
      groupDialog.close();
      return;
    }
    const form = ev.target as HTMLFormElement;
    const fd = new FormData(form);
    const mode = String(fd.get('mode'));
    const id = String(fd.get('id') ?? '');
    const newFolderId = String(fd.get('folderId') ?? '');
    const title = String(fd.get('title') ?? '').trim();
    if (!title || !newFolderId) return;

    if (mode === 'create') {
      await store.createGroup(newFolderId, title);
    } else {
      await store.updateGroup(id, title);
      
      // Check if folder changed
      const group = state.app.groups.find(g => g.id === id);
      if (group && group.folderId !== newFolderId) {
        // Move group to new folder
        const groupsInFolder = state.app.groups
          .filter((g) => g.folderId === newFolderId)
          .sort((a, b) => a.position - b.position)
          .map((g) => g.id);
        const orderedIds = [...groupsInFolder, id];
        await store.moveGroup(id, newFolderId, orderedIds);
      }
    }

    groupDialog.close();
  });

  const bookmarkDialog = qs<HTMLDialogElement>(root, '#modal-bookmark');
  qs<HTMLButtonElement>(root, '#modal-bookmark-form button[value="cancel"]').addEventListener('click', () => bookmarkDialog.close());
  qs<HTMLFormElement>(root, '#modal-bookmark-form').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const submitter = (ev as SubmitEvent).submitter as HTMLButtonElement | null;
    if (submitter?.value === 'cancel') {
      bookmarkDialog.close();
      return;
    }
    const form = ev.target as HTMLFormElement;
    const fd = new FormData(form);
    const mode = String(fd.get('mode'));
    const id = String(fd.get('id') ?? '');
    const groupId = String(fd.get('groupId') ?? '');
    const url = String(fd.get('url') ?? '').trim();
    const title = String(fd.get('title') ?? '').trim();
    const description = String(fd.get('description') ?? '').trim();
    const tags = String(fd.get('tags') ?? '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (!groupId || !url || !title) return;

    if (mode === 'create') await store.createBookmark(groupId, { url, title, description, tags });
    else await store.updateBookmark(id, { url, title, description, tags });

    bookmarkDialog.close();
  });
}

function openWorkspaceModal(root: HTMLElement, data: { mode: 'create' } | { mode: 'edit'; id: string; title: string }): void {
  const dialog = qs<HTMLDialogElement>(root, '#modal-workspace');
  const form = qs<HTMLFormElement>(root, '#modal-workspace-form');
  (qs<HTMLElement>(root, '#modal-workspace-title')).textContent = data.mode === 'create' ? 'New workspace' : 'Edit workspace';

  (form.elements.namedItem('mode') as HTMLInputElement).value = data.mode;
  (form.elements.namedItem('id') as HTMLInputElement).value = data.mode === 'edit' ? data.id : '';
  (form.elements.namedItem('title') as HTMLInputElement).value = data.mode === 'edit' ? data.title : '';

  dialog.showModal();
}

function openFolderModal(root: HTMLElement, state: StoreState, data: { mode: 'create' } | { mode: 'edit'; id: string; title: string }): void {
  const dialog = qs<HTMLDialogElement>(root, '#modal-folder');
  const form = qs<HTMLFormElement>(root, '#modal-folder-form');
  (qs<HTMLElement>(root, '#modal-folder-title')).textContent = data.mode === 'create' ? 'New folder' : 'Edit folder';

  (form.elements.namedItem('mode') as HTMLInputElement).value = data.mode;
  (form.elements.namedItem('id') as HTMLInputElement).value = data.mode === 'edit' ? data.id : '';
  (form.elements.namedItem('title') as HTMLInputElement).value = data.mode === 'edit' ? data.title : '';

  // Populate workspace selector (only show in edit mode)
  const workspaceSelector = qs<HTMLSelectElement>(root, '#folder-workspace-selector');
  const workspaceSelectorContainer = qs<HTMLElement>(root, '#folder-workspace-selector-container');
  
  if (data.mode === 'edit') {
    const folder = state.app.folders.find(f => f.id === data.id);
    const currentWorkspaceId = folder?.workspaceId || state.app.workspaces[0]?.id || '';
    
    workspaceSelector.innerHTML = state.app.workspaces
      .map(w => `<option value="${w.id}" ${w.id === currentWorkspaceId ? 'selected' : ''}>${w.title}</option>`)
      .join('');
    workspaceSelectorContainer.style.display = '';
  } else {
    workspaceSelectorContainer.style.display = 'none';
  }

  dialog.showModal();
}

function openGroupModal(
  root: HTMLElement,
  state: StoreState,
  data:
    | { mode: 'create'; folderId: string }
    | { mode: 'edit'; id: string; folderId: string; title: string }
): void {
  const dialog = qs<HTMLDialogElement>(root, '#modal-group');
  const form = qs<HTMLFormElement>(root, '#modal-group-form');
  (qs<HTMLElement>(root, '#modal-group-title')).textContent = data.mode === 'create' ? 'New group' : 'Edit group';

  (form.elements.namedItem('mode') as HTMLInputElement).value = data.mode;
  (form.elements.namedItem('id') as HTMLInputElement).value = data.mode === 'edit' ? data.id : '';
  (form.elements.namedItem('title') as HTMLInputElement).value = data.mode === 'edit' ? data.title : '';

  // Populate folder selector
  const folderSelector = qs<HTMLSelectElement>(root, '#group-folder-selector');
  const folderSelectorContainer = qs<HTMLElement>(root, '#group-folder-selector-container');
  
  const currentFolderId = data.folderId;
  
  // Group folders by workspace
  const workspaceMap = new Map<string, typeof state.app.folders>();
  for (const folder of state.app.folders) {
    if (!workspaceMap.has(folder.workspaceId)) {
      workspaceMap.set(folder.workspaceId, []);
    }
    workspaceMap.get(folder.workspaceId)!.push(folder);
  }
  
  let options = '';
  for (const workspace of state.app.workspaces) {
    const folders = workspaceMap.get(workspace.id) || [];
    if (folders.length > 0) {
      options += `<optgroup label="${workspace.title}">`;
      for (const folder of folders) {
        options += `<option value="${folder.id}" ${folder.id === currentFolderId ? 'selected' : ''}>${folder.title}</option>`;
      }
      options += '</optgroup>';
    }
  }
  
  folderSelector.innerHTML = options;
  
  // Only show selector in edit mode
  if (data.mode === 'edit') {
    folderSelectorContainer.style.display = '';
  } else {
    folderSelectorContainer.style.display = 'none';
  }

  dialog.showModal();
}

function openBookmarkModal(
  root: HTMLElement,
  data:
    | { mode: 'create'; groupId: string }
    | { mode: 'edit'; id: string; groupId: string; url: string; title: string; description: string; tags: string }
): void {
  const dialog = qs<HTMLDialogElement>(root, '#modal-bookmark');
  const form = qs<HTMLFormElement>(root, '#modal-bookmark-form');
  (qs<HTMLElement>(root, '#modal-bookmark-title')).textContent = data.mode === 'create' ? 'New bookmark' : 'Edit bookmark';

  (form.elements.namedItem('mode') as HTMLInputElement).value = data.mode;
  (form.elements.namedItem('id') as HTMLInputElement).value = data.mode === 'edit' ? data.id : '';
  (form.elements.namedItem('groupId') as HTMLInputElement).value = data.groupId;
  (form.elements.namedItem('url') as HTMLInputElement).value = data.mode === 'edit' ? data.url : '';
  (form.elements.namedItem('title') as HTMLInputElement).value = data.mode === 'edit' ? data.title : '';
  (form.elements.namedItem('description') as HTMLTextAreaElement).value = data.mode === 'edit' ? data.description : '';
  (form.elements.namedItem('tags') as HTMLInputElement).value = data.mode === 'edit' ? data.tags : '';

  dialog.showModal();
}

function openImportModal(root: HTMLElement, store: AppStore): void {
  const dialog = qs<HTMLDialogElement>(root, '#modal-import');
  const fileInput = qs<HTMLInputElement>(root, '#import-file-input');
  const strategySelect = qs<HTMLSelectElement>(root, '#import-strategy');
  const submitBtn = qs<HTMLButtonElement>(root, '#import-submit-btn');
  const cancelBtn = qs<HTMLButtonElement>(root, '#import-cancel-btn');
  const resultDiv = qs<HTMLElement>(root, '#import-result');
  const resultAlert = qs<HTMLElement>(root, '#import-result-alert');
  const resultContent = qs<HTMLElement>(root, '#import-result-content');

  // Reset state
  fileInput.value = '';
  strategySelect.value = 'flatten';
  resultDiv.classList.add('hidden');
  submitBtn.disabled = false;

  // Cancel button
  cancelBtn.onclick = () => {
    dialog.close();
  };

  // Submit button
  submitBtn.onclick = async () => {
    const file = fileInput.files?.[0];
    if (!file) {
      alert('Please select a file');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Importing...';

    try {
      const html = await file.text();
      const strategy = strategySelect.value as 'flatten' | 'skip' | 'root';

      const result = await apiFetch<ImportResult>('/api/import', {
        method: 'POST',
        body: JSON.stringify({ html, strategy })
      });

      // Show result
      resultDiv.classList.remove('hidden');
      
      const hasWarnings = result.warnings.length > 0;
      const hasSkipped = result.bookmarksSkipped > 0;
      
      if (hasWarnings || hasSkipped) {
        resultAlert.className = 'alert alert-warning';
      } else {
        resultAlert.className = 'alert alert-success';
      }

      let summary = `
        <div class="font-semibold mb-2">Import completed!</div>
        <ul class="text-sm space-y-1">
          <li>✓ Created ${result.foldersCreated} folders</li>
          <li>✓ Created ${result.groupsCreated} groups</li>
          <li>✓ Imported ${result.bookmarksCreated} bookmarks</li>
          ${hasSkipped ? `<li>⚠ Skipped ${result.bookmarksSkipped} bookmarks</li>` : ''}
        </ul>
      `;

      if (hasWarnings) {
        summary += `
          <div class="mt-3">
            <div class="font-semibold text-sm">Warnings:</div>
            <ul class="text-xs mt-1 space-y-1 max-h-32 overflow-y-auto">
              ${result.warnings.map(w => `<li>• ${escapeHtml(w)}</li>`).join('')}
            </ul>
          </div>
        `;
      }

      resultContent.innerHTML = summary;

      // Reload state
      await store.refreshState();

      // Change buttons
      submitBtn.classList.add('hidden');
      cancelBtn.textContent = 'Close';
    } catch (err) {
      resultDiv.classList.remove('hidden');
      resultAlert.className = 'alert alert-error';
      resultContent.innerHTML = `
        <div class="font-semibold">Import failed</div>
        <div class="text-sm mt-1">${escapeHtml(String(err))}</div>
      `;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Import';
    }
  };

  dialog.showModal();
}
