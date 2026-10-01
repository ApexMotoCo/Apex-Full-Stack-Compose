'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function makeRandomToken(bytes = 48) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function makeAccessToken(user, sessionId, secret) {
  const exp = Math.floor(Date.now() / 1000) + ACCESS_TTL_SECONDS;
  const payload = [user.id, sessionId, exp].join('.');
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  return `${payload}.${signature}`;
}

function verifyAccessToken(raw, secret) {
  const [uid, sessionId, exp, signature] = String(raw || '').split('.');

  if (
    !uid ||
    !sessionId ||
    !exp ||
    !signature ||
    !/^\d+$/.test(uid) ||
    !/^\d+$/.test(exp)
  ) {
    return null;
  }

  if (Number(exp) <= Math.floor(Date.now() / 1000)) {
    return null;
  }

  const payload = `${uid}.${sessionId}.${exp}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);

  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  return {
    userId: Number(uid),
    sessionId,
    exp: Number(exp)
  };
}

function initWorkshopAuth(db) {
  db.serialize(() => {
    db.run(`
      CREATE TABLE IF NOT EXISTS workshop_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'detailer',
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    db.run(`
      CREATE TABLE IF NOT EXISTS workshop_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        refresh_token_hash TEXT UNIQUE NOT NULL,
        device_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL,
        last_used_at DATETIME,
        revoked_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES workshop_users(id)
      )
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_workshop_sessions_user
      ON workshop_sessions(user_id)
    `);

    db.run(`
      CREATE INDEX IF NOT EXISTS idx_workshop_sessions_refresh
      ON workshop_sessions(refresh_token_hash)
    `);
  });
}

function registerWorkshopAuth(app, db, options = {}) {
  const secret = options.secret || process.env.WORKSHOP_AUTH_SECRET;
  const loginLimiter = options.loginLimiter;

  if (!secret || secret.length < 32) {
    console.warn(
      '[WORKSHOP AUTH] WORKSHOP_AUTH_SECRET is missing or shorter than 32 characters. Set a dedicated secret in production.'
    );
  }

  initWorkshopAuth(db);

  const requireSecret = (res) => {
    if (!secret || secret.length < 32) {
      res.status(503).json({ error: 'Workshop authentication is not configured.' });
      return false;
    }
    return true;
  };

  function loadUser(userId, done) {
    db.get(
      `
        SELECT
          id,
          username,
          email,
          display_name,
          role,
          is_active,
          last_login
        FROM workshop_users
        WHERE id = ?
      `,
      [userId],
      (err, user) => {
        if (err || !user || Number(user.is_active) !== 1) {
          return done(null);
        }
        done(user);
      }
    );
  }

  function createSession(user, deviceName, done) {
    const sessionId = crypto.randomBytes(18).toString('hex');
    const refreshToken = makeRandomToken(48);
    const refreshHash = hashToken(refreshToken);
    const expiresAt = new Date(
      Date.now() + REFRESH_TTL_SECONDS * 1000
    ).toISOString();

    db.run(
      `
        INSERT INTO workshop_sessions
        (id, user_id, refresh_token_hash, device_name, expires_at, last_used_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `,
      [sessionId, user.id, refreshHash, deviceName || 'APEX Detailing Android', expiresAt],
      function insertSession(err) {
        if (err) return done(err);

        done(null, {
          accessToken: makeAccessToken(user, sessionId, secret),
          refreshToken,
          expiresIn: ACCESS_TTL_SECONDS,
          refreshExpiresAt: expiresAt,
          user: publicUser(user)
        });
      }
    );
  }

  function publicUser(user) {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      display_name: user.display_name || user.username || user.email,
      role: user.role
    };
  }

  function bearerToken(req) {
    const header = req.get('authorization') || '';
    if (!header.startsWith('Bearer ')) return null;
    return header.slice(7).trim();
  }

  function authenticate(req, res, next) {
    if (!requireSecret(res)) return;

    const token = bearerToken(req);
    const parsed = verifyAccessToken(token, secret);

    if (!parsed) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    db.get(
      `
        SELECT
          s.id AS session_id,
          s.expires_at,
          s.revoked_at,
          u.id,
          u.username,
          u.email,
          u.display_name,
          u.role,
          u.is_active
        FROM workshop_sessions s
        JOIN workshop_users u ON u.id = s.user_id
        WHERE s.id = ?
          AND s.user_id = ?
      `,
      [parsed.sessionId, parsed.userId],
      (err, row) => {
        if (
          err ||
          !row ||
          Number(row.is_active) !== 1 ||
          row.revoked_at ||
          !row.expires_at ||
          new Date(row.expires_at).getTime() <= Date.now()
        ) {
          return res.status(401).json({ error: 'Invalid or expired access token' });
        }

        req.workshopUser = row;
        req.workshopSessionId = parsed.sessionId;
        next();
      }
    );
  }

  app.post(
    '/api/workshop/auth/login',
    ...(loginLimiter ? [loginLimiter] : []),
    async (req, res) => {
      if (!requireSecret(res)) return;

      const email = String(req.body.email || '').trim().toLowerCase();
      const password = String(req.body.password || '');
      const deviceName = String(req.body.device_name || 'APEX Detailing Android').trim().slice(0, 100);

      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      db.get(
        `
          SELECT *
          FROM workshop_users
          WHERE LOWER(email) = LOWER(?)
             OR LOWER(username) = LOWER(?)
        `,
        [email, email],
        async (err, user) => {
          if (err) {
            console.error('[WORKSHOP AUTH] Login lookup failed:', err.message);
            return res.status(500).json({ error: 'Unable to sign in.' });
          }

          if (!user) {
            console.log('[WORKSHOP AUTH] User not found for email:', email);
            return res.status(401).json({ error: 'Invalid credentials.' });
          }

          if (Number(user.is_active) !== 1) {
            console.log('[WORKSHOP AUTH] User inactive for email:', email);
            return res.status(401).json({ error: 'Invalid credentials.' });
          }

          let valid = false;
          try {
            valid = await bcrypt.compare(password, user.password);
            console.log('[WORKSHOP AUTH] Password comparison for', email, ':', valid);
          } catch (compareError) {
            console.error('[WORKSHOP AUTH] Password comparison failed:', compareError.message);
          }

          if (!valid) {
            console.log('[WORKSHOP AUTH] Invalid password for email:', email);
            return res.status(401).json({ error: 'Invalid credentials.' });
          }

          db.run(
            `UPDATE workshop_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`,
            [user.id],
            (updateErr) => {
              if (updateErr) {
                console.error('[WORKSHOP AUTH] Last login update failed:', updateErr.message);
              }

              createSession(user, deviceName, (sessionErr, result) => {
                if (sessionErr) {
                  console.error('[WORKSHOP AUTH] Session creation failed:', sessionErr.message);
                  return res.status(500).json({ error: 'Unable to create workshop session.' });
                }

                res.json(result);
              });
            }
          );
        }
      );
    }
  );

  app.post('/api/workshop/auth/refresh', (req, res) => {
    if (!requireSecret(res)) return;

    const refreshToken = String(req.body.refresh_token || '').trim();
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required.' });
    }

    const refreshHash = hashToken(refreshToken);

    db.get(
      `
        SELECT
          s.id AS session_id,
          s.user_id,
          s.expires_at,
          s.revoked_at,
          u.username,
          u.email,
          u.display_name,
          u.role,
          u.is_active
        FROM workshop_sessions s
        JOIN workshop_users u ON u.id = s.user_id
        WHERE s.refresh_token_hash = ?
      `,
      [refreshHash],
      (err, session) => {
        if (
          err ||
          !session ||
          session.revoked_at ||
          Number(session.is_active) !== 1 ||
          !session.expires_at ||
          new Date(session.expires_at).getTime() <= Date.now()
        ) {
          return res.status(401).json({ error: 'Invalid or expired refresh token.' });
        }

        const user = {
          id: session.user_id,
          username: session.username,
          email: session.email,
          display_name: session.display_name,
          role: session.role,
          is_active: session.is_active
        };

        const nextRefreshToken = makeRandomToken(48);
        const nextHash = hashToken(nextRefreshToken);

        db.run(
          `
            UPDATE workshop_sessions
            SET refresh_token_hash = ?, last_used_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `,
          [nextHash, session.session_id],
          (updateErr) => {
            if (updateErr) {
              console.error('[WORKSHOP AUTH] Refresh rotation failed:', updateErr.message);
              return res.status(500).json({ error: 'Unable to refresh workshop session.' });
            }

            res.json({
              accessToken: makeAccessToken(user, session.session_id, secret),
              refreshToken: nextRefreshToken,
              expiresIn: ACCESS_TTL_SECONDS,
              user: publicUser(user)
            });
          }
        );
      }
    );
  });

  app.post('/api/workshop/auth/logout', (req, res) => {
    const refreshToken = String(req.body.refresh_token || '').trim();

    if (refreshToken) {
      db.run(
        `UPDATE workshop_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE refresh_token_hash = ?`,
        [hashToken(refreshToken)],
        () => res.json({ ok: true })
      );
      return;
    }

    const token = bearerToken(req);
    const parsed = verifyAccessToken(token, secret || '');

    if (parsed) {
      db.run(
        `UPDATE workshop_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [parsed.sessionId],
        () => res.json({ ok: true })
      );
      return;
    }

    res.json({ ok: true });
  });

  app.get('/api/workshop/auth/session', authenticate, (req, res) => {
    res.json({
      authenticated: true,
      user: publicUser(req.workshopUser)
    });
  });

  return {
    authenticate,
    publicUser
  };
}

async function createWorkshopUser(db, { email, password, username, displayName, role = 'detailer' }) {
  if (!email || !password) {
    throw new Error('email and password are required');
  }

  const hash = await bcrypt.hash(password, 12);

  return new Promise((resolve, reject) => {
    db.run(
      `
        INSERT INTO workshop_users
        (username, email, password, display_name, role, is_active)
        VALUES (?, ?, ?, ?, ?, 1)
        ON CONFLICT(email) DO UPDATE SET
          username = excluded.username,
          password = excluded.password,
          display_name = excluded.display_name,
          role = excluded.role,
          is_active = 1
      `,
      [username || email, email.toLowerCase(), hash, displayName || username || email, role],
      function onDone(err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

module.exports = {
  registerWorkshopAuth,
  initWorkshopAuth,
  createWorkshopUser,
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS
};
