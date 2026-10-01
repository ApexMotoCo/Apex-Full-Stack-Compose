const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database connection pool
class DatabasePool {
  constructor(dbPath, poolSize = 5) {
    this.dbPath = dbPath;
    this.poolSize = poolSize;
    this.connections = [];
    this.available = [];
    this.initialize();
  }

  initialize() {
    for (let i = 0; i < this.poolSize; i++) {
      const db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) console.error('DB connection error:', err);
      });
      this.connections.push(db);
      this.available.push(db);
    }
  }

  getConnection() {
    if (this.available.length > 0) {
      return this.available.pop();
    }
    return this.connections[0]; // Fallback to first connection
  }

  releaseConnection(db) {
    this.available.push(db);
  }

  run(sql, params = []) {
    return new Promise((resolve, reject) => {
      const db = this.getConnection();
      db.run(sql, params, function(err) {
        this.releaseConnection(db);
        if (err) reject(err);
        else resolve(this);
      });
    });
  }

  get(sql, params = []) {
    return new Promise((resolve, reject) => {
      const db = this.getConnection();
      db.get(sql, params, (err, row) => {
        this.releaseConnection(db);
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  all(sql, params = []) {
    return new Promise((resolve, reject) => {
      const db = this.getConnection();
      db.all(sql, params, (err, rows) => {
        this.releaseConnection(db);
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  close() {
    this.connections.forEach(db => db.close());
  }
}

module.exports = DatabasePool;
