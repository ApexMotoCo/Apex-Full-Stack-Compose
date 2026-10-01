# Shopify Integration Setup Guide

## Store Details
- **Shopify Store URL**: apexapparelsupply.myshopify.com

## Creating Shopify Admin API Credentials

### Step 1: Create a Custom App

1. Go to your Shopify Admin Dashboard
2. Navigate to **Settings** → **Apps and integrations**
3. Click **Develop apps** (top right)
4. Click **Create an app**
5. Enter app name: `Apex Moto Co Integration`
6. Click **Create app**

### Step 2: Set Admin API Scopes

1. On the app page, go to the **Configuration** tab
2. Under **Admin API scopes**, enable these scopes:
   - `read_products`
   - `read_product_listings`
   - `read_inventory`
   - `read_orders` (optional, if you want to sync orders)

3. Click **Save**

### Step 3: Generate Access Token

1. Go to the **API credentials** tab
2. Under **Admin API access token**, click **Install app** or **Reinstall**
3. You'll see a confirmation popup - click **Install**
4. The **Admin API access token** will appear - **COPY THIS** (you won't see it again)

### Step 4: Add to .env File

Add these to your `.env` file:

```
SHOPIFY_STORE_URL=apexapparelsupply.myshopify.com
SHOPIFY_ACCESS_TOKEN=your_admin_api_access_token_here
SHOPIFY_API_VERSION=2024-01
```

---

## Important Notes

- Keep your **access token SECRET** - never commit it to git
- The `.env` file is already in `.gitignore`
- The token is only shown once - if you lose it, you'll need to reinstall the app
- API version `2024-01` is current; update as needed

## Next Steps

Once you have the credentials:
1. Add them to your `.env` file
2. I'll create the Shopify integration service
3. Set up product sync routes
4. Update the store page to display products
