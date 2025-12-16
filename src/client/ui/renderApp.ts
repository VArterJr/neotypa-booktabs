import type { Bookmark, Folder, Group, ViewMode } from '@app/shared';
import type { StoreState } from '../state/store';
import { AppStore } from '../state/store';
import { DAISY_THEMES } from '../daisyThemes';
import { allowDrop, getDragPayload, setDragPayload } from './dnd';
import { escapeHtml, qs, qsa } from './util';

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
  const { folders, groups, bookmarks } = state.app;
  const selectedFolderId = state.selectedFolderId;

  const folderTabs = folders
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
  <div role="tablist" class="tabs tabs-boxed overflow-x-auto" id="folder-tabs">
    ${folderTabs}
    <a class="tab" role="tab" data-action="open-folder-create">+ Folder</a>
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
  const { folders, groups, bookmarks } = state.app;
  const selectedGroupId = state.selectedGroupId;

  const folderBlocks = folders
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
<div class="grid grid-cols-1 md:grid-cols-12 gap-4">
  <aside class="md:col-span-4 lg:col-span-3 flex flex-col gap-3">
    <div class="flex gap-2">
      <button class="btn btn-sm" data-action="open-folder-create">+ Folder</button>
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
      <input type="hidden" name="folderId" />
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

  // Generic click handling for selections
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
  // Open buttons
  qsa<HTMLElement>(root, '[data-action="open-folder-create"]').forEach((btn) => {
    btn.addEventListener('click', () => openFolderModal(root, { mode: 'create' }));
  });

  qsa<HTMLElement>(root, '[data-action="open-folder-edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const folderId = state.selectedFolderId;
      if (!folderId) return;
      const f = state.app.folders.find((x) => x.id === folderId);
      if (!f) return;
      openFolderModal(root, { mode: 'edit', id: f.id, title: f.title });
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
      openGroupModal(root, { mode: 'create', folderId });
    });
  });

  qsa<HTMLElement>(root, '[data-action="open-group-edit"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-group-id')!;
      const group = state.app.groups.find((g) => g.id === id);
      if (!group) return;
      openGroupModal(root, { mode: 'edit', id: group.id, folderId: group.folderId, title: group.title });
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
      openGroupModal(root, { mode: 'edit', id: g.id, folderId: g.folderId, title: g.title });
    });

    el.addEventListener('contextmenu', async (ev) => {
      ev.preventDefault();
      const id = el.getAttribute('data-dnd-id')!;
      if (!confirm('Delete this group?')) return;
      await store.deleteGroup(id);
    });
  });

  // Folder edit/delete is accessible via right-click for now: double click on tab/folder title.
  qsa<HTMLElement>(root, '[data-dnd-kind="folder"]').forEach((el) => {
    el.addEventListener('dblclick', () => {
      const id = el.getAttribute('data-dnd-id')!;
      const f = state.app.folders.find((x) => x.id === id);
      if (!f) return;
      openFolderModal(root, { mode: 'edit', id: f.id, title: f.title });
    });

    el.addEventListener('contextmenu', async (ev) => {
      ev.preventDefault();
      const id = el.getAttribute('data-dnd-id')!;
      if (!confirm('Delete this folder (and its contents)?')) return;
      await store.deleteFolder(id);
    });
  });

  // Forms
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
    if (!title) return;

    if (mode === 'create') await store.createFolder(title);
    else await store.updateFolder(id, title);

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
    const folderId = String(fd.get('folderId') ?? '');
    const title = String(fd.get('title') ?? '').trim();
    if (!title || !folderId) return;

    if (mode === 'create') await store.createGroup(folderId, title);
    else await store.updateGroup(id, title);

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

function openFolderModal(root: HTMLElement, data: { mode: 'create' } | { mode: 'edit'; id: string; title: string }): void {
  const dialog = qs<HTMLDialogElement>(root, '#modal-folder');
  const form = qs<HTMLFormElement>(root, '#modal-folder-form');
  (qs<HTMLElement>(root, '#modal-folder-title')).textContent = data.mode === 'create' ? 'New folder' : 'Edit folder';

  (form.elements.namedItem('mode') as HTMLInputElement).value = data.mode;
  (form.elements.namedItem('id') as HTMLInputElement).value = data.mode === 'edit' ? data.id : '';
  (form.elements.namedItem('title') as HTMLInputElement).value = data.mode === 'edit' ? data.title : '';

  dialog.showModal();
}

function openGroupModal(
  root: HTMLElement,
  data:
    | { mode: 'create'; folderId: string }
    | { mode: 'edit'; id: string; folderId: string; title: string }
): void {
  const dialog = qs<HTMLDialogElement>(root, '#modal-group');
  const form = qs<HTMLFormElement>(root, '#modal-group-form');
  (qs<HTMLElement>(root, '#modal-group-title')).textContent = data.mode === 'create' ? 'New group' : 'Edit group';

  (form.elements.namedItem('mode') as HTMLInputElement).value = data.mode;
  (form.elements.namedItem('id') as HTMLInputElement).value = data.mode === 'edit' ? data.id : '';
  (form.elements.namedItem('folderId') as HTMLInputElement).value = data.folderId;
  (form.elements.namedItem('title') as HTMLInputElement).value = data.mode === 'edit' ? data.title : '';

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
