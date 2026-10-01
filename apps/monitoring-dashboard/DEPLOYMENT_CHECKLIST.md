# ⚡ APEX DASHBOARD - PRODUCTION DEPLOYMENT CHECKLIST

## 🔒 Login System Implemented

✅ **Authentication**
- Email validation (@apexingoodcompany.co.uk only)
- Password hashing with bcryptjs
- JWT token-based sessions (24-hour expiry)
- Login history tracking
- User registration & password validation

✅ **Protected API**
- All monitoring endpoints require authentication
- Unauthorized access returns 401/403
- Token validation on every request
- Session management with express-session

✅ **Frontend**
- Login page with registration option
- Email domain validation
- Password strength requirements (8+ chars)
- Branded login interface
- Error/success messaging
- Secure token storage

---

## 🌐 DNS & SSL Setup Required

### For Your OVH Cloud Instance:

**1. DNS Configuration**
- [ ] Get your public IP from OVH Cloud
- [ ] Add DNS A record for `dashboard.apexingoodcompany.co.uk`
- [ ] Point to your public IP
- [ ] Wait 15-30 minutes for propagation
- [ ] Verify: `nslookup dashboard.apexingoodcompany.co.uk`

**2. SSL Certificate (Let's Encrypt)**
```bash
# From your server/VM:
docker run --rm \
  -v ./letsencrypt:/etc/letsencrypt \
  -v ./certbot-webroot:/var/www/certbot \
  -p 80:80 \
  -p 443:443 \
  certbot/certbot certonly \
  --standalone \
  --agree-tos \
  --no-eff-email \
  -d dashboard.apexingoodcompany.co.uk
```

**3. Update Nginx**
- [ ] Copy nginx-dashboard.conf to nginx.conf
- [ ] Update docker-compose volumes for letsencrypt
- [ ] Start nginx with SSL config

**4. Test SSL**
```bash
curl https://dashboard.apexingoodcompany.co.uk -I
# Should return 200 OK
```

---

## 📋 Deployment Steps

### Step 1: Prepare Your OVH VM
```bash
# SSH into your OVH Cloud instance
ssh root@YOUR.PUBLIC.IP

# Clone or navigate to your repo
cd /path/to/apex

# Create required directories
mkdir -p letsencrypt certbot-webroot
chmod 755 letsencrypt certbot-webroot
```

### Step 2: Get SSL Certificate
```bash
# On your OVH instance, run certbot
docker pull certbot/certbot

docker run --rm \
  -v $(pwd)/letsencrypt:/etc/letsencrypt \
  -v $(pwd)/certbot-webroot:/var/www/certbot \
  -p 80:80 \
  -p 443:443 \
  certbot/certbot certonly \
  --standalone \
  --agree-tos \
  --no-eff-email \
  -d dashboard.apexingoodcompany.co.uk

# Verify certificate was created
ls -la letsencrypt/live/dashboard.apexingoodcompany.co.uk/
```

### Step 3: Configure Nginx
```bash
# Copy dashboard nginx config
cp Apex-Monitoring-Dashboard/nginx-dashboard.conf ./nginx.conf

# Update your Apex-Moto-Co docker-compose.yml
# volumes section should include:
#   - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
#   - ./letsencrypt:/etc/letsencrypt:ro
```

### Step 4: Create Shared Network
```bash
docker network create apex-shared
```

### Step 5: Start All Services
```bash
# Start Apex Moto Co
cd Apex-Moto-Co
docker compose up -d

# Start Asset Management
cd ../Apex-Asset-Management-GIT
docker compose up -d

# Start OpenVPN
docker run -d \
  --network apex-shared \
  -p 943:943 -p 1194:1194/udp -p 8443:443 \
  --cap-add=NET_ADMIN \
  --name apex-openvpn \
  openvpn/openvpn-as:latest

# Start Dashboard
docker run -d \
  --network apex-shared \
  --name apex-monitoring-dashboard \
  -p 5000:5000 \
  -v monitoring_data:/data \
  --restart unless-stopped \
  apex-monitoring-dashboard:latest
```

### Step 6: Setup Auto-Renewal
```bash
# Create renewal script
cat > renewal.sh << 'EOF'
#!/bin/bash
docker run --rm \
  -v ./letsencrypt:/etc/letsencrypt \
  -v ./certbot-webroot:/var/www/certbot \
  -p 80:80 \
  -p 443:443 \
  certbot/certbot renew \
  --quiet

docker exec apex-moto-nginx nginx -s reload
EOF

chmod +x renewal.sh

# Add to crontab (monthly)
(crontab -l 2>/dev/null; echo "0 2 1 * * $(pwd)/renewal.sh") | crontab -
```

---

## 📊 Service Status

**After Deployment, Access:**
- **Dashboard**: https://dashboard.apexingoodcompany.co.uk
- **Website**: http://localhost:3000 or http://apexingoodcompany.co.uk
- **Asset Frontend**: http://localhost:3001
- **Asset Backend API**: http://localhost:8000
- **VPN Admin**: https://localhost:943

---

## 🔐 First Login

1. Visit: https://dashboard.apexingoodcompany.co.uk
2. Click "Register here"
3. Enter details:
   - Name: Your Name
   - Email: your@apexingoodcompany.co.uk
   - Password: Strong password (8+ chars)
4. Click Register
5. Login with credentials
6. Access full monitoring dashboard

---

## 🔄 SSL Certificate Renewal

**Automatic renewal happens:**
- 30 days before expiry (via cron job)
- Certbot checks certificate status monthly
- Nginx reloads automatically after renewal

**Manual renewal (if needed):**
```bash
./renewal.sh
```

**Check certificate expiry:**
```bash
docker run --rm \
  -v ./letsencrypt:/etc/letsencrypt \
  certbot/certbot certificates
```

---

## 📈 Database Setup

**User Database:**
- Stores: email, hashed password, name, timestamps
- Location: `/data/monitoring.db` (persistent volume)
- Encrypted: bcryptjs hashing

**Monitoring Database:**
- Stores: service status, error logs, health checks
- Tables: service_status, error_logs, login_history
- Retention: All history kept indefinitely

---

## 🛡️ Security Features

✅ Email domain validation (@apexingoodcompany.co.uk only)  
✅ Password hashing (bcryptjs - 10 salt rounds)  
✅ JWT tokens with 24-hour expiry  
✅ HTTP-only secure cookies  
✅ CSRF protection via sessions  
✅ Rate limiting recommended (add middleware)  
✅ HTTPS/TLS encryption  
✅ Login history tracking  
✅ Protected API endpoints  
✅ Input validation  

---

## 🚨 Troubleshooting

### Certificate Issues
```bash
# Check if cert exists
ls -la letsencrypt/live/dashboard.apexingoodcompany.co.uk/

# Restart nginx
docker restart apex-moto-nginx

# Check nginx logs
docker logs apex-moto-nginx
```

### DNS Resolution
```bash
# Test DNS
nslookup dashboard.apexingoodcompany.co.uk
dig dashboard.apexingoodcompany.co.uk

# Clear cache if needed
# Linux: systemctl restart systemd-resolved
# macOS: dscacheutil -flushcache
```

### Login Not Working
- Verify email ends with @apexingoodcompany.co.uk
- Check dashboard logs: `docker logs apex-monitoring-dashboard`
- Verify database: `docker exec apex-monitoring-dashboard sqlite3 /data/monitoring.db ".tables"`

### Services Not Showing
- Verify all services on `apex-shared` network
- Check health endpoints responding
- Review docker logs for each service

---

## 📞 Support URLs

- **Dashboard**: https://dashboard.apexingoodcompany.co.uk
- **API Health**: https://dashboard.apexingoodcompany.co.uk/api/health
- **API Status**: https://dashboard.apexingoodcompany.co.uk/api/status (requires auth)

---

## ✅ Deployment Verification

Run this after deployment:

```bash
# 1. Check all containers running
docker ps | grep apex

# 2. Test dashboard accessibility
curl -I https://dashboard.apexingoodcompany.co.uk

# 3. Check shared network
docker network inspect apex-shared

# 4. Test login API
curl -X POST https://dashboard.apexingoodcompany.co.uk/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@apexingoodcompany.co.uk","password":"password"}'

# 5. Check certificates
docker run --rm -v ./letsencrypt:/etc/letsencrypt certbot/certbot certificates

# 6. Verify DNS
nslookup dashboard.apexingoodcompany.co.uk
```

---

**Deployment Status**: 🟢 READY  
**Authentication**: 🔐 ENABLED  
**SSL Configuration**: 📋 DOCUMENTED  
**Last Updated**: 2024-01-15
