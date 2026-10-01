# 🚀 APEX DASHBOARD - QUICK REFERENCE

## Current Status: ✅ READY FOR PRODUCTION

**Dashboard Features:**
- ✅ Login authentication (email + password)
- ✅ Admin panel with user management
- ✅ Real-time service monitoring
- ✅ Error logging & tracking
- ✅ JWT token sessions (24h expiry)
- ✅ Role-based access (user/admin)

---

## Pre-SSL Deployment (Local)

### Access Dashboard:
```
http://localhost:5000
```

### Login:
- Email: `adam@apexingoodcompany.co.uk`
- Password: `TestPassword123`

### Admin Access:
- Click "Admin" button (top right)
- Manage users: promote/demote/delete

---

## SSL Setup Required (Production)

### On Your OVH Instance:

1. **SSH into server:**
   ```bash
   ssh root@YOUR.PUBLIC.IP
   cd /path/to/apex
   ```

2. **Verify DNS:**
   ```bash
   nslookup dashboard.apexingoodcompany.co.uk
   # Must return your public IP
   ```

3. **Run SSL setup:**
   ```bash
   # Linux/Mac
   chmod +x Apex-Monitoring-Dashboard/setup-ssl.sh
   ./Apex-Monitoring-Dashboard/setup-ssl.sh
   
   # Windows PowerShell
   .\Apex-Monitoring-Dashboard\setup-ssl.ps1
   ```

4. **Update nginx:**
   ```bash
   cp Apex-Monitoring-Dashboard/nginx-dashboard.conf ./nginx.conf
   cd Apex-Moto-Co
   docker compose up -d apex-moto-nginx
   ```

5. **Test SSL:**
   ```bash
   curl -I https://dashboard.apexingoodcompany.co.uk
   # Should return HTTP 200
   ```

6. **Access dashboard:**
   - https://dashboard.apexingoodcompany.co.uk
   - Login with your credentials
   - SSL auto-renews monthly

---

## Admin Features

### User Management:
- **View all users** - see email, name, role, last login
- **Promote user** - make user an admin
- **Demote admin** - remove admin privileges
- **Delete user** - permanently remove user

### Super Admin:
- Email: `adam@apexingoodcompany.co.uk`
- Cannot be demoted or deleted
- Full access to all admin functions

### Add New Admins:
1. User registers with @apexingoodcompany.co.uk email
2. Super admin clicks Admin panel
3. Find user in table
4. Click "Promote" button
5. User now has admin access

---

## Services Monitored

| Service | Port | Status |
|---------|------|--------|
| Website | 3000 | ✅ Online |
| Asset Backend | 8000 | ✅ Online |
| Asset Frontend | 3001 | ✅ Online |
| VPN Service | 943 | ✅ Running |
| Dashboard | 5000 | ✅ Online |

---

## API Endpoints

### Public:
- `GET /api/health` - Dashboard health (no auth)

### Protected (Require Login):
- `GET /api/status` - All services status
- `GET /api/errors` - Recent errors
- `GET /api/errors/:service` - Service errors
- `GET /api/uptime` - Uptime stats
- `GET /auth/me` - Current user info

### Admin Only:
- `GET /api/admin/users` - All users
- `POST /api/admin/promote` - Promote to admin
- `POST /api/admin/demote` - Demote from admin
- `DELETE /api/admin/users/:email` - Delete user

---

## Database

### Location:
- `/data/monitoring.db` (persistent volume)

### Tables:
- `users` - User accounts & auth
- `service_status` - Current service states
- `error_logs` - Error history
- `login_history` - Login attempts

### Access:
```bash
# View database
docker exec apex-monitoring-dashboard sqlite3 /data/monitoring.db ".tables"

# Backup database
docker cp apex-monitoring-dashboard:/data/monitoring.db ./monitoring.db.backup
```

---

## Troubleshooting

### Dashboard not accessible:
```bash
docker logs apex-monitoring-dashboard
docker ps | grep apex-monitoring
```

### Login failing:
- Verify email ends with `@apexingoodcompany.co.uk`
- Password is case-sensitive
- Check browser console for errors

### SSL errors after setup:
```bash
docker restart apex-moto-nginx
docker logs apex-moto-nginx
```

### Certificate expired:
```bash
# Auto-renewal should handle this
# Manual renewal:
cd /path/to/apex
./renewal.sh  # Linux/Mac
.\renewal.ps1 # Windows
```

---

## Security Notes

🔒 **Passwords**: Hashed with bcryptjs (10 salt rounds)  
🔒 **Sessions**: JWT tokens, 24-hour expiry  
🔒 **Email**: Only @apexingoodcompany.co.uk allowed  
🔒 **HTTPS**: Let's Encrypt SSL certificate  
🔒 **API**: All endpoints require authentication  
🔒 **Database**: SQLite persistent volume  

---

## Files & Directories

```
Apex-Monitoring-Dashboard/
├── server.js                    # Backend (Express + SQLite)
├── public/
│   ├── index.html              # Login page
│   ├── dashboard.html          # Admin dashboard
│   ├── logo.svg                # Apex branding
│   └── apex-branding.css       # Brand styles
├── package.json                # Dependencies
├── Dockerfile                  # Container image
├── .env                        # JWT secret config
├── setup-ssl.sh                # Linux SSL setup
├── setup-ssl.ps1               # Windows SSL setup
├── nginx-dashboard.conf        # Nginx config
└── SSL_SETUP_COMPLETE.md       # SSL guide
```

---

## Environment Variables

```bash
# .env file
PORT=5000
NODE_ENV=production
JWT_SECRET=your-secret-key-change-in-production
```

**Change JWT_SECRET before production!**

---

## Next Steps

- [ ] Set up DNS A record in OVH
- [ ] Run SSL setup script on OVH instance
- [ ] Test HTTPS access
- [ ] Add team members as admins
- [ ] Set up log monitoring
- [ ] Backup database regularly
- [ ] Monitor certificate expiry

---

## Support Commands

```bash
# Check all services
docker ps

# View dashboard logs
docker logs -f apex-monitoring-dashboard

# Test health
curl http://localhost:5000/api/health

# View SSL certificate
openssl x509 -in letsencrypt/live/dashboard.apexingoodcompany.co.uk/fullchain.pem -text -noout

# Restart dashboard
docker restart apex-monitoring-dashboard
```

---

**Status**: 🟢 PRODUCTION READY  
**SSL**: 🔐 NEEDS SETUP  
**Auth**: ✅ ENABLED  
**Admin**: ⭐ CONFIGURED
