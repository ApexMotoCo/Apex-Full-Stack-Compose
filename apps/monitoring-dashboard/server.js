const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const session = require('express-session');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Session setup
const SECRET_KEY = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

app.use(session({
  secret: SECRET_KEY,
  resave: false,
  saveUninitialized: true,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Database setup
const db = new sqlite3.Database('/data/monitoring.db', (err) => {
  if (err) console.error('Database error:', err);
  else console.log('Database connected');
});

// Initialize database with auth tables
db.serialize(() => {
  // Users table
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      name TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // Service status table
  db.run(`
    CREATE TABLE IF NOT EXISTS service_status (
      id INTEGER PRIMARY KEY,
      service_name TEXT UNIQUE,
      status TEXT,
      last_check DATETIME,
      uptime_percent REAL,
      error_count INTEGER,
      last_error TEXT,
      response_time INTEGER
    )
  `);

  // Error logs table
  db.run(`
    CREATE TABLE IF NOT EXISTS error_logs (
      id INTEGER PRIMARY KEY,
      service_name TEXT,
      error_message TEXT,
      status_code INTEGER,
      timestamp DATETIME,
      response_time INTEGER
    )
  `);

  // Login history table
  db.run(`
    CREATE TABLE IF NOT EXISTS login_history (
      id INTEGER PRIMARY KEY,
      email TEXT,
      login_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      ip_address TEXT,
      success BOOLEAN
    )
  `);
});

const getRequestToken = (req) => {
  const authorization = req.get('Authorization') || '';
  if (authorization.startsWith('Bearer ')) {
    return authorization.slice(7);
  }
  return req.session.token;
};

// Middleware: Check if user is admin
const requireAdmin = (req, res, next) => {
  const token = getRequestToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// Middleware: Check authentication
const authenticateToken = (req, res, next) => {
  const token = getRequestToken(req);
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
};

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

// Register new user (only @apexingoodcompany.co.uk emails)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    // Validate email domain
    if (!email.endsWith('@apexingoodcompany.co.uk')) {
      return res.status(400).json({ error: 'Only @apexingoodcompany.co.uk emails allowed' });
    }

    // Validate password strength
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    db.run(
      'INSERT INTO users (email, password, name) VALUES (?, ?, ?)',
      [email, hashedPassword, name],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint')) {
            return res.status(400).json({ error: 'Email already registered' });
          }
          return res.status(500).json({ error: err.message });
        }

        res.status(201).json({ message: 'User registered successfully', email });
      }
    );
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip;

    // Validate email domain
    if (!email.endsWith('@apexingoodcompany.co.uk')) {
      db.run('INSERT INTO login_history (email, ip_address, success) VALUES (?, ?, ?)', 
        [email, clientIp, false]);
      return res.status(400).json({ error: 'Only @apexingoodcompany.co.uk emails allowed' });
    }

    // Find user
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (!user) {
        db.run('INSERT INTO login_history (email, ip_address, success) VALUES (?, ?, ?)', 
          [email, clientIp, false]);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Check password
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        db.run('INSERT INTO login_history (email, ip_address, success) VALUES (?, ?, ?)', 
          [email, clientIp, false]);
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      db.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);

      // Log successful login
      db.run('INSERT INTO login_history (email, ip_address, success) VALUES (?, ?, ?)', 
        [email, clientIp, true]);

      // Create JWT token
      const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, SECRET_KEY, {
        expiresIn: '24h'
      });

      req.session.token = token;
      req.session.user = { id: user.id, email: user.email, name: user.name };

      res.json({
        message: 'Login successful',
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
      });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

// Get current user
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ============================================================================
// MONITORING ROUTES (Protected)
// ============================================================================

// Service definitions
const services = [
  { name: 'Website', url: 'http://apex-moto-co-web:3000/health', health_endpoint: 'http://apex-moto-co-web:3000' },
  { name: 'Asset Backend', url: 'http://asset-management-backend:8000/health', health_endpoint: 'http://asset-management-backend:8000' },
  { name: 'Asset Frontend', url: 'http://apex-frontend:3000', health_endpoint: 'http://apex-frontend:3000' },
  { name: 'VPN Service', url: 'https://apex-openvpn:943/', health_endpoint: 'https://apex-openvpn:943/' }
];

// Health check function
async function checkService(service) {
  const startTime = Date.now();

  try {
    const axiosOptions = {
      timeout: 5000
    };

    // OpenVPN Access Server uses HTTPS on port 943
    // and may use an internal/self-signed certificate.
    if (service.url.startsWith('https://')) {
      axiosOptions.httpsAgent = new https.Agent({
        rejectUnauthorized: false
      });
    }

    const response = await axios.get(service.url, axiosOptions);
    const responseTime = Date.now() - startTime;

    db.run(
      `UPDATE service_status 
       SET status = ?, last_check = datetime('now'), response_time = ?
       WHERE service_name = ?`,
      [
        response.status === 200 ? 'online' : 'degraded',
        responseTime,
        service.name
      ]
    );

    return {
      status: 'online',
      responseTime
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMsg = error.message || 'Unknown error';

    db.run(
      `UPDATE service_status 
       SET status = ?,
           last_check = datetime('now'),
           error_count = error_count + 1,
           last_error = ?,
           response_time = ?
       WHERE service_name = ?`,
      [
        'offline',
        errorMsg,
        responseTime,
        service.name
      ]
    );

    db.run(
      `INSERT INTO error_logs
       (service_name, error_message, status_code, timestamp, response_time)
       VALUES (?, ?, ?, datetime('now'), ?)`,
      [
        service.name,
        errorMsg,
        error.response?.status || 0,
        responseTime
      ]
    );

    return {
      status: 'offline',
      error: errorMsg,
      responseTime
    };
  }
}

// Run health checks every 30 seconds
setInterval(async () => {
  for (const service of services) {
    await checkService(service);
  }
}, 30000);

// Initial health check
(async () => {
  for (const service of services) {
    await checkService(service);
  }
})();

// Initialize service status
services.forEach(service => {
  db.run(
    `INSERT OR IGNORE INTO service_status (service_name, status, uptime_percent, error_count) 
     VALUES (?, 'unknown', 100, 0)`,
    [service.name]
  );
});

// Get all services status (Protected)
app.get('/api/status', authenticateToken, (req, res) => {
  db.all(
    `SELECT * FROM service_status ORDER BY service_name`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Get specific service status (Protected)
app.get('/api/status/:service', authenticateToken, (req, res) => {
  db.get(
    `SELECT * FROM service_status WHERE service_name = ?`,
    [req.params.service],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || {});
    }
  );
});

// Get recent errors (Protected)
app.get('/api/errors', authenticateToken, (req, res) => {
  const limit = req.query.limit || 100;
  db.all(
    `SELECT * FROM error_logs ORDER BY timestamp DESC LIMIT ?`,
    [limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Get errors for specific service (Protected)
app.get('/api/errors/:service', authenticateToken, (req, res) => {
  const limit = req.query.limit || 50;
  db.all(
    `SELECT * FROM error_logs WHERE service_name = ? ORDER BY timestamp DESC LIMIT ?`,
    [req.params.service, limit],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows || []);
    }
  );
});

// Get uptime (Protected)
app.get('/api/uptime', authenticateToken, (req, res) => {
  db.all(
    `SELECT service_name, 
            ROUND(100.0 * SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) / COUNT(*), 2) as uptime_percent,
            COUNT(*) as total_checks,
            SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_count
     FROM (
       SELECT service_name, status FROM error_logs 
       UNION ALL
       SELECT service_name, status FROM service_status
     )
     GROUP BY service_name`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
});

// Health check endpoint (Public - no auth)
app.get('/api/health', (req, res) => {
  res.json({ status: 'dashboard online' });
});

// Serve static files (frontend)
app.use(express.static('public'));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Not found' });
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🔐 Apex Monitoring Dashboard running on port ${PORT}`);
  console.log(`📧 Only @apexingoodcompany.co.uk emails can access`);
});
