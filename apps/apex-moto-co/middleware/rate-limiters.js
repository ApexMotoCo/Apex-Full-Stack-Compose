const rateLimit = require('express-rate-limit');

// Stricter rate limiter for contact form
const contactFormLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 per hour
    message: 'Too many contact submissions. Please try again in an hour.',
    standardHeaders: true,
    legacyHeaders: false,

    // Skip rate limiting for logged-in admins
    skip: (req) =>
        req.session &&
        req.session.user &&
        req.session.user.role === 'admin'
});

// Login attempt limiter
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts
    message: 'Too many login attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true
});

// Password reset limiter
const passwordResetLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // 3 per hour
    message: 'Too many password reset attempts. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false
});

const chatbotLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: 'Too many chatbot messages. Please try again shortly.',
    standardHeaders: true,
    legacyHeaders: false
});

const marketingAssistantLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).json({
        error: 'You have reached the marketing assistant limit. Please try again shortly.'
    })
});

module.exports = {
    contactFormLimiter,
    loginLimiter,
    passwordResetLimiter,
    chatbotLimiter,
    marketingAssistantLimiter
};
