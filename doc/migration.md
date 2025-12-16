# Migration Guide

## Database Schema Changes

### From Plain-text Passwords to Hashed Passwords

If you have an existing database with plain-text passwords, you'll need to migrate them to hashed passwords.

**⚠️ IMPORTANT: This is required after updating to the version with bcrypt password hashing.**

### Migration Script

Save this as `scripts/migrate-passwords.mjs`:

```javascript
import initSqlJs from 'sql.js';
import bcrypt from 'bcrypt';
import fs from 'node:fs/promises';
import path from 'node:path';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'data', 'app.sqlite');
const SALT_ROUNDS = 10;

async function migratePasswords() {
  console.log('🔄 Starting password migration...');
  console.log(`📁 Database: ${DB_PATH}`);

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

  // Check if passwords are already hashed (bcrypt hashes start with $2b$)
  const alreadyHashed = users.filter(u => u.password.startsWith('$2b$'));
  if (alreadyHashed.length === users.length) {
    console.log('✅ All passwords are already hashed. No migration needed.');
    return;
  }

  console.log(`🔐 Migrating ${users.length - alreadyHashed.length} passwords...`);

  // Hash passwords
  for (const user of users) {
    if (!user.password.startsWith('$2b$')) {
      console.log(`  - Hashing password for user: ${user.username}`);
      const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
      const updateStmt = db.prepare('UPDATE users SET password = ? WHERE id = ?');
      updateStmt.run([hashedPassword, user.id]);
      updateStmt.free();
    }
  }

  // Save database
  const data = db.export();
  await fs.writeFile(DB_PATH, Buffer.from(data));

  console.log('Migration complete!');
  console.log('All passwords are now securely hashed with bcrypt.');
}

migratePasswords().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

### Running the Migration

```bash
# Make sure you have bcrypt installed
npm install

# Run the migration
node scripts/migrate-passwords.mjs

# Restart your server
pm2 restart neotypa-booktabs
# OR
npm run start
```

### For New Installations

No migration is needed! New user registrations will automatically use hashed passwords.

## Backup First!

**Always backup your database before running migrations:**

```bash
cp data/app.sqlite data/app.sqlite.backup-$(date +%Y%m%d)
```

## What Changed

### Security Improvements
- **Password Hashing**: Passwords now use bcrypt with 10 salt rounds
- **Session Expiration**: Sessions now properly expire after 30 days
- **Session Cleanup**: Expired sessions are automatically cleaned up
- **Secure Cookies**: Cookies marked as secure in production (HTTPS only)
- **Better Error Codes**: HTTP status codes now properly indicate error types (401, 404, 409)

### Backward Compatibility
- The database schema remains the same
- Only the password field values change (plain text → bcrypt hash)
- Existing sessions continue to work
- No API changes for clients
