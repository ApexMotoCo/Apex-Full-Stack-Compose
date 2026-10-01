#!/usr/bin/env node
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'data/apex.db'));
const email = process.env.ADMIN_EMAIL;
const passwordHash = process.env.ADMIN_PASSWORD_HASH;

if (!email || !passwordHash) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD_HASH before seeding an admin.');
  process.exit(1);
}

console.log('\n🔄 Running setup...\n');

db.serialize(() => {
  // Try to add role column (will fail silently if it exists)
  db.run(`ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'`, (err) => {
    // Ignore errors if column already exists
    if (err && !err.message.includes('duplicate column')) {
      console.log('Note:', err.message);
    }
    
    // Now seed admin
    db.run(
      `INSERT OR IGNORE INTO users (email, password, name, role) VALUES (?, ?, ?, ?)`,
      [email, passwordHash, 'Admin', 'admin'],
      function(err) {
        if (err) {
          console.error('❌ Error seeding admin:', err.message);
          process.exit(1);
        }
        console.log('✓ Admin user created/exists');
        console.log('\n=== ADMIN CREDENTIALS ===');
        console.log(`Email:    ${email}`);
        console.log('========================\n');
        process.exit(0);
      }
    );
  });
});
