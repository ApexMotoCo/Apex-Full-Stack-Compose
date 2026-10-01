const sqlite3 = require('sqlite3'), fs = require('fs'), path = require('path');
const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e =>
  ['node_modules', '.git'].includes(e.name) ? [] :
  e.isDirectory() ? walk(path.join(d, e.name)) :
  /\.(db|sqlite3?)$/i.test(e.name) ? [path.join(d, e.name)] : []);
for (const f of walk('.')) {
  const db = new sqlite3.Database(f, sqlite3.OPEN_READONLY);
  db.all("select name from sqlite_master where type='table'", (err, rows) => {
    if (err) { console.log(f, err.message); return; }
    console.log('\n' + f + '\n  tables: ' + rows.map(r => r.name).join(', '));
    rows.filter(r => /user|account|staff|auth/i.test(r.name)).forEach(r =>
      db.all(`pragma table_info(${r.name})`, (e2, cols) =>
        console.log('  ' + r.name + ' columns: ' + cols.map(c => c.name).join(', '))));
  });
}
