# 🔐 APEX DASHBOARD - SSL & DNS SETUP GUIDE

## Step 1: Update OVH DNS Records

Go to OVH Control Panel → Domains → apexingoodcompany.co.uk → DNS

**Add this A record:**
```
Subdomain: dashboard
Type: A
TTL: 3600
Target: YOUR.PUBLIC.IP (from OVH Cloud)
```

**Wait 15-30 minutes for DNS to propagate**

Verify with:
```bash
nslookup dashboard.apexingoodcompany.co.uk
# Should return your public IP
```

---

## Step 2: Update Nginx Configuration

Replace nginx config with dashboard version:

```bash
# Copy the dashboard nginx config
cp Apex-Monitoring-Dashboard/nginx-dashboard.conf ./nginx.conf

# Update Apex-Moto-Co/docker-compose.yml volumes:
volumes:
  - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
  - ./letsencrypt:/etc/letsencrypt:ro
  - ./certbot-webroot:/var/www/certbot:rw
```

---

## Step 3: Get Let's Encrypt Certificate with Certbot

Run certbot in standalone mode to get certificate:

```bash
# Pull certbot image
docker pull certbot/certbot

# Get certificate (run this BEFORE starting nginx)
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

**During the certbot prompt:**
- Email: your@apexingoodcompany.co.uk
- Agree to TOS: yes

This creates certificates in `./letsencrypt/live/dashboard.apexingoodcompany.co.uk/`

---

## Step 4: Start Services with SSL

```bash
# Start dashboard (rebuild with new dependencies)
docker build -t apex-monitoring-dashboard:latest Apex-Monitoring-Dashboard/

# Start dashboard on shared network
docker run -d \
  --network apex-shared \
  --name apex-monitoring-dashboard \
  -p 5000:5000 \
  -v monitoring_data:/data \
  --restart unless-stopped \
  apex-monitoring-dashboard:latest

# Start nginx (will use certificates)
cd Apex-Moto-Co
docker compose up -d apex-moto-nginx
```

---

## Step 5: Test SSL

```bash
# Check certificate
curl https://dashboard.apexingoodcompany.co.uk -I

# Should return 200 OK
```

---

## Step 6: Auto-Renew SSL Certificate

Create a renewal script:

```bash
# renewal.sh
#!/bin/bash
docker run --rm \
  -v ./letsencrypt:/etc/letsencrypt \
  -v ./certbot-webroot:/var/www/certbot \
  -p 80:80 \
  -p 443:443 \
  certbot/certbot renew \
  --quiet

# Reload nginx
docker exec apex-moto-nginx nginx -s reload
```

Make it executable and add to crontab (runs monthly):

```bash
chmod +x renewal.sh

# Add to crontab (monthly renewal on 1st of month at 2am)
crontab -e
0 2 1 * * /path/to/renewal.sh
```

---

## Step 7: Login to Dashboard

1. Visit: **https://dashboard.apexingoodcompany.co.uk**
2. Register with your @apexingoodcompany.co.uk email
3. Login to access monitoring

---

## Dashboard Features

✅ **Authentication**: Only @apexingoodcompany.co.uk emails  
✅ **SSL/TLS**: Let's Encrypt certificate  
✅ **Sessions**: 24-hour JWT tokens  
✅ **Monitoring**: Real-time service status  
✅ **Errors**: Error logging & tracking  
✅ **Protected API**: All endpoints require authentication  

---

## Troubleshooting

### Certificate not found
```bash
# Check certificate location
ls -la ./letsencrypt/live/dashboard.apexingoodcompany.co.uk/

# Restart nginx
docker restart apex-moto-nginx
```

### DNS not resolving
```bash
# Clear DNS cache (depends on OS)
# Linux: systemctl restart systemd-resolved
# Mac: dscacheutil -flushcache
# Windows: ipconfig /flushdns

# Verify again
nslookup dashboard.apexingoodcompany.co.uk
```

### Login not working
- Ensure email is @apexingoodcompany.co.uk
- Check browser console for errors
- Check docker logs: `docker logs apex-monitoring-dashboard`

### SSL errors
```bash
# Check nginx syntax
docker exec apex-moto-nginx nginx -t

# View nginx error log
docker exec apex-moto-nginx cat /var/log/nginx/error.log
```

---

## File Locations

- **Certificates**: `./letsencrypt/live/dashboard.apexingoodcompany.co.uk/`
- **Nginx config**: `./nginx.conf`
- **Dashboard code**: `Apex-Monitoring-Dashboard/`
- **Database**: Volume `monitoring_data:/data`

---

**SSL Certificate Auto-Renewal**: Certbot renews 30 days before expiry  
**Certificate Validity**: 90 days (Let's Encrypt standard)  
**Next Renewal**: Check with `certbot certificates`
