// Password strength validation
function validatePasswordStrength(password) {
  const errors = [];
  
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('One uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('One lowercase letter');
  if (!/[0-9]/.test(password)) errors.push('One number');
  if (!/[!@#$%^&*]/.test(password)) errors.push('One special character (!@#$%^&*)');
  
  return {
    isStrong: errors.length === 0,
    missing: errors,
    strength: Math.max(0, Math.min(100, ((5 - errors.length) / 5) * 100))
  };
}

module.exports = { validatePasswordStrength };
