const QRCode = require('qrcode');
const speakeasy = require('speakeasy');

const TOTP_ISSUER = 'ApexMoto & Co';
const TOTP_WINDOW = 1;

function generateTOTPSecret() {
  const secret = speakeasy.generateSecret({
    length: 32
  });

  return secret.base32;
}

function buildTOTPAuthURL(accountName, secret) {
  const cleanAccount = String(accountName || 'admin').trim() || 'admin';

  const encodedIssuer = encodeURIComponent(TOTP_ISSUER);
  const encodedAccount = encodeURIComponent(cleanAccount);

  return `otpauth://totp/${encodedIssuer}:${encodedAccount}` +
    `?secret=${encodeURIComponent(secret)}` +
    `&issuer=${encodedIssuer}` +
    `&algorithm=SHA1&digits=6&period=30`;
}

function verifyTOTPCode(code, secret) {
  if (!secret) {
    return false;
  }

  const normalizedCode = String(code || '').trim();

  if (!/^\d{6}$/.test(normalizedCode)) {
    return false;
  }

  return speakeasy.totp.verify({
    secret: String(secret).replace(/\s+/g, '').toUpperCase(),
    encoding: 'base32',
    token: normalizedCode,
    step: 30,
    window: TOTP_WINDOW
  });
}

function enable2FA(db, userId, secret, callback) {
  if (!secret) {
    return callback(new Error('Missing TOTP secret'));
  }

  db.run(
    'UPDATE users SET totp_secret = ?, totp_enabled = 1 WHERE id = ?',
    [secret, userId],
    function(err) {
      if (err) {
        return callback(err);
      }

      if (this.changes !== 1) {
        return callback(new Error('User account was not found'));
      }

      callback(null);
    }
  );
}

function disable2FA(db, userId, callback) {
  db.run(
    'UPDATE users SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?',
    [userId],
    function(err) {
      if (err) {
        return callback(err);
      }

      if (this.changes !== 1) {
        return callback(new Error('User account was not found'));
      }

      callback(null);
    }
  );
}

module.exports = {
  generateTOTPSecret,
  buildTOTPAuthURL,
  verifyTOTPCode,
  enable2FA,
  disable2FA,
  // Kept for compatibility with any older code that imports QRCode directly.
  QRCode
};
