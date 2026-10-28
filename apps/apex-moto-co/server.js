const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const crypto = require('crypto');
const multer = require('multer');
const { registerDetailingMobileApi } = require('./website-api/detailing-mobile-api');
const { registerWorkshopAuth } = require('./services/workshop-auth');

const { logAction } = require('./services/audit');
const { csrfProtection, validateCSRF } = require('./middleware/csrf');
const { requestLogger } = require('./middleware/request-logger');
const {
  getOptedInRecipientCount,
  sendMarketingCampaign,
  sendDueMarketingCampaigns,
  verifyUnsubscribeToken
} = require('./services/marketing-campaigns');
const {
  generateMarketingDraft,
  validateMarketingBrief
} = require('./services/marketing-assistant');
const {
  contactFormLimiter,
  loginLimiter,
  passwordResetLimiter,
  marketingAssistantLimiter
} = require('./middleware/rate-limiters');

const {
  createPaymentIntent,
  handlePaymentWebhook,
  getPaymentStatus,
  stripe
} = require('./services/stripe-service');

dotenv.config();

const app = express();

if (!process.env.SESSION_SECRET) {
  console.warn('SESSION_SECRET is not configured; sessions will reset when the process restarts.');
}

// ============================================================
// DATABASE
// ============================================================

const db = new sqlite3.Database(
  path.join(__dirname, 'data', 'database.db')
);
db.configure('busyTimeout', 5000);
const galleryDirectory = path.join(__dirname, 'data', 'gallery');
fs.mkdirSync(galleryDirectory, { recursive: true });
const detailingPhotoDirectory = path.join(__dirname, 'data', 'detailing-jobs');
fs.mkdirSync(detailingPhotoDirectory, { recursive: true });
const galleryUpload = multer({
  storage: multer.diskStorage({
    destination: galleryDirectory,
    filename: (req, file, callback) => {
      const extension = path.extname(file.originalname).toLowerCase();
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
    }
  }),
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return callback(new Error('Only JPEG, PNG, WebP and GIF images are supported.'));
    }
    callback(null, true);
  },
  limits: { fileSize: 10 * 1024 * 1024 }
});
const bookingPhotoUpload = multer({
  storage: multer.diskStorage({
    destination: detailingPhotoDirectory,
    filename: (req, file, callback) => {
      const extensions = {
        'image/jpeg': '.jpg',
        'image/png': '.png',
        'image/webp': '.webp',
        'image/gif': '.gif'
      };
      const extension = extensions[file.mimetype];
      callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension}`);
    }
  }),
  fileFilter: (req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype)) {
      return callback(new Error('Upload JPEG, PNG, WebP or GIF photos.'));
    }
    callback(null, true);
  },
  limits: { files: 5, fileSize: 8 * 1024 * 1024 }
});

// ============================================================
// MIDDLEWARE
// ============================================================

app.use(express.urlencoded({
  limit: '50mb',
  extended: true
}));

app.use(express.json({
  limit: '50mb'
}));

app.use(express.static('public'));
app.use((req, res, next) => {
  if (req.path.match(/\.\(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot\)$/)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000');
  }
  next();
});


app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: './data'
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
}));

// CSRF protection MUST run after the session middleware.
app.use(csrfProtection);

// Make the CSRF token available to every EJS view.
app.use((req, res, next) => {
  try {
    if (typeof req.csrfToken === 'function') {
      res.locals.csrfToken = req.csrfToken();
    } else {
      res.locals.csrfToken =
        req.session && req.session.csrfToken
          ? req.session.csrfToken
          : '';
    }
  } catch (error) {
    console.error(
      'CSRF token generation error:',
      error.message
    );

    res.locals.csrfToken = '';
  }

  next();
});

// Make logged-in user available to every view.
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  const metadata = {
    '/': ['ApexMoto&Co | Motorcycle Lifestyle, Detailing & Servicing', 'Apex Moto & Co. motorcycle lifestyle, detailing, store and basic motorcycle servicing.'],
    '/about': ['About ApexMoto&Co', 'Learn about Apex Moto & Co. and our motorcycle lifestyle, detailing and servicing offering.'],
    '/contact': ['Contact ApexMoto&Co', 'Contact Apex Moto & Co. for general, shop, events, detailing and motorcycle servicing enquiries.'],
    '/store': ['ApexMoto&Co Store', 'Shop Apex Moto & Co. products and complete secure checkout through Shopify.'],
    '/detailing': ['Apex Moto Detailing', 'Premium motorcycle detailing and vehicle care from Apex Moto & Co.'],
    '/detailing/services': ['Basic Motorcycle Servicing', 'Professional basic motorcycle servicing and routine motorcycle maintenance from Apex Moto Detailing.'],
    '/services': ['Basic Motorcycle Servicing | ApexMoto&Co', 'Professional basic motorcycle servicing and routine motorcycle maintenance from Apex Moto & Co.'],
    '/events': ['ApexMoto&Co Events', 'Find upcoming Apex Moto & Co. motorcycle events and community activities.']
  };
  const pageMetadata = metadata[req.path] || ['ApexMoto&Co', 'Apex Moto & Co. motorcycle lifestyle, detailing, store and servicing.'];
  res.locals.pageTitle = pageMetadata[0];
  res.locals.metaDescription = pageMetadata[1];
  res.locals.canonicalUrl = `https://apexingoodcompany.co.uk${req.path === '/' ? '/' : req.path}`;
  res.locals.isPublicPage = !req.path.startsWith('/admin');
  res.locals.currentPath = req.path;
  res.locals.newsletterStatus = ['success', 'error'].includes(req.query.newsletter)
    ? req.query.newsletter
    : '';
  res.locals.profileMarketingStatus = ['updated', 'missing-email', 'error'].includes(req.query.marketing)
    ? req.query.marketing
    : '';
  next();
});

// Request logging
app.use(requestLogger);

// ============================================================
// VIEW ENGINE
// ============================================================

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ============================================================
// DATABASE INITIALISATION
// ============================================================

function initDB() {
  db.serialize(() => {

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT,
      email TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    totp_secret TEXT,
    totp_enabled INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      scheduled_at DATETIME,
      status TEXT NOT NULL DEFAULT 'draft',
      recipient_count INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failure_count INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME,
      FOREIGN KEY(created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS marketing_subscribers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      consented_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      unsubscribed_at DATETIME
    )
  `);

  db.run(
    `ALTER TABLE users ADD COLUMN last_login DATETIME`,
    (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Unable to add users.last_login:', err.message);
      }
    }
  );

  [
    ['marketing_consent', 'INTEGER NOT NULL DEFAULT 0'],
    ['marketing_consent_at', 'DATETIME'],
    ['marketing_unsubscribed_at', 'DATETIME']
  ].forEach(([column, definition]) => {
    db.run(`ALTER TABLE users ADD COLUMN ${column} ${definition}`, (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error(`Unable to add users.${column}:`, err.message);
      }
    });
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS contact_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      department TEXT,
      subject TEXT,
      message TEXT,
      email_status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`ALTER TABLE contact_messages ADD COLUMN department TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Unable to add contact_messages.department:', err.message);
    }
  });
  db.run(`ALTER TABLE contact_messages ADD COLUMN email_status TEXT DEFAULT 'pending'`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Unable to add contact_messages.email_status:', err.message);
    }
  });

  db.run(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT,
      phone TEXT,
      vehicle_type TEXT,
      service_type TEXT,
      booking_date DATE,
      booking_time TIME,
      notes TEXT,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT,
      created_by INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id INTEGER PRIMARY KEY,
      site_name TEXT,
      site_tagline TEXT,
      hero_title TEXT,
      hero_subtitle TEXT,
      about_section_1 TEXT,
      about_section_2 TEXT,
      about_section_3 TEXT,
      footer_copyright TEXT,
      social_facebook TEXT,
      social_instagram TEXT,
      social_twitter TEXT,
      social_youtube TEXT,
      privacy_content TEXT,
      terms_content TEXT,
      cookies_content TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      event_date DATE,
      event_time TIME,
      location TEXT,
      created_by INTEGER,
      status TEXT DEFAULT 'upcoming',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS gallery_images (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      title TEXT,
      alt_text TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const configuredAdmins = [
    ['adamgore', process.env.ADMIN_PASSWORD_1, process.env.ADMIN_EMAIL_1],
    ['jordan', process.env.ADMIN_PASSWORD_2, process.env.ADMIN_EMAIL_2]
  ];
  configuredAdmins.forEach(([username, password, email]) => {
    if (!password || !email) {
      console.warn(`Admin seed skipped for ${username}: ADMIN_EMAIL and ADMIN_PASSWORD are required.`);
      return;
    }
    db.run(
      `INSERT OR IGNORE INTO users (username, password, email, role) VALUES (?, ?, ?, ?)`,
      [username, bcrypt.hashSync(password, 10), email, 'admin']
    );
  });
  });
}

initDB();

// ============================================================
// AUTO BACKUP
// ============================================================

(function () {

  const fs = require('fs');

  const BACKUP_DIR =
    path.join(__dirname, 'backups');

  const DB_FILE =
    path.join(__dirname, 'data', 'database.db');

  function backup() {

    try {

      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, {
          recursive: true
        });
      }

      const ts = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5);

      if (fs.existsSync(DB_FILE)) {

        fs.copyFileSync(
          DB_FILE,
          path.join(
            BACKUP_DIR,
            `database_${ts}.db`
          )
        );

      }

      // Keep the latest 30 backups.
      const files = fs
        .readdirSync(BACKUP_DIR)
        .filter(file =>
          file.startsWith('database_')
        )
        .sort()
        .reverse();

      files
        .slice(30)
        .forEach(file => {
          fs.unlinkSync(
            path.join(BACKUP_DIR, file)
          );
        });

    } catch (e) {

      console.error(
        'Backup error:',
        e.message
      );

    }
  }

  backup();

  setInterval(
    backup,
    6 * 60 * 60 * 1000
  );

})();
// ============================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================

function requireAdminBase(req, res, next) {

  if (
    !req.session.user ||
    req.session.user.role !== 'admin'
  ) {
    return res.status(403).render('error', {
      message: 'Access Denied'
    });
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).render('error', {
      message: 'Access Denied'
    });
  }

  // Admins without 2FA enabled can use the admin area normally.
  // Admins with 2FA enabled must complete the second factor first.
  if (Number(req.session.user.totp_enabled) === 1 && req.session.authenticated2FA !== true) {
    return res.redirect('/admin/2fa-verify');
  }

  next();
}

function requireLogViewer(req, res, next) {
  if (!req.session.user || String(req.session.user.id) !== '3') {
    return res.status(403).render('error', {
      message: 'Access Denied'
    });
  }

  next();
}

function requireLogin(req, res, next) {

  if (!req.session.user) {
    return res.redirect('/login');
  }

  next();
}

app.get('/profile', requireLogin, (req, res) => {
  res.render('profile', { user: req.session.user });
});

app.post('/profile/marketing-preference', requireLogin, validateCSRF, (req, res) => {
  const wantsMarketing = req.body.marketing_consent === 'on';
  const userId = req.session.user.id;

  if (wantsMarketing && !String(req.session.user.email || '').trim()) {
    return res.redirect('/profile?marketing=missing-email#marketing-preferences');
  }

  const query = wantsMarketing
    ? `UPDATE users
       SET marketing_consent = 1,
           marketing_consent_at = CASE
             WHEN marketing_consent = 1 AND marketing_consent_at IS NOT NULL
             THEN marketing_consent_at
             ELSE CURRENT_TIMESTAMP
           END,
           marketing_unsubscribed_at = NULL
       WHERE id = ?`
    : `UPDATE users
       SET marketing_consent = 0,
           marketing_unsubscribed_at = CASE
             WHEN marketing_consent = 1 THEN CURRENT_TIMESTAMP
             ELSE marketing_unsubscribed_at
           END
       WHERE id = ?`;

  db.run(query, [userId], function (error) {
    if (error) {
      console.error('Unable to update marketing preference:', error.message);
      return res.redirect('/profile?marketing=error#marketing-preferences');
    }

    req.session.user.marketing_consent = wantsMarketing ? 1 : 0;
    return res.redirect('/profile?marketing=updated#marketing-preferences');
  });
});

// ============================================================
// ADMIN MARKETING ASSISTANT
// ============================================================

app.get('/admin/marketing-assistant', requireAdmin, (req, res) => {
  getOptedInRecipientCount(db)
    .then((recipientCount) => {
      res.render('admin/marketing-assistant', { recipientCount });
    })
    .catch((error) => {
      console.error('Unable to count opted-in marketing recipients:', error.message);
      res.status(500).render('error', { message: 'Unable to load the marketing assistant.' });
    });
});

app.get('/admin/marketing-campaigns', requireAdmin, (req, res) => {
  db.all(
    `SELECT id, name, subject, body, scheduled_at, status, recipient_count,
            sent_count, failure_count, last_error, created_at, sent_at
     FROM marketing_campaigns
     ORDER BY created_at DESC
     LIMIT 50`,
    (err, campaigns) => {
      if (err) {
        console.error('Unable to load marketing campaigns:', err.message);
        return res.status(500).render('error', { message: 'Unable to load marketing campaigns.' });
      }
      getOptedInRecipientCount(db)
        .then((recipientCount) => {
          res.render('admin/marketing-campaigns', {
            campaigns: campaigns || [],
            recipientCount
          });
        })
        .catch((countError) => {
          console.error('Unable to count opted-in marketing recipients:', countError.message);
          res.status(500).render('error', { message: 'Unable to load marketing campaigns.' });
        });
    }
  );
});

app.post('/admin/marketing-campaigns', requireAdmin, validateCSRF, async (req, res) => {
  const { name, subject, body, scheduledAt, action } = req.body || {};
  if (typeof name !== 'string' || typeof subject !== 'string' || typeof body !== 'string' ||
      typeof action !== 'string' || !['draft', 'schedule'].includes(action)) {
    return res.status(400).json({ error: 'Complete the campaign name, subject, content and action.' });
  }

  const campaignName = name.trim();
  const campaignSubject = subject.trim();
  const campaignBody = body.trim();
  if (!campaignName || campaignName.length > 120 || !campaignSubject ||
      campaignSubject.length > 200 || !campaignBody || campaignBody.length > 20000) {
    return res.status(400).json({ error: 'Check the campaign field lengths and make sure no required fields are empty.' });
  }

  let scheduledDate = null;
  if (action === 'schedule') {
    scheduledDate = new Date(scheduledAt);
    if (!scheduledAt || Number.isNaN(scheduledDate.getTime()) ||
        scheduledDate.getTime() < Date.now() + 5 * 60 * 1000) {
      return res.status(400).json({ error: 'Choose a send time at least five minutes in the future.' });
    }
  }

  try {
    const recipientCount = await getOptedInRecipientCount(db);
    if (recipientCount < 1) {
      return res.status(400).json({ error: 'There are no opted-in email subscribers yet.' });
    }
    const status = action === 'schedule' ? 'scheduled' : 'draft';
    const scheduledAtUtc = scheduledDate ? scheduledDate.toISOString() : null;
    db.run(
      `INSERT INTO marketing_campaigns
       (name, subject, body, scheduled_at, status, recipient_count, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [campaignName, campaignSubject, campaignBody, scheduledAtUtc, status, recipientCount, req.session.user.id],
      function (err) {
        if (err) {
          console.error('Unable to save marketing campaign:', err.message);
          return res.status(500).json({ error: 'Unable to save this campaign.' });
        }
        return res.status(201).json({
          id: this.lastID,
          status,
          recipientCount,
          message: status === 'scheduled' ? 'Campaign scheduled.' : 'Campaign saved as a draft.'
        });
      }
    );
  } catch (error) {
    console.error('Unable to prepare marketing campaign:', error.message);
    return res.status(500).json({ error: 'Unable to prepare this campaign.' });
  }
});

app.post(
  '/admin/marketing-campaigns/:id/send',
  requireAdmin,
  marketingAssistantLimiter,
  validateCSRF,
  async (req, res) => {
    const campaignId = Number(req.params.id);
    if (!Number.isSafeInteger(campaignId) || campaignId < 1) {
      return res.status(400).json({ error: 'Invalid campaign.' });
    }
    try {
      await sendMarketingCampaign(db, campaignId);
      return res.json({ message: 'Campaign sending has finished.' });
    } catch (error) {
      if (error.statusCode) return res.status(error.statusCode).json({ error: error.message });
      console.error('Marketing campaign send failed:', error.message);
      return res.status(500).json({ error: 'Unable to send this campaign.' });
    }
  }
);

app.post('/admin/marketing-campaigns/:id/cancel', requireAdmin, validateCSRF, (req, res) => {
  const campaignId = Number(req.params.id);
  if (!Number.isSafeInteger(campaignId) || campaignId < 1) {
    return res.status(400).json({ error: 'Invalid campaign.' });
  }
  db.run(
    `UPDATE marketing_campaigns
     SET status = 'cancelled', scheduled_at = NULL
     WHERE id = ? AND status = 'scheduled'`,
    [campaignId],
    function (err) {
      if (err) {
        console.error('Unable to cancel marketing campaign:', err.message);
        return res.status(500).json({ error: 'Unable to cancel this campaign.' });
      }
      if (!this.changes) return res.status(409).json({ error: 'This campaign is no longer scheduled.' });
      return res.json({ message: 'Scheduled campaign cancelled.' });
    }
  );
});

app.get('/unsubscribe/:token', (req, res) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const validToken = verifyUnsubscribeToken(req.params.token);
  if (!validToken) {
    return res.status(400).render('marketing-unsubscribe', { token: '', invalid: true, success: false });
  }
  db.get(
    `SELECT id FROM users
     WHERE id = ? AND marketing_consent = 1 AND marketing_consent_at = ?`,
    [validToken.userId, validToken.consentedAt],
    (err, user) => {
      if (err) {
        console.error('Unable to check marketing unsubscribe:', err.message);
        return res.status(500).render('error', { message: 'Unable to process this unsubscribe request.' });
      }
      if (!user) return res.render('marketing-unsubscribe', { token: '', invalid: true, success: false });
      return res.render('marketing-unsubscribe', { token: req.params.token, invalid: false, success: false });
    }
  );
});

app.post('/unsubscribe/:token', (req, res) => {
  const validToken = verifyUnsubscribeToken(req.params.token);
  if (!validToken) return res.status(400).render('marketing-unsubscribe', { token: '', invalid: true, success: false });

  const unsubscribe = validToken.source === 'subscriber'
    ? {
      sql: `UPDATE marketing_subscribers
            SET unsubscribed_at = CURRENT_TIMESTAMP
            WHERE id = ? AND consented_at = ? AND unsubscribed_at IS NULL`,
      params: [validToken.userId, validToken.consentedAt]
    }
    : {
      sql: `UPDATE users
            SET marketing_consent = 0, marketing_unsubscribed_at = CURRENT_TIMESTAMP
            WHERE id = ? AND marketing_consent = 1 AND marketing_consent_at = ?`,
      params: [validToken.userId, validToken.consentedAt]
    };

  db.run(unsubscribe.sql, unsubscribe.params, function (err) {
    if (err) {
      console.error('Unable to update marketing consent:', err.message);
      return res.status(500).render('error', { message: 'Unable to process this unsubscribe request.' });
    }
    return res.render('marketing-unsubscribe', {
      token: '',
      invalid: !this.changes,
      success: Boolean(this.changes)
    });
  });
});

app.post('/marketing/subscribe', validateCSRF, (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  const consent = req.body.marketing_consent === 'on';
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || email.length > 254 || !emailPattern.test(email) || !consent) {
    return res.redirect('/?newsletter=error#newsletter');
  }

  db.get(
    'SELECT id FROM users WHERE lower(trim(email)) = lower(trim(?)) ORDER BY id LIMIT 1',
    [email],
    (lookupError, user) => {
      if (lookupError) {
        console.error('Unable to check marketing signup:', lookupError.message);
        return res.status(500).render('error', { message: 'Unable to process your signup right now.' });
      }

      if (user) {
        return db.run(
          `UPDATE users
           SET marketing_consent = 1, marketing_consent_at = CURRENT_TIMESTAMP,
               marketing_unsubscribed_at = NULL
           WHERE id = ?`,
          [user.id],
          (updateError) => {
            if (updateError) {
              console.error('Unable to save marketing signup:', updateError.message);
              return res.status(500).render('error', { message: 'Unable to process your signup right now.' });
            }
            return res.redirect('/?newsletter=success#newsletter');
          }
        );
      }

      db.run(
        `INSERT INTO marketing_subscribers (email, consented_at, unsubscribed_at)
         VALUES (?, CURRENT_TIMESTAMP, NULL)
         ON CONFLICT(email) DO UPDATE SET
           consented_at = CURRENT_TIMESTAMP,
           unsubscribed_at = NULL`,
        [email],
        (insertError) => {
          if (insertError) {
            console.error('Unable to save marketing signup:', insertError.message);
            return res.status(500).render('error', { message: 'Unable to process your signup right now.' });
          }
          return res.redirect('/?newsletter=success#newsletter');
        }
      );
    }
  );
});

app.post(
  '/admin/marketing-assistant/generate',
  requireAdmin,
  marketingAssistantLimiter,
  validateCSRF,
  async (req, res) => {
    const validationError = validateMarketingBrief(req.body || {});
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    try {
      const draft = await generateMarketingDraft(req.body);
      return res.json({ draft });
    } catch (error) {
      if (error.statusCode) {
        return res.status(error.statusCode).json({ error: error.message });
      }

      console.error('Marketing assistant request failed:', error.message);
      return res.status(502).json({
        error: 'The marketing assistant could not reach the AI provider. Please try again.'
      });
    }
  }
);

// ============================================================
// WORKSHOP / APEX DETAILING MOBILE API
// ============================================================
// The Android app authenticates against the dedicated Workshop
// API session, not the normal website session. These registrations
// must happen before the final 404 handler.

const workshopAuth = registerWorkshopAuth(
  app,
  db,
  {
    loginLimiter,
    secret: process.env.WORKSHOP_AUTH_SECRET
  }
);

registerDetailingMobileApi(
  app,
  db,
  {
    requireLogin,
    requireAdmin,
    workshopAuth,
    photoDirectory: detailingPhotoDirectory
  }
);

// ============================================================
// PUBLIC ROUTES
// ============================================================

app.get('/', (req, res) => {

  db.get(
    `SELECT * FROM site_settings WHERE id = 1`,
    (err, settings) => {

      res.render('index', {
        settings: settings || {},
        pageTitle: 'Apex Moto & Co | Premium Motorcycle Detailing & Lifestyle',
        metaDescription: 'Premium motorcycle and vehicle detailing services. Ceramic coating, protection, and maintenance. Join the Apex family.'
      });

    }
  );

});

app.get('/about', (req, res) => {

  db.get(
    `SELECT * FROM site_settings WHERE id = 1`,
    (err, settings) => {

      res.render('about', {
        settings: settings || {}
      });

    }
  );

});

// ============================================================
// LOGIN
// ============================================================

app.get('/login', (req, res) => {
  res.render('login', { csrfToken: res.locals.csrfToken || (req.session && req.session.csrfToken) || '' });
});

app.post(
  '/login',
  loginLimiter,
  validateCSRF,
  (req, res) => {

    const { email, password } = req.body;

    if (!email || !password) {
      return res.render('login', {
        error: 'Invalid credentials'
      });
    }

    db.get(
      `SELECT * FROM users
       WHERE username = ? OR email = ?`,
      [email, email],
      async (err, user) => {

        if (err) {

          console.error(
            'Login database error:',
            err
          );

          return res.render('login', {
            error:
              'Unable to log in. Please try again.'
          });

        }

        if (!user) {

          return res.render('login', {
            error: 'Invalid credentials'
          });

        }

        try {

          // Correct bcrypt hash detection.
          const isBcryptHash =
            typeof user.password === 'string' &&
            /^\$2[aby]?\$\d{2}\$/.test(
              user.password
            );

          let valid = false;

          if (isBcryptHash) {

            valid = await bcrypt.compare(
              password,
              user.password
            );

          } else {

            // Support legacy plaintext passwords.
            valid =
              password === user.password;

            // Upgrade legacy password to bcrypt.
            if (valid) {

              const newHash =
                await bcrypt.hash(
                  password,
                  10
                );

              db.run(
                `UPDATE users
                 SET password = ?
                 WHERE id = ?`,
                [
                  newHash,
                  user.id
                ],
                updateErr => {

                  if (updateErr) {
                    console.error(
                      'Password upgrade error:',
                      updateErr
                    );
                  }

                }
              );

              user.password = newHash;

            }

          }

          if (!valid) {

            return res.render('login', {
              error: 'Invalid credentials'
            });

          }

          db.run(
            `UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`,
            [user.id],
            (updateErr) => {
              if (updateErr) {
                console.error('Last login update error:', updateErr);
                return res.render('login', {
                  error: 'Unable to complete login. Please try again.'
                });
              }

              user.last_login = new Date().toISOString();
              req.session.user = user;
              req.session.authenticated2FA = !(
                user.role === 'admin' &&
                Number(user.totp_enabled) === 1
              );

              if (
                user.role === 'admin' &&
                Number(user.totp_enabled) === 1
              ) {
                return res.redirect('/admin/2fa-verify');
              }

              res.redirect('/admin');
            }
          );

        } catch (loginErr) {

          console.error(
            'Login error:',
            loginErr
          );

          res.render('login', {
            error:
              'Unable to log in. Please try again.'
          });

        }

      }
    );

  }
);

// ============================================================
// LOGOUT
// ============================================================

app.get('/logout', (req, res) => {

  req.session.user = null;
  req.session.authenticated2FA = false;
  delete req.session.temp2FASecret;

  res.redirect('/');

});

// ============================================================
// REGISTRATION
// ============================================================

app.get('/register', (req, res) => {
  res.render('register');
});

app.post(
  '/register',
  validateCSRF,
  async (req, res) => {

    const {
      username,
      email,
      password,
      marketing_consent
    } = req.body;

    if (
      !username ||
      !email ||
      !password
    ) {

      return res.render('register', {
        error:
          'Please complete all fields.'
      });

    }

    try {

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      db.run(
        `
          INSERT INTO users
          (username, email, password, role, marketing_consent, marketing_consent_at)
          VALUES (?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END)
        `,
        [
          username,
          email,
          hashedPassword,
          'user',
          marketing_consent === 'on' ? 1 : 0,
          marketing_consent === 'on' ? 1 : 0
        ],
        err => {

          if (err) {

            console.error(
              'Registration error:',
              err
            );

            return res.render('register', {
              error:
                'Registration failed. Username or email may already exist.'
            });

          }

          res.render('register', {
            success:
              'Account created! Please log in.'
          });

        }
      );

    } catch (err) {

      console.error(
        'Password hashing error:',
        err
      );

      res.render('register', {
        error:
          'Registration failed. Please try again.'
      });

    }

  }
);

// ============================================================
// ADMIN DASHBOARD
// ============================================================

app.get(
  '/admin',
  requireAdmin,
  (req, res) => {

    db.get(
      `SELECT COUNT(*) as bookings
       FROM bookings`,
      (err, bookings) => {

        db.get(
          `SELECT COUNT(*) as announcements
           FROM announcements`,
          (err, announcements) => {

            db.get(
              `SELECT COUNT(*) as users
               FROM users`,
              (err, users) => {

                db.get(
                  `SELECT SUM(total_price) as orders
                   FROM orders
                   WHERE status = 'completed'`,
                  (err, orders) => {

                    const stats = {

                      bookings:
                        bookings
                          ? bookings.bookings
                          : 0,

                      announcements:
                        announcements
                          ? announcements.announcements
                          : 0,

                      users:
                        users
                          ? users.users
                          : 0,

                      orders:
                        orders &&
                        orders.orders
                          ? orders.orders
                          : 0

                    };

                    res.render(
                      'admin/dashboard',
                      { stats }
                    );

                  }
                );

              }
            );

          }
        );

      }
    );

  }
);

// ============================================================
// ADMIN SETTINGS
// ============================================================

app.get(
  '/admin/settings',
  requireAdmin,
  (req, res) => {

    db.get(
      `SELECT * FROM site_settings
       WHERE id = 1`,
      (err, settings) => {

        res.render(
          'admin/settings',
          {
            settings:
              settings || {}
          }
        );

      }
    );

  }
);

app.post(
  '/admin/settings',
  requireAdmin,
  (req, res) => {

    const {
      site_name,
      site_tagline,
      hero_title,
      hero_subtitle,
      about_section_1,
      about_section_2,
      about_section_3,
      footer_copyright,
      social_facebook,
      social_instagram,
      social_twitter,
      social_youtube,
      privacy_content,
      terms_content,
      cookies_content
    } = req.body;

    db.run(
      `
        INSERT OR REPLACE INTO site_settings
        (
          id,
          site_name,
          site_tagline,
          hero_title,
          hero_subtitle,
          about_section_1,
          about_section_2,
          about_section_3,
          footer_copyright,
          social_facebook,
          social_instagram,
          social_twitter,
          social_youtube,
          privacy_content,
          terms_content,
          cookies_content
        )
        VALUES
        (
          1, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?
        )
      `,
      [
        site_name,
        site_tagline,
        hero_title,
        hero_subtitle,
        about_section_1,
        about_section_2,
        about_section_3,
        footer_copyright,
        social_facebook,
        social_instagram,
        social_twitter,
        social_youtube,
        privacy_content,
        terms_content,
        cookies_content
      ],
      err => {

        if (err) {
          return res
            .status(500)
            .send(
              'Error saving settings'
            );
        }

        res.json({
          success: true
        });

      }
    );

  }
);
// ============================================================
// STORE
// ============================================================

app.get('/store', (req, res) => {
  res.redirect(302, 'https://apexapparelsupply.myshopify.com/');
});

app.get('/admin/store', requireAdmin, (req, res) => {
  res.render('admin/store', {
    items: []
  });
});

// ============================================================
// DETAILING
// ============================================================

app.get('/detailing', (req, res) => {
  res.render('detailing/index');
});

app.get('/detailing/booking', (req, res) => {
  res.redirect(301, '/detailing#booking');
});

app.get('/detailing/memberships', (req, res) => {
  res.render('detailing/memberships', { pageTitle: 'Detailing Memberships | Apex Moto Detailing', metaDescription: 'Join our detailing membership program for ongoing vehicle care.' });
});

app.get('/detailing/gallery', (req, res) => {
  db.all(
    'SELECT * FROM gallery_images WHERE active = 1 ORDER BY sort_order ASC, id DESC',
    (err, images) => {
      if (err) {
        console.error('Unable to load gallery images:', err.message);
        return res.status(500).render('error', { message: 'Unable to load the portfolio gallery.' });
      }
      res.render('detailing/portfolio', { images: images || [] });
    }
  );
});

app.get('/uploads/gallery/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(galleryDirectory, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Image not found');
  }
  res.sendFile(filePath);
});

app.get('/admin/gallery', requireAdmin, (req, res) => {
  db.all(
    'SELECT * FROM gallery_images ORDER BY sort_order ASC, id DESC',
    (err, images) => {
      if (err) {
        console.error('Unable to load admin gallery:', err.message);
        return res.status(500).render('error', { message: 'Unable to load the gallery manager.' });
      }
      res.render('admin/gallery', { images: images || [] });
    }
  );
});

app.post('/admin/gallery', requireAdmin, galleryUpload.single('image'), validateCSRF, (req, res) => {
  if (!req.file) {
    return res.status(400).render('error', { message: 'Please select a valid image to upload.' });
  }

  const title = String(req.body.title || '').trim();
  const altText = String(req.body.alt_text || title || 'Apex Moto Detailing portfolio image').trim();
  const sortOrder = Number.isInteger(Number(req.body.sort_order)) ? Number(req.body.sort_order) : 0;

  db.run(
    `INSERT INTO gallery_images (filename, original_name, title, alt_text, sort_order)
     VALUES (?, ?, ?, ?, ?)`,
    [req.file.filename, req.file.originalname, title, altText, sortOrder],
    (err) => {
      if (err) {
        fs.unlink(req.file.path, () => {});
        console.error('Unable to save gallery image:', err.message);
        return res.status(500).render('error', { message: 'Unable to save the gallery image.' });
      }
      res.redirect('/admin/gallery');
    }
  );
});

app.post('/admin/gallery/:id/delete', requireAdmin, validateCSRF, (req, res) => {
  db.get('SELECT filename FROM gallery_images WHERE id = ?', [req.params.id], (findErr, image) => {
    if (findErr || !image) {
      return res.status(404).render('error', { message: 'Gallery image not found.' });
    }
    db.run('DELETE FROM gallery_images WHERE id = ?', [req.params.id], (deleteErr) => {
      if (deleteErr) {
        return res.status(500).render('error', { message: 'Unable to delete the gallery image.' });
      }
      fs.unlink(path.join(galleryDirectory, path.basename(image.filename)), (unlinkErr) => {
        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
          console.error('Unable to delete gallery file:', unlinkErr.message);
        }
        res.redirect('/admin/gallery');
      });
    });
  });
});

app.get('/detailing/services', (req, res) => {
  res.redirect(301, '/services');
});

app.get('/uploads/detailing-jobs/:filename', (req, res) => {
  const filename = path.basename(req.params.filename);
  const filePath = path.join(detailingPhotoDirectory, filename);
  fs.stat(filePath, (err, file) => {
    if (err) {
      if (err.code !== 'ENOENT') {
        console.error('Unable to access detailing photo:', err.message);
      }
      return res.status(err.code === 'ENOENT' ? 404 : 500).send('Photo not found');
    }
    if (!file.isFile()) {
      return res.status(404).send('Photo not found');
    }
    res.sendFile(filePath);
  });
});

function cleanupBookingPhotos(files, callback) {
  const uploadedFiles = files || [];
  if (!uploadedFiles.length) {
    callback();
    return;
  }

  let remaining = uploadedFiles.length;
  uploadedFiles.forEach((file) => {
    fs.unlink(file.path, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.error('Unable to remove rejected booking photo:', err.message);
      }
      remaining -= 1;
      if (remaining === 0) callback();
    });
  });
}

function parseBookingPhotos(req, res, next) {
  bookingPhotoUpload.array('photos', 5)(req, res, (err) => {
    if (!err) {
      return next();
    }

    const status = err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
      ? 413
      : 400;
    cleanupBookingPhotos(req.files, () => {
      res.status(status).json({ error: err.message || 'Unable to upload booking photos.' });
    });
  });
}

app.post('/detailing/book', parseBookingPhotos, (req, res) => {
  const uploadedPhotos = req.files || [];
  const reject = (status, error) => cleanupBookingPhotos(uploadedPhotos, () => {
    res.status(status).json({ error });
  });
  if (uploadedPhotos.length < 4) {
    return reject(400, 'Upload at least four photos of your vehicle to request a detailing booking.');
  }

  const b = req.body || {};
  const clean = (v, max = 500) => String(v == null ? '' : v).trim().slice(0, max);

  const name = clean(b.name, 120);
  const phone = clean(b.phone, 40);
  const email = clean(b.email, 160);
  const vehicleType = clean(b.vehicle_type, 40) || 'Motorcycle';
  // The package string (e.g. "Tier 01: The Express Refresh - From £35") is what the
  // Workshop app reads its price from, so keep it exactly as the form sends it.
  const serviceType = clean(b.service_type || b.treatment, 200);

  const bookingDate = clean(b.booking_date, 20);
  const bookingTime = clean(b.booking_time, 20);

  if (!name || !phone) {
    return reject(400, 'Name and phone number are required');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reject(400, 'Please enter a valid email address');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate)) {
    return reject(400, 'Please choose a preferred date');
  }
  if (bookingTime && !/^\d{2}:\d{2}$/.test(bookingTime)) {
    return reject(400, 'Invalid time');
  }
  if (!serviceType) {
    return reject(400, 'Please select a treatment');
  }

  // Details that have no column of their own are kept in the notes field so the
  // admin dashboard and Workshop app both show them.
  const vehicle = [b.vehicle_make, b.vehicle_model, b.vehicle_year, b.vehicle_colour]
    .map(v => clean(v, 60)).filter(Boolean).join(' ');
  const reg = clean(b.vehicle_registration, 20);
  const extras = clean(b.additional_services, 1000);
  const customerNotes = clean(b.notes, 2000);

  const notes = [
    vehicle && `Vehicle: ${vehicle}`,
    reg && `Reg: ${reg}`,
    extras && `Additional services: ${extras}`,
    customerNotes && `Notes: ${customerNotes}`
  ].filter(Boolean).join('\n');

  db.run(
    `INSERT INTO bookings
       (name, email, phone, vehicle_type, service_type, booking_date, booking_time, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      phone,
      vehicleType,
      serviceType,
      bookingDate,
      bookingTime || null,
      notes || null
    ],
    function (err) {
      if (err) {
        console.error('[BOOKING] Insert failed:', err.message);
        return reject(500, 'Booking failed');
      }

      const bookingId = this.lastID;
      const savePhoto = (index) => {
        if (index >= uploadedPhotos.length) {
          return res.json({ success: true, id: bookingId, message: 'Booking confirmed!' });
        }

        const photo = uploadedPhotos[index];
        db.run(
          `INSERT INTO detailing_job_photos (booking_id, filename, original_name)
           VALUES (?, ?, ?)`,
          [bookingId, path.basename(photo.filename), clean(path.basename(photo.originalname), 255)],
          (photoErr) => {
            if (photoErr) {
              console.error('[BOOKING] Photo record insert failed:', photoErr.message);
              db.run('DELETE FROM detailing_job_photos WHERE booking_id = ?', [bookingId], (deletePhotosErr) => {
                if (deletePhotosErr) {
                  console.error('[BOOKING] Unable to remove partial photo records:', deletePhotosErr.message);
                }
                db.run('DELETE FROM bookings WHERE id = ?', [bookingId], (deleteBookingErr) => {
                  if (deleteBookingErr) {
                    console.error('[BOOKING] Unable to remove booking after photo failure:', deleteBookingErr.message);
                  }
                  reject(500, 'Unable to save booking photos. Please try again.');
                });
              });
              return;
            }
            savePhoto(index + 1);
          }
        );
      };

      savePhoto(0);
    }
  );
});

app.get(
  '/admin/detailing/bookings',
  requireAdmin,
  (req, res) => {

    db.all(
      `
        SELECT *
        FROM bookings
        ORDER BY booking_date DESC
      `,
      (err, bookings) => {

        if (err) {
          console.error('Unable to load detailing bookings:', err.message);
          return res.status(500).render('error', {
            message: 'Unable to load detailing bookings.'
          });
        }

        const bookingRows = bookings || [];
        if (!bookingRows.length) {
          return res.render('admin/detailing-bookings', { bookings: [], photosByBooking: {} });
        }

        db.all(
          `SELECT p.id, p.booking_id, p.filename, p.original_name
           FROM detailing_job_photos p
           INNER JOIN bookings b ON b.id = p.booking_id
           ORDER BY b.booking_date DESC, p.id ASC`,
          (photoErr, photos) => {
            if (photoErr) {
              console.error('Unable to load detailing booking photos:', photoErr.message);
              return res.status(500).render('error', {
                message: 'Unable to load detailing booking photos.'
              });
            }

            const photosByBooking = {};
            (photos || []).forEach((photo) => {
              if (!photosByBooking[photo.booking_id]) {
                photosByBooking[photo.booking_id] = [];
              }
              photosByBooking[photo.booking_id].push(photo);
            });
            res.render('admin/detailing-bookings', {
              bookings: bookingRows,
              photosByBooking
            });
          }
        );

      }
    );

  }
);

// ============================================================
// CONTACT
// ============================================================

app.get('/contact', (req, res) => {
  res.render('contact');
});

app.get('/admin/contact-messages', requireAdmin, (req, res) => {
  db.all(
    `SELECT id, name, email, department, subject, message, email_status, created_at
     FROM contact_messages
     ORDER BY created_at DESC
     LIMIT 250`,
    (err, messages) => {
      if (err) {
        console.error('Contact message lookup failed:', err.message);
        return res.status(500).render('error', { message: 'Unable to load contact messages.' });
      }
      res.render('admin/contact-messages', { messages: messages || [] });
    }
  );
});

app.post(
  '/contact',
  contactFormLimiter,
  validateCSRF,
  async (req, res) => {

    const {
      name,
      email,
      department,
      subject,
      message,
      website
    } = req.body;

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (website || !name || !emailPattern.test(email || '') || !department || !subject || !message) {
      return res.status(400).render('contact', {
        error: 'Please complete the form with a valid email address.'
      });
    }

    const {
      sendContactEmail
    } = require('./services/email');

    db.run(
      `
        INSERT INTO contact_messages
        (
          name,
          email,
          department,
          subject,
          message,
          email_status
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        name,
        email,
        `[${department}] ${subject}`,
        message,
        'pending'
      ],
      async function (err) {

        if (err) {
          return res
            .status(500)
            .send(
              'Error saving message'
            );
        }

        try {

          const sent = await sendContactEmail(
            name,
            email,
            department,
            subject,
            message
          );
          db.run(
            `UPDATE contact_messages SET email_status = ? WHERE id = ?`,
            [sent ? 'sent' : 'failed', this.lastID]
          );
          if (sent) {
            const { sendContactConfirmation } = require('./services/email');
            await sendContactConfirmation(email, name, subject);
          }

        } catch (emailError) {

          console.error(
            'Contact email error:',
            emailError
          );

        }

        res.render('contact', {
          success:
            'Message sent successfully! We will contact you soon.'
        });

      }
    );

  }
);

// ============================================================
// SERVICES
// ============================================================

app.get('/services', (req, res) => {
  res.render('detailing/services');
});

// Admin: Services
app.get(
  '/admin/services',
  requireAdmin,
  (req, res) => {

    db.all(
      'SELECT * FROM services ORDER BY id',
      (err, services) => {

        res.render(
          'admin/services',
          {
            services:
              services || []
          }
        );

      }
    );

  }
);

app.post(
  '/admin/services',
  requireAdmin,
  (req, res) => {

    const {
      name,
      description
    } = req.body;

    db.run(
      `
        INSERT INTO services
        (name, description)
        VALUES (?, ?)
      `,
      [
        name,
        description
      ],
      err => {

        if (err) {
          return res.status(500).json({
            error: 'Error adding service'
          });
        }

        res.json({
          success: true
        });

      }
    );

  }
);

app.put(
  '/admin/services/:id',
  requireAdmin,
  (req, res) => {

    const {
      name,
      description
    } = req.body;

    db.run(
      `
        UPDATE services
        SET name = ?, description = ?
        WHERE id = ?
      `,
      [
        name,
        description,
        req.params.id
      ],
      err => {

        if (err) {
          return res.status(500).json({
            error: 'Error updating service'
          });
        }

        res.json({
          success: true
        });

      }
    );

  }
);

app.delete(
  '/admin/services/:id',
  requireAdmin,
  (req, res) => {

    db.run(
      `
        DELETE FROM services
        WHERE id = ?
      `,
      [req.params.id],
      err => {

        if (err) {
          return res.status(500).json({
            error: 'Error deleting service'
          });
        }

        res.json({
          success: true
        });

      }
    );

  }
);
// ============================================================
// EVENTS
// ============================================================

app.get('/events', (req, res) => {

  db.all(
    `
      SELECT *
      FROM events
      WHERE status IN ('upcoming', 'ongoing')
      ORDER BY event_date ASC
    `,
    (err, events) => {

      if (err) {
        console.error(
          'Error fetching events:',
          err
        );
      }

      res.render('events', {
        events: events || []
      });

    }
  );

});

app.get(
  '/admin/events',
  requireAdmin,
  (req, res) => {

    db.all(
      `
        SELECT *
        FROM events
        ORDER BY event_date DESC
      `,
      (err, events) => {

        res.render(
          'admin/events',
          {
            events: events || []
          }
        );

      }
    );

  }
);

app.post(
  '/admin/events',
  requireAdmin,
  (req, res) => {

    const {
      title,
      description,
      event_date,
      event_time,
      location
    } = req.body;

    db.run(
      `
        INSERT INTO events
        (
          title,
          description,
          event_date,
          event_time,
          location,
          created_by,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, 'upcoming')
      `,
      [
        title,
        description,
        event_date,
        event_time,
        location,
        req.session.user.id
      ],
      err => {

        if (err) {
          return res.status(500).json({
            error: err.message
          });
        }

        res.json({
          success: true
        });

      }
    );

  }
);

// ============================================================
// ANNOUNCEMENTS
// ============================================================

app.get(
  '/announcements',
  (req, res) => {

    db.all(
      `
        SELECT *
        FROM announcements
        ORDER BY created_at DESC
      `,
      (err, announcements) => {

        res.render(
          'announcements',
          {
            announcements:
              announcements || []
          }
        );

      }
    );

  }
);

app.get(
  '/admin/announcements',
  requireAdmin,
  (req, res) => {

    db.all(
      `
        SELECT *
        FROM announcements
        ORDER BY created_at DESC
      `,
      (err, announcements) => {

        res.render(
          'admin/announcements',
          {
            announcements:
              announcements || []
          }
        );

      }
    );

  }
);

app.post(
  '/admin/announcements',
  requireAdmin,
  (req, res) => {

    const {
      title,
      content
    } = req.body;

    db.run(
      `
        INSERT INTO announcements
        (
          title,
          content,
          created_by
        )
        VALUES (?, ?, ?)
      `,
      [
        title,
        content,
        req.session.user.id
      ],
      err => {

        if (err) {
          return res.status(500).json({
            error:
              'Error creating announcement'
          });
        }

        res.json({
          success: true
        });

      }
    );

  }
);

// ============================================================
// USERS
// ============================================================

app.get(
  '/admin/users',
  requireAdmin,
  (req, res) => {

    db.all(
      `SELECT * FROM users`,
      (err, users) => {

        res.render(
          'admin/users',
          {
            users: users || []
          }
        );

      }
    );

  }
);

app.post(
  '/admin/users',
  requireAdmin,
  async (req, res) => {

    const {
      username,
      password,
      email,
      role
    } = req.body;

    try {

      const hashedPassword =
        await bcrypt.hash(
          password,
          10
        );

      db.run(
        `
          INSERT INTO users
          (
            username,
            password,
            email,
            role
          )
          VALUES (?, ?, ?, ?)
        `,
        [
          username,
          hashedPassword,
          email,
          role
        ],
        err => {

          if (err) {
            return res.status(500).json({
              error:
                'Error creating user'
            });
          }

          res.json({
            success: true
          });

        }
      );

    } catch (err) {

      console.error(
        'Admin user password hashing error:',
        err
      );

      res.status(500).json({
        error: 'Error creating user'
      });

    }

  }
);

// ============================================================
// DELETE USER
// ============================================================

app.delete(
  '/admin/users/:id',
  requireAdmin,
  (req, res) => {

    const userId =
      Number(req.params.id);

    if (!Number.isInteger(userId)) {

      return res.status(400).json({
        error: 'Invalid user ID'
      });

    }

    if (
      req.session.user.id === userId
    ) {

      return res.status(400).json({
        error:
          'You cannot delete your own admin account.'
      });

    }

    db.run(
      `
        DELETE FROM users
        WHERE id = ?
      `,
      [userId],
      function (err) {

        if (err) {

          console.error(
            'Error deleting user:',
            err
          );

          return res.status(500).json({
            error:
              'Error deleting user'
          });

        }

        if (this.changes === 0) {

          return res.status(404).json({
            error: 'User not found'
          });

        }

        res.json({
          success: true
        });

      }
    );

  }
);

// ============================================================
// UPDATE USER ROLE
// ============================================================

app.put(
  '/admin/users/:id/role',
  requireAdmin,
  (req, res) => {

    const userId =
      Number(req.params.id);

    const { role } = req.body;

    if (!Number.isInteger(userId)) {

      return res.status(400).json({
        error: 'Invalid user ID'
      });

    }

    if (!['user', 'admin'].includes(role)) {

      return res.status(400).json({
        error: 'Invalid role. Use "user" or "admin".'
      });

    }

    if (
      userId === req.session.user.id &&
      role !== 'admin'
    ) {

      return res.status(400).json({
        error:
          'You cannot remove your own admin access.'
      });

    }

    db.run(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId],
      function (err) {

        if (err) {

          console.error(
            'Error updating user role:',
            err
          );

          return res.status(500).json({
            error: 'Error updating user role'
          });

        }

        if (this.changes === 0) {

          return res.status(404).json({
            error: 'User not found'
          });

        }

        if (userId === req.session.user.id) {
          req.session.user.role = role;
        }

        res.json({
          success: true,
          message: `User role changed to ${role}`
        });

      }
    );

  }
);

// ============================================================
// UPDATE USER PASSWORD
// ============================================================

app.post(
  '/admin/users/:id/password',
  requireAdmin,
  async (req, res) => {

    const userId =
      Number(req.params.id);

    const { password } = req.body;

    if (!Number.isInteger(userId)) {

      return res.status(400).json({
        error: 'Invalid user ID'
      });

    }

    if (
      typeof password !== 'string' ||
      password.length < 8
    ) {

      return res.status(400).json({
        error:
          'Password must be at least 8 characters'
      });

    }

    try {

      const hashedPassword =
        await bcrypt.hash(password, 10);

      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, userId],
        function (err) {

          if (err) {

            console.error(
              'Error updating password:',
              err
            );

            return res.status(500).json({
              error: 'Error updating password'
            });

          }

          if (this.changes === 0) {

            return res.status(404).json({
              error: 'User not found'
            });

          }

          res.json({
            success: true,
            message: 'Password updated successfully'
          });

        }
      );

    } catch (err) {

      console.error(
        'Password hashing error:',
        err
      );

      res.status(500).json({
        error: 'Error updating password'
      });

    }

  }
);


// ============================================================

// Stripe webhook
app.post(
  '/api/payment-webhook',
  (req, res) => {

    const sig =
      req.headers[
        'stripe-signature'
      ];

    const endpointSecret =
      process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {

      event =
        stripe.webhooks.constructEvent(
          req.body,
          sig,
          endpointSecret
        );

    } catch (error) {

      return res
        .status(400)
        .send(
          `Webhook Error: ${error.message}`
        );

    }

    if (
      event.type ===
      'payment_intent.succeeded'
    ) {

      console.log(
        '✅ Payment succeeded:',
        event.data.object.id
      );

      // Update booking status here if needed.
    }

    res.json({
      received: true
    });

  }
);

// Payment status
app.get(
  '/api/payment-status/:intentId',
  async (req, res) => {

    try {

      const payment =
        await getPaymentStatus(
          req.params.intentId
        );

      res.json(payment);

    } catch (error) {

      res.status(500).json({
        error: error.message
      });

    }

  }
);

// ============================================================
// BOOKING CSV EXPORT
// ============================================================

app.get(
  '/admin/detailing/bookings/export',
  requireAdmin,
  (req, res) => {

    db.all(
      `
        SELECT *
        FROM bookings
        ORDER BY booking_date DESC
      `,
      (err, bookings) => {

        if (err) {

          return res.status(500).json({
            error: 'Export failed'
          });

        }

        let csv =
          'ID,Name,Email,Phone,Vehicle,Service,Date,Time,Status,Created\n';

        (bookings || []).forEach(
          booking => {

            const escaped = value =>
              value
                ? String(value)
                    .replace(/"/g, '""')
                : '';

            csv +=
              booking.id +
              ',"' +
              escaped(booking.name) +
              '","' +
              escaped(booking.email) +
              '","' +
              escaped(booking.phone) +
              '","' +
              escaped(
                booking.vehicle_type
              ) +
              '","' +
              escaped(
                booking.service_type
              ) +
              '",' +
              (
                booking.booking_date ||
                ''
              ) +
              ',' +
              (
                booking.booking_time ||
                ''
              ) +
              ',' +
              (
                booking.status ||
                ''
              ) +
              ',' +
              (
                booking.created_at ||
                ''
              ) +
              '\n';

          }
        );

        res.setHeader(
          'Content-Type',
          'text/csv; charset=utf-8'
        );

        res.setHeader(
          'Content-Disposition',
          'attachment; filename=bookings.csv'
        );

        res.send(csv);

      }
    );

  }
);
// ============================================================
// AUDIT LOGS
// ============================================================

app.get(
  '/admin/audit-logs',
    requireAdmin,
  async (req, res) => {

    try {

      const { getAuditLogs } =
        require('./services/audit');

      const logs =
        await getAuditLogs(500);

      res.render(
        'admin/audit-logs',
        {
          logs
        }
      );

    } catch (error) {

      console.error(
        'Error loading audit logs:',
        error
      );

      res.status(500).render(
        'error',
        {
          message:
            'Unable to load audit logs.'
        }
      );

    }

  }
);

// ============================================================
// LEGAL PAGES
// ============================================================

app.get('/privacy', (req, res) => {

  db.get(
    `
      SELECT *
      FROM site_settings
      WHERE id = 1
    `,
    (err, settings) => {

      res.render(
        'privacy',
        {
          settings:
            settings || {}
        }
      );

    }
  );

});

app.get('/terms', (req, res) => {

  db.get(
    `
      SELECT *
      FROM site_settings
      WHERE id = 1
    `,
    (err, settings) => {

      res.render(
        'terms',
        {
          settings:
            settings || {}
        }
      );

    }
  );

});

app.get('/cookies', (req, res) => {

  db.get(
    `
      SELECT *
      FROM site_settings
      WHERE id = 1
    `,
    (err, settings) => {

      res.render(
        'cookies',
        {
          settings:
            settings || {}
        }
      );

    }
  );

});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/health', (req, res) => {

  res.json({
    status: 'OK',
    timestamp:
      new Date().toISOString(),
    uptime:
      process.uptime()
  });
});

// Workshop API health endpoint
app.get('/workshop/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/admin/health', requireAdmin, async (req, res) => {
    const fs = require('fs');
    const { transporter } = require('./services/email');
    const checks = {
      application: { status: 'ok', detail: 'Application process is running.' },
      database: { status: 'unknown', detail: 'Checking database.' },
      smtp: { status: 'unknown', detail: 'Checking SMTP configuration.' },
      backups: { status: 'unknown', detail: 'Checking backup directory.' }
    };

    await new Promise((resolve) => {
      db.get('SELECT 1 AS ok', (err, row) => {
        checks.database = err
          ? { status: 'error', detail: err.message }
          : { status: 'ok', detail: row && row.ok === 1 ? 'SQLite query succeeded.' : 'Unexpected database response.' };
        resolve();
      });
    });

    try {
    } catch (error) {
    }

    try {
      await transporter.verify();
      checks.smtp = { status: 'ok', detail: 'SMTP connection verified.' };
    } catch (error) {
      checks.smtp = { status: 'error', detail: 'SMTP connection could not be verified.' };
    }

    try {
      const backupDir = path.join(__dirname, 'backups');
      const files = fs.existsSync(backupDir)
        ? fs.readdirSync(backupDir).filter((file) => file.endsWith('.db'))
        : [];
      checks.backups = {
        status: files.length ? 'ok' : 'warning',
        detail: files.length ? `${files.length} database backup file(s) found.` : 'No database backups found.'
      };
    } catch (error) {
      checks.backups = { status: 'error', detail: 'Backup directory could not be read.' };
    }

    res.render('admin/health', { checks, checkedAt: new Date() });
});

// ============================================================

// ============================================================
// ACTIVITY LOGS DASHBOARD
// ============================================================

app.get(
  '/admin/activity-logs',
  requireLogViewer,
  async (req, res) => {
    try {
      const { getAuditLogs } = require('./services/audit');
      const logs = await getAuditLogs(500);
      res.render('admin/activity-logs-dashboard', { logs: logs || [] });
    } catch (error) {
      console.error('Error loading activity logs:', error);
      res.status(500).render('error', { message: 'Unable to load activity logs.' });
    }
  }
);

// ============================================================
// ADMIN TWO-FACTOR AUTHENTICATION
// ============================================================

const {
  generateTOTPSecret,
  buildTOTPAuthURL,
  verifyTOTPCode,
  enable2FA,
  disable2FA
} = require('./services/2fa');

app.get('/admin/2fa-verify', (req, res) => {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  if (req.session.user.role !== 'admin') {
    return res.redirect('/admin');
  }

  if (Number(req.session.user.totp_enabled) !== 1) {
    req.session.authenticated2FA = true;
    return res.redirect('/admin');
  }

  if (req.session.authenticated2FA === true) {
    return res.redirect('/admin');
  }

  res.render('admin/2fa-verify');
});

app.get('/admin/enable-2fa', requireAdminBase, async (req, res) => {
  if (Number(req.session.user.totp_enabled) === 1) {
    return res.redirect('/admin');
  }

  try {
    const secret = generateTOTPSecret();
    req.session.temp2FASecret = secret;

    const otpauthURL = buildTOTPAuthURL(
      req.session.user.email || req.session.user.username,
      secret
    );

    const QRCode = require('qrcode');
    const qrCode = await QRCode.toDataURL(otpauthURL);

    res.render('admin/enable-2fa', { qrCode, secret });
  } catch (error) {
    console.error('2FA setup page error:', error);
    res.status(500).render('error', {
      message: 'Unable to prepare two-factor authentication setup.'
    });
  }
});

app.post('/admin/verify-2fa', validateCSRF, (req, res) => {
  const { code } = req.body;

  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (Number(req.session.user.totp_enabled) !== 1) {
    req.session.authenticated2FA = true;
    return res.json({ success: true, message: '2FA is not enabled for this account.' });
  }

  if (!/^\\d{6}$/.test(String(code || ''))) {
    return res.status(400).json({ error: 'Enter the 6-digit code from your authenticator app.' });
  }

  db.get(
    'SELECT id, role, totp_enabled, totp_secret FROM users WHERE id = ?',
    [req.session.user.id],
    (err, user) => {
      if (err) {
        console.error('2FA lookup error:', err);
        return res.status(500).json({ error: 'Unable to verify 2FA right now.' });
      }

      if (!user || user.role !== 'admin' || Number(user.totp_enabled) !== 1 || !user.totp_secret) {
        return res.status(401).json({ error: 'Two-factor authentication is not configured for this account.' });
      }

      try {
        const valid = verifyTOTPCode(code, user.totp_secret);

        if (!valid) {
          return res.status(400).json({ error: 'Invalid or expired 2FA code.' });
        }

        req.session.authenticated2FA = true;
        req.session.user.totp_enabled = 1;
        delete req.session.temp2FASecret;

        return res.json({ success: true, message: '2FA verified.' });
      } catch (verifyError) {
        console.error('2FA verification error:', verifyError);
        return res.status(500).json({ error: 'Unable to verify 2FA right now.' });
      }
    }
  );
});

app.post('/admin/enable-2fa', requireAdminBase, validateCSRF, (req, res) => {
  const { code } = req.body;
  const secret = req.session.temp2FASecret;

  if (Number(req.session.user.totp_enabled) === 1) {
    return res.status(400).json({ error: '2FA is already enabled for this account.' });
  }

  if (!secret) {
    return res.status(400).json({ error: '2FA setup session expired. Please reload the setup page.' });
  }

  if (!/^\\d{6}$/.test(String(code || ''))) {
    return res.status(400).json({ error: 'Enter the 6-digit code from your authenticator app.' });
  }

  try {
    if (!verifyTOTPCode(code, secret)) {
      return res.status(400).json({ error: 'Invalid or expired 2FA code. Check your authenticator time and try again.' });
    }

    enable2FA(db, req.session.user.id, secret, (err) => {
      if (err) {
        console.error('2FA database error:', err);
        return res.status(500).json({ error: 'Failed to save 2FA configuration.' });
      }

      delete req.session.temp2FASecret;
      req.session.user.totp_enabled = 1;
      req.session.user.totp_secret = secret;
      req.session.authenticated2FA = true;

      return res.json({ success: true, message: '2FA enabled successfully.' });
    });
  } catch (error) {
    console.error('2FA enable error:', error);
    return res.status(500).json({ error: 'Unable to enable 2FA right now.' });
  }
});

app.post('/admin/disable-2fa', requireAdmin, validateCSRF, (req, res) => {
  disable2FA(db, req.session.user.id, (err) => {
    if (err) {
      console.error('2FA disable database error:', err);
      return res.status(500).json({ error: 'Failed to disable 2FA.' });
    }

    req.session.user.totp_enabled = 0;
    req.session.user.totp_secret = null;
    req.session.authenticated2FA = true;
    delete req.session.temp2FASecret;

    return res.json({ success: true, message: '2FA disabled.' });
  });
});

// ============================================================
// API - SHOPIFY PRODUCTS
// ============================================================

app.get('/api/shopify-products', async (req, res) => {
  try {
    const shopify = require('./services/shopify');
    const products = await shopify.getProducts();
    
    if (products && products.length > 0) {
      const items = products.map(product => ({
        id: product.id,
        name: product.title,
        description: product.bodyHtml || product.title,
        price: parseFloat(product.variants[0]?.price || 0),
        available: product.variants.some((variant) => variant.available),
        category: product.productType || 'Uncategorized',
        image: product.images[0]?.src || '/images/placeholder.jpg',
        shopify_id: product.id
      }));
      res.json({ success: true, items });
    } else {
      res.json({ success: true, items: [] });
    }
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/shopify-featured-product', async (req, res) => {
  try {
    const shopify = require('./services/shopify');
    const product = await shopify.getPublicProduct('apex-core-hoodie');
    res.json({ success: true, product });
  } catch (error) {
    console.error('Error fetching featured Shopify product:', error.message);
    res.status(502).json({ success: false, error: 'Shopify product unavailable' });
  }
});
// 404 HANDLER
// ============================================================
//
// IMPORTANT:
// This MUST be the final route/middleware.
// Nothing should be added after this section except
// the server startup below.
//

app.use((req, res) => {

  res.status(404).render(
    'error',
    {
      code: 404,
      message: 'Page not found'
    }
  );

});

const marketingCampaignScheduler = setInterval(() => {
  sendDueMarketingCampaigns(db).catch((error) => {
    console.error('Scheduled marketing campaign check failed:', error.message);
  });
}, 60 * 1000);
if (typeof marketingCampaignScheduler.unref === 'function') {
  marketingCampaignScheduler.unref();
}

// ============================================================
// START SERVER
// ============================================================

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  () => {

    console.log(
      `ApexMoto&Co running on port ${PORT}`
    );

    console.log(
      `Admin Panel: http://localhost:${PORT}/admin`
    );

    console.log(
      `Detailing: http://localhost:${PORT}/detailing`
    );



  }
);
