import initSqlJs from 'sql.js';
import bcrypt from 'bcrypt';
import fs from 'node:fs/promises';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'app.sqlite');
const SALT_ROUNDS = 10;

async function migratePasswords() {
  console.log('🔄 Starting password migration...');
  console.log(`📁 Database: ${DB_PATH}`);

  // Check if database exists
  try {
    await fs.access(DB_PATH);
  } catch {
    console.log('❌ Database file not found. No migration needed.');
    return;
  }

  // Read database
  const SQL = await initSqlJs({});
  const buffer = await fs.readFile(DB_PATH);
  const db = new SQL.Database(new Uint8Array(buffer));

  // Get all users
  const stmt = db.prepare('SELECT id, username, password FROM users');
  const users = [];
  while (stmt.step()) {
    users.push(stmt.getAsObject());
  }
  stmt.free();

  console.log(`👥 Found ${users.length} users to migrate`);

  if (users.length === 0) {
    console.log('ℹ️  No users in database. No migration needed.');
    return;
  }

  // Check if passwords are already hashed (bcrypt hashes start with $2b$, $2a$, or $2y$)
  const alreadyHashed = users.filter(u => 
    typeof u.password === 'string' && u.password.match(/^\$2[aby]\$/)
  );
  
  if (alreadyHashed.length === users.length) {
    console.log('✅ All passwords are already hashed. No migration needed.');
    return;
  }

  const toMigrate = users.length - alreadyHashed.length;
  console.log(`🔐 Migrating ${toMigrate} passwords...`);

  // Hash passwords
  db.exec('BEGIN TRANSACTION');
  try {
    for (const user of users) {
      if (typeof user.password === 'string' && !user.password.match(/^\$2[aby]\$/)) {
        console.log(`  - Hashing password for user: ${user.username}`);
        const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
        const updateStmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
        updateStmt.run([hashedPassword, user.id]);
        updateStmt.free();
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  // Save database
  const data = db.export();
  await fs.writeFile(DB_PATH, Buffer.from(data));

  console.log('✅ Migration complete!');
  console.log('💡 All passwords are now securely hashed with bcrypt.');
  console.log('🔄 Please restart your server.');
}

migratePasswords().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
