# Architecture

## Goals

- Minimal dependencies
- Easy deployment on a small VPS
- Clean separation of concerns (UI, API, DB)

## Components

- `client/`: TypeScript SPA (built to static assets), styled with Tailwind + daisyUI.
- `server/`: Small Node HTTP server (no backend framework) exposing JSON APIs and serving the built SPA.
- `shared/`: Shared TypeScript types.

## Runtime flow

1. Browser loads the SPA.
2. SPA calls `/api/*` endpoints.
3. Server validates input, reads/writes the SQLite file, and returns JSON.

## Views

- Tabbed view: folders as tabs, groups as cards, bookmarks within cards.
- Hierarchical view: folders/groups navigation + selected group’s bookmarks.
