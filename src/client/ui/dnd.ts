export type DragPayload =
  | { kind: 'workspace'; id: string }
  | { kind: 'folder'; id: string }
  | { kind: 'group'; id: string; folderId: string }
  | { kind: 'bookmark'; id: string; groupId: string };

const MIME = 'application/x-bookmarks-dnd+json';

export function setDragPayload(ev: DragEvent, payload: DragPayload): void {
  ev.dataTransfer?.setData(MIME, JSON.stringify(payload));
  ev.dataTransfer?.setData('text/plain', payload.id);
  ev.dataTransfer?.setDragImage?.((ev.target as Element) ?? document.body, 10, 10);
}

export function getDragPayload(ev: DragEvent): DragPayload | null {
  const raw = ev.dataTransfer?.getData(MIME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DragPayload;
  } catch {
    return null;
  }
}

export function allowDrop(ev: DragEvent): void {
  ev.preventDefault();
}
