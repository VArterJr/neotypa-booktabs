export const SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER NOT NULL
);

INSERT INTO schema_version (version)
SELECT 1
WHERE NOT EXISTS (SELECT 1 FROM schema_version);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  theme TEXT NOT NULL,
  view_mode TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  folder_id TEXT NOT NULL,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(folder_id) REFERENCES folders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, name),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS bookmark_tags (
  bookmark_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY(bookmark_id, tag_id),
  FOREIGN KEY(bookmark_id) REFERENCES bookmarks(id) ON DELETE CASCADE,
  FOREIGN KEY(tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_folders_user_pos ON folders(user_id, position);
CREATE INDEX IF NOT EXISTS idx_groups_folder_pos ON groups(folder_id, position);
CREATE INDEX IF NOT EXISTS idx_bookmarks_group_pos ON bookmarks(group_id, position);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;
