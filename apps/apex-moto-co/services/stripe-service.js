// Stripe service stub - placeholder for payment processing
const stripe = null;

function createPaymentIntent(amount, currency = 'gbp') {
  throw new Error('Stripe service not configured');
}

function handlePaymentWebhook(req, res) {
  res.status(503).json({ error: 'Payment processing unavailable' });
}

function getPaymentStatus(paymentId) {
  return null;
}

module.exports = {
  stripe,
  createPaymentIntent,
  handlePaymentWebhook,
  getPaymentStatus
};
