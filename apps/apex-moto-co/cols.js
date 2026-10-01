const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('data/database.db', sqlite3.OPEN_READONLY);
['bookings', 'services'].forEach(t =>
  db.all(`pragma table_info(${t})`, (e, cols) =>
    console.log(t + ': ' + (e ? e.message : cols.map(c => c.name).join(', ')))));
