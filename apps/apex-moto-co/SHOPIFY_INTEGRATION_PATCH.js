// ============================================================
// SHOPIFY STORE INTEGRATION
// ============================================================
// ADD THIS CODE TO server.js AFTER THE IMPORTS (line ~12):
// const storeRoutes = require('./routes/store');

// ADD THIS CODE TO server.js BEFORE app.listen() (line ~3600):

// Register store routes
app.use('/store', storeRoutes);

// ============================================================

module.exports = { storeRoutes };
