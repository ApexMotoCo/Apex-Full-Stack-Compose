/**
 * Reset a dashboard user's password directly in the SQLite database.
 *
 * Usage (inside the container):
 *   node reset-password.js <email> <new-password>
 *
 * - Adds any missing columns (role, name) to an older users table.
 * - If the user doesn't exist it is created as an admin.
 */
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');

const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
  console.error('Usage: node reset-password.js <email> <new-password>');
  process.exit(1);
}
if (!email.endsWith('@apexingoodcompany.co.uk')) {
  console.error('Email must be an @apexingoodcompany.co.uk address');
  process.exit(1);
}
if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

const db = new sqlite3.Database('/data/monitoring.db', (err) => {
  if (err) {
    console.error('Could not open database:', err.message);
    process.exit(1);
  }
});

const fail = (msg, err) => {
  console.error(msg, err ? err.message : '');
  process.exit(1);
};

const hash = bcrypt.hashSync(newPassword, 10);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_login DATETIME
  )`);

  db.all('PRAGMA table_info(users)', (err, cols) => {
    if (err) return fail('Could not read users table:', err);
    const have = cols.map((c) => c.name);
    console.log('Existing columns:', have.join(', '));

    const missing = [];
    if (!have.includes('role')) missing.push("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'");
    if (!have.includes('name')) missing.push('ALTER TABLE users ADD COLUMN name TEXT');
    if (!have.includes('last_login')) missing.push('ALTER TABLE users ADD COLUMN last_login DATETIME');

    const runNext = (i) => {
      if (i < missing.length) {
        return db.run(missing[i], (e) => (e ? fail('Migration failed:', e) : runNext(i + 1)));
      }
      upsert();
    };
    runNext(0);
  });

  function upsert() {
    db.run('UPDATE users SET password = ? WHERE email = ?', [hash, email], function (err) {
      if (err) return fail('Update failed:', err);
      if (this.changes > 0) {
        console.log(`Password updated for ${email}`);
        return db.close();
      }
      db.run(
        "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, 'admin')",
        [email, hash, email.split('@')[0]],
        (err2) => {
          if (err2) return fail('Create failed:', err2);
          console.log(`No existing user, created admin account for ${email}`);
          db.close();
        }
      );
    });
  }
});
