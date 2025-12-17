#!/usr/bin/env node
/**
 * Migration: Add bookmark view preferences to users table
 * Adds: bookmark_view_mode and bookmarks_per_container columns
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '..', 'data', 'app.sqlite');

async function migrate() {
  if (!fs.existsSync(DB_PATH)) {
    console.log('No database file found. Migration not needed.');
    process.exit(0);
  }

  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  // Check if columns already exist
  const tableInfo = db.exec("PRAGMA table_info(users)");
  const columns = tableInfo[0]?.values.map(row => row[1]) || [];
  
  const hasBookmarkViewMode = columns.includes('bookmark_view_mode');
  const hasBookmarksPerContainer = columns.includes('bookmarks_per_container');

  if (hasBookmarkViewMode && hasBookmarksPerContainer) {
    console.log('✓ Columns already exist. No migration needed.');
    db.close();
    process.exit(0);
  }

  console.log('Adding bookmark view preference columns...');

  try {
    // Add bookmark_view_mode column if it doesn't exist
    if (!hasBookmarkViewMode) {
      db.run("ALTER TABLE users ADD COLUMN bookmark_view_mode TEXT NOT NULL DEFAULT 'card'");
      console.log('✓ Added bookmark_view_mode column');
    }

    // Add bookmarks_per_container column if it doesn't exist
    if (!hasBookmarksPerContainer) {
      db.run("ALTER TABLE users ADD COLUMN bookmarks_per_container INTEGER NOT NULL DEFAULT 20");
      console.log('✓ Added bookmarks_per_container column');
    }

    // Save the updated database
    const data = db.export();
    fs.writeFileSync(DB_PATH, data);
    console.log('✓ Database migration complete!');

    db.close();
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    db.close();
    process.exit(1);
  }
}

migrate().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
