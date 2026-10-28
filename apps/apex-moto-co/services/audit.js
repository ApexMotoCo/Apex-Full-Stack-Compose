const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dataDirectory = path.join(__dirname, '../data');
fs.mkdirSync(dataDirectory, { recursive: true });
const db = new sqlite3.Database(path.join(dataDirectory, 'database.db'));
db.configure('busyTimeout', 5000);

function ensureAuditSchema() {
  db.run(`CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    username TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    resource_id TEXT,
    request_id TEXT,
    details TEXT,
    ip_address TEXT,
    user_agent TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`, (createError) => {
    if (createError) {
      console.error('Audit schema initialization failed:', createError.message);
      return;
    }

    const migrations = [
      ['resource_id', 'TEXT'],
      ['request_id', 'TEXT'],
      ['user_agent', 'TEXT']
    ];

    migrations.forEach(([column, type]) => {
      db.run(`ALTER TABLE audit_logs ADD COLUMN ${column} ${type}`, (err) => {
        if (err && !err.message.includes('duplicate column name')) {
          console.error(`Audit schema migration failed for ${column}:`, err.message);
        }
      });
    });
  });
}

ensureAuditSchema();

function logAction(userId, username, action, resource, details, ipAddress, metadata = {}) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO audit_logs
       (user_id, username, action, resource, resource_id, request_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId || null,
        username || 'System',
        action,
        resource || null,
        metadata.resourceId || null,
        metadata.requestId || null,
        details || null,
        ipAddress || null,
        metadata.userAgent || null
      ],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

function getAuditLogs(limit = 100) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?`,
      [limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });
}

module.exports = { logAction, getAuditLogs, db };
