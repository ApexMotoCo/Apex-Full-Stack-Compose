const crypto = require('crypto');

// CSRF token generation and validation middleware
function csrfProtection(req, res, next) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  res.locals.csrfToken = req.session.csrfToken;
  next();
}

function validateCSRF(req, res, next) {
  const token = req.body._csrf || req.headers['x-csrf-token'];
  
  if (!token || token !== req.session.csrfToken) {
    console.warn('CSRF validation failed');
    return res.status(403).json({ error: 'CSRF validation failed' });
  }
  
  next();
}

module.exports = { csrfProtection, validateCSRF };
