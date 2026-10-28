const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { logAction } = require('../services/audit');

const LOG_DIR = path.join(__dirname, '..', 'logs');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Request logging middleware
function requestLogger(req, res, next) {
  const start = Date.now();
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  const method = req.method;
  const requestPath = req.path.startsWith('/unsubscribe/')
    ? '/unsubscribe/[token]'
    : req.path;
  const ip = req.ip;
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const timestamp = new Date().toISOString();
    
    const logEntry = {
      timestamp,
      method,
      path: requestPath,
      status,
      ip,
      duration: `${duration}ms`,
      user: req.session.user ? req.session.user.email : 'guest'
    };
    
    // Log to file (daily rotation)
    const today = new Date().toISOString().split('T')[0];
    const logFile = path.join(LOG_DIR, `requests-${today}.log`);
    
    fs.appendFile(logFile, JSON.stringify(logEntry) + '\n', (err) => {
      if (err) console.error('Log write error:', err.message);
    });

    const isPageRequest =
      method === 'GET' &&
      !req.path.includes('.') &&
      !req.path.startsWith('/api') &&
      status < 500;
    const isStateChange = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

    if (isPageRequest || isStateChange) {
      const user = req.session.user || {};
      logAction(
        user.id,
        user.username || user.email || 'Guest',
        isStateChange ? `${method.toLowerCase()}_request` : 'page_view',
        requestPath,
        isStateChange ? `${method} ${requestPath} returned ${status}` : 'Page viewed',
        ip,
        {
          requestId,
          userAgent: req.get('user-agent')
        }
      ).catch((err) => {
        console.error('Audit log write error:', err.message);
      });
    }
    
    // Console log for errors
    if (status >= 400) {
      console.log(`[${timestamp}] ${method} ${requestPath} - ${status} (${duration}ms)`);
    }
  });
  
  next();
}

module.exports = { requestLogger };
