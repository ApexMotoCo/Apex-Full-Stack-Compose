const fs = require('fs');
const path = require('path');

// Validate .env configuration on startup
function validateEnv() {
  const required = [
    'EMAIL_HOST',
    'EMAIL_PORT',
    'EMAIL_USER',
    'EMAIL_PASSWORD'
  ];
  
  const optional = [
    'PORT',
    'ADMIN_PASSWORD_1',
    'ADMIN_PASSWORD_2',
    'ADMIN_EMAIL_1',
    'ADMIN_EMAIL_2'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn('⚠️  Missing required .env variables:', missing.join(', '));
    console.warn('App will start but email features may not work');
  }
  
  console.log('✅ .env validation complete');
  console.log(`   Required: ${required.length} (${required.length - missing.length} found)`);
  console.log(`   Optional: ${optional.length} (${optional.filter(k => process.env[k]).length} found)`);
}

module.exports = { validateEnv };
