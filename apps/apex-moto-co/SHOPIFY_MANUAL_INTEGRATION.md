# Shopify Integration - Manual Integration Steps

## Files Created

1. **services/shopify.js** - Shopify API service
2. **routes/store.js** - Store routes handler
3. **.env** - Updated with Shopify credentials
4. **views/store.ejs** - Store homepage
5. **views/store/product.ejs** - Product detail page

## Manual Integration Required

### Step 1: Add Store Routes Import to server.js

Find line 11 in `server.js`:
```javascript
const { registerDetailingMobileApi } = require('./website-api/detailing-mobile-api');
```

Add after it:
```javascript
const storeRoutes = require('./routes/store');
```

### Step 2: Register Store Routes in server.js

Find the section with `// 404 HANDLER` comment (around line 4250).

Add BEFORE it:
```javascript
// ============================================================
// SHOPIFY STORE ROUTES
// ============================================================

app.use('/store', storeRoutes);
```

## Build & Deploy

Once manual edits are complete:
```bash
docker compose down
docker build -t apex-moto-co-web . --no-cache
docker compose up -d
```

## Testing

1. Navigate to `/store` - should display Shopify products
2. Click a product - should show product details
3. Search bar should filter products
4. "View & Purchase on Shopify" link should go to shopify store

## Troubleshooting

- If products don't load: Check `.env` has correct SHOPIFY_ACCESS_TOKEN
- If 404 on /store: Check routes are registered before 404 handler
- Check logs: `docker compose logs apex-moto-co-web`
