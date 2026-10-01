const fs = require('fs');
const path = require('path');

/**
 * Automated database backup service
 * Creates timestamped backups and maintains retention policy
 */

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const DB_FILE = path.join(__dirname, '..', 'data', 'database.db');
const SESSIONS_FILE = path.join(__dirname, '..', 'data', 'sessions.db');
const MAX_BACKUPS = 30; // Keep 30 backups

// Ensure backup directory exists
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

// Create a backup
function createBackup() {
  ensureBackupDir();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  
  try {
    if (fs.existsSync(DB_FILE)) {
      const backupPath = path.join(BACKUP_DIR, `database_${timestamp}.db`);
      fs.copyFileSync(DB_FILE, backupPath);
      console.log(`✅ Database backed up: ${backupPath}`);
    }
    
    if (fs.existsSync(SESSIONS_FILE)) {
      const backupPath = path.join(BACKUP_DIR, `sessions_${timestamp}.db`);
      fs.copyFileSync(SESSIONS_FILE, backupPath);
      console.log(`✅ Sessions backed up: ${backupPath}`);
    }
    
    // Cleanup old backups
    cleanupOldBackups();
    return true;
  } catch (error) {
    console.error('❌ Backup error:', error.message);
    return false;
  }
}

// Remove backups older than retention policy
function cleanupOldBackups() {
  try {
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('database_') || f.startsWith('sessions_'))
      .sort()
      .reverse();
    
    if (files.length > MAX_BACKUPS) {
      const toDelete = files.slice(MAX_BACKUPS);
      toDelete.forEach(file => {
        fs.unlinkSync(path.join(BACKUP_DIR, file));
      });
      console.log(`✅ Cleaned up ${toDelete.length} old backups`);
    }
  } catch (error) {
    console.error('❌ Cleanup error:', error.message);
  }
}

// Schedule backups - run every 6 hours
function scheduleBackups() {
  console.log('📅 Database backup scheduler started');
  
  // Run backup immediately on startup
  createBackup();
  
  // Schedule every 6 hours
  setInterval(createBackup, 6 * 60 * 60 * 1000);
}

module.exports = {
  createBackup,
  scheduleBackups,
  cleanupOldBackups
};
