const express = require('express');
const router = express.Router();

/**
 * APEX Moto & Co Store
 *
 * The website store is hosted by Shopify.
 * Browsing, cart, checkout and payments are all handled by Shopify.
 */

const SHOPIFY_STORE_URL = 'https://apexapparelsupply.myshopify.com/';

/**
 * Store homepage
 * Redirect customers directly to Shopify.
 */
router.get('/', (req, res) => {
  return res.redirect(301, SHOPIFY_STORE_URL);
});

/**
 * Legacy product pages
 * Send customers to Shopify as well.
 */
router.get('/product/:handle', (req, res) => {
  return res.redirect(301, SHOPIFY_STORE_URL);
});

/**
 * Legacy product API
 * The website no longer needs to proxy Shopify products.
 */
router.get('/api/products', (req, res) => {
  return res.json({
    success: true,
    shopify: SHOPIFY_STORE_URL
  });
});

/**
 * Legacy search API
 * Shopify handles product searching.
 */
router.get('/api/search', (req, res) => {
  return res.json({
    success: true,
    shopify: SHOPIFY_STORE_URL
  });
});

module.exports = router;