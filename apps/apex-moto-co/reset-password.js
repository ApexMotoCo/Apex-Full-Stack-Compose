// Reset website login passwords (users table).
//
// Usage (inside the running container):
//   docker compose exec web node reset-password.js adam@apexingoodcompany.co.uk adamgore462@gmail.com
//
// You are prompted for each new password (each character shows as *).
// Nothing is stored in plain text: passwords are saved as bcrypt hashes.
// NOTE: this is for the website `users` table. The Workshop app uses
// `workshop_users` and is reset with setpw.js instead.

const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');
const { validatePasswordStrength } = require('./utils/password-validator');

const emails = process.argv.slice(2).map(e => e.trim()).filter(Boolean);
if (!emails.length) {
  console.error('Usage: node reset-password.js <email> [<email> ...]');
  process.exit(1);
}

const db = new sqlite3.Database(path.join(__dirname, 'data', 'database.db'));
const run = (sql, params) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) { err ? reject(err) : resolve(this.changes); }));
const get = (sql, params) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));

// Prompt that shows * for each typed character (so you can see typing is working).
function askHidden(question) {
  return new Promise(resolve => {
    // No interactive terminal (e.g. docker exec -T): fall back to a normal prompt.
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      return rl.question(question + '(visible) ', a => { rl.close(); resolve(a); });
    }

    process.stdout.write(question);
    let value = '';
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    const onKey = (str, key = {}) => {
      if (key.ctrl && key.name === 'c') {
        process.stdin.setRawMode(false);
        process.stdout.write('\n');
        process.exit(130);
      }
      if (key.name === 'return' || key.name === 'enter') {
        process.stdin.setRawMode(false);
        process.stdin.removeListener('keypress', onKey);
        process.stdin.pause();
        process.stdout.write('\n');
        return resolve(value);
      }
      if (key.name === 'backspace') {
        if (value.length) { value = value.slice(0, -1); process.stdout.write('\b \b'); }
        return;
      }
      if (str && !key.ctrl && !key.meta && str >= ' ') {
        value += str;
        process.stdout.write('*');
      }
    };
    process.stdin.on('keypress', onKey);
  });
}

(async () => {
  try {
    for (const email of emails) {
      const user = await get('SELECT id, username, email FROM users WHERE LOWER(email) = LOWER(?)', [email]);
      if (!user) {
        console.log(`\n✗ No website user found with email ${email} (skipped)`);
        continue;
      }
      console.log(`\nResetting password for ${user.email} (username: ${user.username || '-'})`);

      let password;
      for (;;) {
        password = await askHidden('New password: ');
        const check = validatePasswordStrength(password);
        if (!check.isStrong) {
          console.log('  Too weak. Needs: ' + check.missing.join(', '));
          continue;
        }
        const again = await askHidden('Confirm password: ');
        if (again !== password) { console.log('  Passwords did not match, try again.'); continue; }
        break;
      }

      const changes = await run('UPDATE users SET password = ? WHERE id = ?', [bcrypt.hashSync(password, 10), user.id]);
      console.log(changes === 1 ? `✓ Password updated for ${user.email}` : `✗ Update failed for ${user.email}`);
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
})();
