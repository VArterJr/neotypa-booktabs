# Database

The application uses a SQLite database file on the server.

## ERD

```mermaid
erDiagram
  users {
    TEXT id PK
    TEXT username
    TEXT password
    TEXT theme
    TEXT view_mode
    TEXT created_at
  }

  sessions {
    TEXT id PK
    TEXT user_id FK
    TEXT created_at
    TEXT last_seen_at
  }

  folders {
    TEXT id PK
    TEXT user_id FK
    TEXT title
    INTEGER position
    TEXT created_at
  }

  groups {
    TEXT id PK
    TEXT user_id FK
    TEXT folder_id FK
    TEXT title
    INTEGER position
    TEXT created_at
  }

  bookmarks {
    TEXT id PK
    TEXT user_id FK
    TEXT group_id FK
    TEXT url
    TEXT title
    TEXT description
    INTEGER position
    TEXT created_at
  }

  tags {
    TEXT id PK
    TEXT user_id FK
    TEXT name
    TEXT created_at
  }

  bookmark_tags {
    TEXT bookmark_id FK
    TEXT tag_id FK
  }

  users ||--o{ sessions : has
  users ||--o{ folders : owns
  folders ||--o{ groups : contains
  groups ||--o{ bookmarks : contains

  users ||--o{ tags : owns
  bookmarks ||--o{ bookmark_tags : links
  tags ||--o{ bookmark_tags : links
```

## Ordering

- `folders.position` orders folders per user.
- `groups.position` orders groups per folder.
- `bookmarks.position` orders bookmarks per group.
