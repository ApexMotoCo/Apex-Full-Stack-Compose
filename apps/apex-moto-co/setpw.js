const sqlite3 = require('sqlite3'), bcrypt = require('bcryptjs');
const rl = require('readline').createInterface({ input: process.stdin, output: process.stdout });
rl.question('Workshop username: ', u => rl.question('New password: ', p => {
  const db = new sqlite3.Database('data/database.db');
  db.run('UPDATE workshop_users SET password = ? WHERE username = ?',
    [bcrypt.hashSync(p, 10), u],
    function (e) { console.log(e ? e.message : 'Rows updated: ' + this.changes); rl.close(); db.close(); });
}));
