APEX Moto & Co — Detailing Mobile API drop-in

This package adds ONLY the API used by the native Android APEX Detailing app.
It does not replace the website, its database, booking pages, or login pages.

FILES
- website-api/detailing-mobile-api.js
- install-mobile-api.ps1

INSTALL (live website can remain running while copying files)
1. Copy website-api\detailing-mobile-api.js into your live website project, e.g.
   C:\Users\Adam\Documents\GitHub\Apex-Moto-Co\website-api\detailing-mobile-api.js
2. Run install-mobile-api.ps1 from the website project folder as Administrator if PowerShell policy requires it.
3. The script makes a timestamped backup of server.js before changing it.
4. Add a strong DETAILING_APP_SECRET to the website's environment/.env.
5. Restart the Node/Docker service so server.js loads the new route.

IMPORTANT
- The website remains the source of truth.
- Existing bookings table is used directly.
- Existing users table is used for authentication.
- By default only role=admin can use the mobile API.
- You can configure roles with DETAILING_APP_ROLES=admin,detailer.
- No booking or customer data is duplicated into a second database.

TEST
GET https://apexingoodcompany.co.uk/api/mobile/detailing/health
Expected JSON:
{"ok":true,"service":"APEX Detailing Mobile API"}
