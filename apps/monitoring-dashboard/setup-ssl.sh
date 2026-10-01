#!/bin/bash

# ============================================================================
# APEX DASHBOARD - LET'S ENCRYPT SSL CERTIFICATE SETUP
# For: dashboard.apexingoodcompany.co.uk
# ============================================================================

set -e

echo "⚡ APEX DASHBOARD - SSL CERTIFICATE SETUP"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="dashboard.apexingoodcompany.co.uk"
EMAIL="adam@apexingoodcompany.co.uk"
CERT_DIR="./letsencrypt"
WEBROOT_DIR="./certbot-webroot"

# Step 1: Verify DNS
echo -e "${YELLOW}Step 1: Verifying DNS configuration...${NC}"
if nslookup $DOMAIN > /dev/null 2>&1; then
    echo -e "${GREEN}✓ DNS resolves for $DOMAIN${NC}"
else
    echo -e "${RED}✗ DNS does not resolve for $DOMAIN${NC}"
    echo "Please ensure DNS A record is set in OVH Control Panel:"
    echo "  Subdomain: dashboard"
    echo "  Type: A"
    echo "  Target: YOUR.PUBLIC.IP"
    echo ""
    echo "Wait 15-30 minutes for DNS propagation, then try again."
    exit 1
fi

# Step 2: Create directories
echo ""
echo -e "${YELLOW}Step 2: Creating directories...${NC}"
mkdir -p $CERT_DIR
mkdir -p $WEBROOT_DIR
chmod 755 $CERT_DIR
chmod 755 $WEBROOT_DIR
echo -e "${GREEN}✓ Directories created${NC}"

# Step 3: Get SSL certificate
echo ""
echo -e "${YELLOW}Step 3: Obtaining SSL certificate from Let's Encrypt...${NC}"
echo "This may take 1-2 minutes..."
echo ""

docker run --rm \
  -v $(pwd)/$CERT_DIR:/etc/letsencrypt \
  -v $(pwd)/$WEBROOT_DIR:/var/www/certbot \
  -p 80:80 \
  -p 443:443 \
  certbot/certbot certonly \
  --standalone \
  --agree-tos \
  --no-eff-email \
  --email $EMAIL \
  -d $DOMAIN

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Certificate obtained successfully!${NC}"
else
    echo -e "${RED}✗ Failed to obtain certificate${NC}"
    exit 1
fi

# Step 4: Verify certificate
echo ""
echo -e "${YELLOW}Step 4: Verifying certificate...${NC}"

CERT_PATH="$CERT_DIR/live/$DOMAIN/fullchain.pem"
if [ -f "$CERT_PATH" ]; then
    echo -e "${GREEN}✓ Certificate file found${NC}"
    
    # Show expiry date
    EXPIRY=$(docker run --rm -v $(pwd)/$CERT_DIR:/etc/letsencrypt \
      certbot/certbot certificates 2>/dev/null | grep "expiry" | head -1)
    echo "  $EXPIRY"
else
    echo -e "${RED}✗ Certificate file not found at $CERT_PATH${NC}"
    exit 1
fi

# Step 5: Create auto-renewal script
echo ""
echo -e "${YELLOW}Step 5: Setting up auto-renewal...${NC}"

cat > renewal.sh << 'EOF'
#!/bin/bash

# Auto-renew Let's Encrypt certificate
echo "Renewing Let's Encrypt certificate..."

docker run --rm \
  -v ./letsencrypt:/etc/letsencrypt \
  -v ./certbot-webroot:/var/www/certbot \
  -p 80:80 \
  -p 443:443 \
  certbot/certbot renew \
  --quiet

# Reload nginx if it's running
if docker ps | grep -q apex-moto-nginx; then
    echo "Reloading nginx..."
    docker exec apex-moto-nginx nginx -s reload
fi

echo "Certificate renewal complete"
EOF

chmod +x renewal.sh
echo -e "${GREEN}✓ Auto-renewal script created (renewal.sh)${NC}"

# Step 6: Add to crontab
echo ""
echo -e "${YELLOW}Step 6: Adding to crontab for monthly renewal...${NC}"

CRON_JOB="0 2 1 * * $(pwd)/renewal.sh"
(crontab -l 2>/dev/null | grep -v "renewal.sh"; echo "$CRON_JOB") | crontab -

echo -e "${GREEN}✓ Cron job added (runs 1st of month at 2am)${NC}"

# Step 7: Next steps
echo ""
echo -e "${GREEN}=========================================="
echo "✓ SSL CERTIFICATE SETUP COMPLETE!"
echo "==========================================${NC}"
echo ""
echo "Next steps:"
echo ""
echo "1. Update nginx configuration:"
echo "   cp Apex-Monitoring-Dashboard/nginx-dashboard.conf ./nginx.conf"
echo ""
echo "2. Update Apex-Moto-Co/docker-compose.yml volumes:"
echo "   volumes:"
echo "     - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro"
echo "     - ./letsencrypt:/etc/letsencrypt:ro"
echo "     - ./certbot-webroot:/var/www/certbot:rw"
echo ""
echo "3. Start nginx:"
echo "   cd Apex-Moto-Co"
echo "   docker compose up -d apex-moto-nginx"
echo ""
echo "4. Test HTTPS:"
echo "   curl -I https://$DOMAIN"
echo "   Should return HTTP 200"
echo ""
echo "Certificate Details:"
echo "  Location: $CERT_DIR/live/$DOMAIN/"
echo "  Auto-renewal: Enabled (runs monthly)"
echo "  Renewal script: ./renewal.sh"
echo ""
echo "Certificate will automatically renew 30 days before expiry."
echo ""
