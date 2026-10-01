# 🔐 APEX DASHBOARD - COMPLETE SSL SETUP GUIDE

## Overview

This guide walks through setting up Let's Encrypt SSL for `dashboard.apexingoodcompany.co.uk` on your OVH Cloud instance.

**Prerequisites:**
- ✅ DNS A record created in OVH for `dashboard.apexingoodcompany.co.uk`
- ✅ Public IP from OVH Cloud
- ✅ Docker and docker-compose installed
- ✅ SSH access to your OVH server
- ✅ Ports 80 and 443 available

---

## Step 1: Prepare Your OVH Instance

### SSH into your server:
```bash
ssh root@YOUR.PUBLIC.IP
```

### Navigate to your Apex directory:
```bash
cd /path/to/apex
```

### Verify DNS is working:
```bash
nslookup dashboard.apexingoodcompany.co.uk
# Should return your public IP
```

If DNS doesn't resolve, wait 15-30 minutes and try again.

---

## Step 2: Run SSL Setup Script

### Option A: Linux/Mac
```bash
chmod +x setup-ssl.sh
./setup-ssl.sh
```

### Option B: Windows PowerShell
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\setup-ssl.ps1
```

### Option C: Manual Setup (if scripts don't work)

**Create directories:**
```bash
mkdir -p letsencrypt
mkdir -p certbot-webroot
chmod 755 letsencrypt certbot-webroot
```

**Get certificate:**
```bash
docker run --rm \
  -v $(pwd)/letsencrypt:/etc/letsencrypt \
  -v $(pwd)/certbot-webroot:/var/www/certbot \
  -p 80:80 \
  -p 443:443 \
  certbot/certbot certonly \
  --standalone \
  --agree-tos \
  --no-eff-email \
  --email adam@apexingoodcompany.co.uk \
  -d dashboard.apexingoodcompany.co.uk
```

**Verify certificate:**
```bash
ls -la letsencrypt/live/dashboard.apexingoodcompany.co.uk/
# Should show: fullchain.pem, privkey.pem, chain.pem
```

---

## Step 3: Update Nginx Configuration

### Copy dashboard nginx config:
```bash
cp Apex-Monitoring-Dashboard/nginx-dashboard.conf ./nginx.conf
```

### Update Apex-Moto-Co/docker-compose.yml

Find the `apex-moto-nginx` service and update volumes:

```yaml
apex-moto-nginx:
  image: nginx:alpine
  container_name: apex-moto-nginx
  ports:
    - "80:80"
    - "443:443"
  volumes:
    - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - ./letsencrypt:/etc/letsencrypt:ro
    - ./certbot-webroot:/var/www/certbot:rw
  depends_on:
    - apex-moto-co-web
  restart: unless-stopped
  networks:
    - app-network
```

---

## Step 4: Start Nginx with SSL

```bash
cd Apex-Moto-Co
docker compose up -d apex-moto-nginx
```

### Verify nginx is running:
```bash
docker logs apex-moto-nginx
# Should show "nginx" running without errors
```

---

## Step 5: Test SSL Certificate

```bash
curl -I https://dashboard.apexingoodcompany.co.uk
```

**Expected response:**
```
HTTP/2 200
content-type: text/html; charset=utf-8
strict-transport-security: max-age=31536000; includeSubDomains
```

### Test in browser:
Visit: **https://dashboard.apexingoodcompany.co.uk**
- Should load without SSL warnings
- Shows green padlock in address bar

---

## Step 6: Verify Auto-Renewal

### Check scheduled renewal:

**Linux:**
```bash
crontab -l | grep renewal
# Should show: 0 2 1 * * /path/to/renewal.sh
```

**Windows:**
```powershell
Get-ScheduledTask -TaskName "Apex-Dashboard-SSL-Renewal" | fl
```

### Manual renewal (optional):
```bash
# Linux
./renewal.sh

# Windows PowerShell
.\renewal.ps1
```

---

## Step 7: Login to Dashboard

1. Visit: **https://dashboard.apexingoodcompany.co.uk**
2. Register with: `adam@apexingoodcompany.co.uk`
3. Set a strong password
4. You're logged in as **Super Admin** ⭐

---

## Certificate Details

### Location:
```
letsencrypt/live/dashboard.apexingoodcompany.co.uk/
├── fullchain.pem    (Public certificate)
├── privkey.pem      (Private key)
└── chain.pem        (CA chain)
```

### Validity:
- **Duration**: 90 days (Let's Encrypt standard)
- **Auto-renewal**: 30 days before expiry
- **Next renewal**: Automatic (monthly scheduled)

### Check expiry:
```bash
docker run --rm \
  -v $(pwd)/letsencrypt:/etc/letsencrypt \
  certbot/certbot certificates
```

---

## Troubleshooting

### Certificate not loading
```bash
# Check nginx can read certificates
ls -la letsencrypt/live/dashboard.apexingoodcompany.co.uk/

# Check nginx config syntax
docker exec apex-moto-nginx nginx -t

# Restart nginx
docker restart apex-moto-nginx

# View nginx error log
docker logs apex-moto-nginx
```

### DNS not resolving
```bash
# Flush DNS cache:
# macOS
dscacheutil -flushcache

# Linux
sudo systemctl restart systemd-resolved

# Windows
ipconfig /flushdns

# Verify again
nslookup dashboard.apexingoodcompany.co.uk
```

### Port 80/443 in use
```bash
# Find process using port
lsof -i :80
lsof -i :443

# Kill process if needed
kill -9 <PID>
```

### Certificate renewal failed
```bash
# Check renewal script logs
tail -f /var/log/syslog | grep certbot

# Manual renewal with verbose output
docker run --rm \
  -v $(pwd)/letsencrypt:/etc/letsencrypt \
  -v $(pwd)/certbot-webroot:/var/www/certbot \
  -p 80:80 \
  -p 443:443 \
  certbot/certbot renew \
  --verbose
```

---

## Security Checklist

✅ SSL certificate obtained from Let's Encrypt  
✅ Certificate auto-renewal configured  
✅ Nginx configured for HTTPS only  
✅ Security headers enabled (HSTS, X-Frame-Options, etc.)  
✅ Admin user created (adam@apexingoodcompany.co.uk)  
✅ Email domain validation active  
✅ Authentication required for all endpoints  
✅ JWT tokens with 24-hour expiry  

---

## Next Steps

1. **Monitor certificate expiry:**
   ```bash
   # Check automatically (Linux)
   watch -n 86400 'docker run --rm -v $(pwd)/letsencrypt:/etc/letsencrypt certbot/certbot certificates'
   ```

2. **Enable additional admins:**
   - Login to dashboard at https://dashboard.apexingoodcompany.co.uk
   - Click Admin button (top right)
   - Promote other @apexingoodcompany.co.uk users to admin

3. **Monitor logs:**
   ```bash
   docker logs -f apex-moto-nginx
   docker logs -f apex-monitoring-dashboard
   ```

4. **Backup certificates:**
   ```bash
   tar -czf letsencrypt-backup-$(date +%Y%m%d).tar.gz letsencrypt/
   ```

---

## Support

| Issue | Command |
|-------|---------|
| Check cert status | `docker run --rm -v $(pwd)/letsencrypt:/etc/letsencrypt certbot/certbot certificates` |
| View nginx error log | `docker logs apex-moto-nginx` |
| View dashboard logs | `docker logs apex-monitoring-dashboard` |
| Test HTTPS | `curl -I https://dashboard.apexingoodcompany.co.uk` |
| Manual renewal | `./renewal.sh` or `.\renewal.ps1` |

---

**SSL Status**: 🟢 ACTIVE  
**Certificate Authority**: Let's Encrypt  
**Auto-Renewal**: ✅ Enabled  
**Security Level**: 🔒 Maximum
