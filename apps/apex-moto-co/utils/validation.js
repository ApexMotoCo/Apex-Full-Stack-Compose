// Input sanitization utility
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.trim()
    .replace(/[<>]/g, '') // Remove HTML brackets
    .substring(0, 1000); // Max 1000 chars
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
};

const validatePhone = (phone) => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.length <= 20;
};

module.exports = {
  sanitizeInput,
  validateEmail,
  validatePhone
};
