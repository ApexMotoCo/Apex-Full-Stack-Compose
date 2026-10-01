const sqlite3 = require('sqlite3'), bcrypt = require('bcryptjs');
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
const ask = q => new Promise(r => rl.question(q, r));
(async () => {
  const username = (await ask('Username: ')).trim();
  const email = (await ask('Email: ')).trim();
  const display = (await ask('Display name: ')).trim();
  const role = ((await ask('Role (user/admin) [user]: ')).trim() || 'user');
  const pw = await ask('Password: ');
  rl.close();
  if (!['user', 'admin'].includes(role)) { console.log('Role must be user or admin'); return; }
  if (!username || !pw) { console.log('Username and password are required'); return; }
  const db = new sqlite3.Database('data/database.db');
  db.run('INSERT INTO workshop_users (username, email, password, display_name, role, is_active) VALUES (?, ?, ?, ?, ?, 1)',
    [username, email, bcrypt.hashSync(pw, 10), display || username, role],
    function (e) { console.log(e ? e.message : 'Added user id ' + this.lastID); db.close(); });
})();
