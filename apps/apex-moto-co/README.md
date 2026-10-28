# 🏍️ Apex Moto & Co - Detailing & Servicing Platform

A **production-ready motorcycle detailing and servicing platform** built with Node.js, Express, SQLite, and Docker.

[![Status](https://img.shields.io/badge/status-production--ready-brightgreen)]()
[![License](https://img.shields.io/badge/license-MIT-blue)]()
[![Node](https://img.shields.io/badge/node-18.x-green)]()

---

## Features

### 🏍️ Motorcycle Detailing
- Premium motorcycle detailing services
- Ceramic protection packages
- Multi-stage cleaning and paint correction
- Monthly membership plans (Bronze, Silver, Gold)
- Booking system with calendar management

### 🔧 Basic Motorcycle Servicing
- Oil & filter changes
- Air filter replacement
- Spark plug replacement
- Chain cleaning, adjustment & lubrication
- Brake inspection & pad replacement
- Coolant & brake fluid replacement
- Battery testing & replacement
- Electrical checks & bulb replacement
- Tyre pressure & condition checks
- General safety inspection
- Pre-MOT checks
- Seasonal/winter checks

### 📅 Membership System
- Bronze, Silver, and Gold tier options
- Monthly payment plans
- Annual discount options
- Exclusive member perks

### 👥 User System
- User registration & authentication
- Personal account management
- Booking history
- Persistent sessions (SQLite-backed)

### 📧 Email System
- Contact form with department routing
- OVH Zimbra SMTP integration
- General enquiries → Business@apexingoodcompany.co.uk
- Shop enquiries → support@apexingoodcompany.co.uk
- Events enquiries → events@apexingoodcompany.co.uk
- Detailing enquiries → support@apexingoodcompany.co.uk
- Reply-To functionality for easy customer responses
- Audit logging of all email activity

### 📊 Admin Dashboard
- Service management (CRUD operations)
- Booking management
- Audit logs for all admin actions
- Site settings configuration
- User management
- Admin-only AI marketing copilot for campaign planning, social posts, email, promotions, and service/product copy

### 📱 Responsive Design
- Mobile-friendly interface
- Dark-themed UI (orange/black branding)
- Professional motorcycle workshop aesthetic
- Fully responsive grid layouts

### 📋 Legal Compliance
- GDPR-compliant Privacy Policy
- Complete Terms & Conditions
- Cookie Policy
- Transparent service descriptions

### 🔒 Security
- Session management with persistent storage
- Admin authentication for protected routes
- Audit logging for all admin actions
- Password hashing with bcryptjs

---

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (if running locally)
- Git

### Installation

1. **Clone Repository**
   ```bash
   git clone https://github.com/Adamgore21/apex-moto-co.git
   cd apex-moto-co
   ```

2. **Setup Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Start with Docker**
   ```bash
   docker compose up -d --build
   ```

4. **Access Site**
   - Main: https://apexingoodcompany.co.uk
   - Admin: https://apexingoodcompany.co.uk/admin
   - Contact: https://apexingoodcompany.co.uk/contact

### Local Development (No Docker)

```bash
npm install
npm start
# Site at http://localhost:3000
```

---

## Configuration

### Environment Variables

Create `.env` file from `.env.example`:

```env
# Email Configuration (OVH Zimbra)
EMAIL_HOST=smtp.mail.ovh.net
EMAIL_PORT=587
EMAIL_USER=support@apexingoodcompany.co.uk
EMAIL_PASSWORD=your-password-here
SESSION_SECRET=generate-a-long-random-value
OPENAI_API_KEY=your-openai-api-key
OPENAI_MODEL=gpt-4o-mini

# Admin Credentials
ADMIN_EMAIL_1=adamgore462@gmail.com
ADMIN_PASSWORD_1=use-a-strong-password
ADMIN_EMAIL_2=jordanroberts132798@icloud.com
ADMIN_PASSWORD_2=use-a-strong-password
```

The marketing copilot uses the OpenAI API from the server. Keep `OPENAI_API_KEY` private; for the root Docker Compose stack, set it in the root `.env` file so it is passed to the Apex Moto & Co web container. Drafts are suggestions and should be checked for accuracy before publishing.

---

## Architecture

### Database Schema

```sql
-- Main Tables
users                  # User accounts & authentication
bookings              # Service bookings
contact_messages      # Contact form submissions
site_settings         # Site configuration & content
services              # Service offerings
audit_logs            # Admin action audit trail
sessions              # User session storage (SQLite)
```

### Folder Structure

```
apex-moto-co/
├── server.js              # Express application
├── services/
│   ├── email.js          # OVH Zimbra email service
│   ├── audit.js          # Audit logging
│   └── shopify.js        # Shopify integration
├── views/
│   ├── admin/            # Admin pages
│   ├── detailing/        # Detailing & servicing pages
│   ├── privacy.ejs       # Privacy policy
│   ├── terms.ejs         # Terms & conditions
│   ├── cookies.ejs       # Cookie policy
│   └── (+ more pages)
├── public/
│   ├── css/style.css     # Styling
│   └── js/main.js        # Client scripts
├── data/
│   ├── database.db       # Main SQLite database
│   └── sessions.db       # Session storage
└── site documentation/
    ├── Privacy Policy.txt
    ├── T&C.txt
    ├── Cookies.txt
    ├── About us.txt
    └── (+ more docs)
```

Runtime data and local secrets are intentionally excluded from version control:
`data/`, `logs/`, `backups/`, `.env`, and `node_modules/`.

The root also contains operational scripts and deployment documentation. These are
kept at the root because they are run directly from the repository and are referenced
by the existing Docker and maintenance workflows.

---

## Routes

### Public Routes

```
GET  /                          Home page
GET  /about                     About page
GET  /contact                   Contact form
GET  /detailing                 Detailing main page
GET  /detailing/booking         Booking page
GET  /detailing/memberships     Membership tiers
GET  /detailing/portfolio       Portfolio/gallery
GET  /services                  Basic motorcycle servicing
GET  /detailing/services        Redirects to the Services page
GET  /services                  All services overview
GET  /privacy                   Privacy policy
GET  /terms                     Terms & conditions
GET  /cookies                   Cookie policy

POST /contact                   Submit contact form
POST /detailing/book            Submit booking
POST /register                  Create account
POST /login                     Login
GET  /logout                    Logout
```

### Admin Routes (Protected)

```
GET  /admin                     Admin dashboard
GET  /admin/settings            Site settings editor
POST /admin/settings            Save site settings

GET  /admin/services            Manage services
POST /admin/services            Add service
PUT  /admin/services/:id        Update service
DELETE /admin/services/:id      Delete service

GET  /admin/audit-logs          View audit logs
GET  /admin/activity-logs       View activity logs (restricted to user ID 3)

GET  /admin/detailing/bookings  View all bookings
```

---

## Email Integration (OVH Zimbra)

### Configuration

1. Set up OVH Zimbra mailbox at https://www.ovh.co.uk/
2. Get SMTP credentials
3. Configure in `.env`:
   ```env
   EMAIL_HOST=smtp.mail.ovh.net
   EMAIL_PORT=587
   EMAIL_USER=your-business-email@domain.co.uk
   EMAIL_PASSWORD=your-password
   ```

### Email Routing

Contact form emails route by department:
- **General** → Business@apexingoodcompany.co.uk
- **Shop** → support@apexingoodcompany.co.uk
- **Events** → events@apexingoodcompany.co.uk
- **Detailing** → support@apexingoodcompany.co.uk

Each email has Reply-To set to the customer's address for easy responses.

---

## Database

### SQLite Storage

- **Main Database**: `/data/database.db`
  - Users, bookings, contact messages, site settings, services, audit logs
  
- **Session Database**: `/data/sessions.db`
  - Persistent user sessions (survives container restarts)

Both databases are persistent volumes in Docker setup.

---

## Admin Panel

Access at `/admin` with admin credentials.

### Dashboard Features
- Site content editor
- Service management (CRUD)
- Booking management
- Audit log viewer

### Settings Editor
- Site branding (name, tagline)
- Hero section text
- About section content
- Footer copyright
- Social media links
- Legal page content (Privacy, Terms, Cookies)

---

## Deployment

The production site runs in Docker on the Windows host machine. OVH provides the
domain/DNS; it is not the application server.

### Docker (Recommended)

```bash
docker compose up -d --build
```

The stack contains:

- `web`: Node.js/Express application on port `3000`
- `nginx`: HTTPS reverse proxy on ports `80` and `443`

The site is accessible at https://apexingoodcompany.co.uk when the host's certificate
files and environment variables are configured.

### Local Development

```bash
npm install
npm start
# Runs on http://localhost:3000
```

### Environment Setup

1. Copy `.env.example` to `.env`
2. Configure OVH Zimbra email credentials
3. Set admin credentials
4. Start containers

### Deployment note

The GitHub Actions SSH workflow expects a remote Linux host and is not the deployment
mechanism for the current Windows Docker host. Deploy locally from the host with the
Docker Compose command above, or configure a self-hosted runner before automating it.

---

## Security Notes

- ✅ Passwords hashed with bcryptjs
- ✅ SQL injection protection with parameterized queries
- ✅ Session management with secure storage
- ✅ Admin authentication required for protected routes
- ✅ Audit logging for all admin actions
- ✅ Request and change IDs visible in the admin audit log
- ✅ UK timezone display (`Europe/London`) for audit timestamps
- ✅ HTTPS enabled in production
- ⚠️ Change default admin passwords immediately
- ⚠️ Keep `.env` file secure and never commit it
- ⚠️ Use strong email passwords

---

## Troubleshooting

### Emails Not Sending
- Verify OVH Zimbra credentials in `.env`
- Check EMAIL_HOST is `smtp.mail.ovh.net`
- Ensure EMAIL_PORT is `587`
- Verify mailbox isn't full or locked
- Check container logs: `docker logs apex-moto-co-web`

### Container Issues
```bash
# View logs
docker logs apex-moto-co-web

# Restart containers
docker compose restart

# Full reset
docker compose down
docker compose up -d --build
```

### Audit logs

After signing in as user ID `3`, open:

- `/admin/audit-logs`
- `/admin/activity-logs`

Both pages show the event ID, request ID, actor, route/resource, timestamp, and IP
address. The log pages intentionally return `403 Access Denied` to other users.

### Database Issues
```bash
# Reset database (WARNING: deletes all data)
rm data/database.db data/sessions.db
docker compose restart
```

---

## Tech Stack

- **Backend**: Node.js 18 + Express.js
- **Database**: SQLite3 (main + sessions)
- **Frontend**: EJS + Bootstrap 5
- **Auth**: bcryptjs
- **Email**: Nodemailer (OVH Zimbra)
- **DevOps**: Docker + Docker Compose + Nginx
- **Reverse Proxy**: Nginx with SSL (Let's Encrypt)
- **DNS**: Dynamic DNS for home server setup

---

## License

MIT License

---

## Support

**Issues or questions?**
- Check documentation files
- Review admin guide
- Check Docker logs for errors

---

**Built with ❤️ for motorcycle enthusiasts**

🏍️ **Detail. Service. Protect.** 🏍️
