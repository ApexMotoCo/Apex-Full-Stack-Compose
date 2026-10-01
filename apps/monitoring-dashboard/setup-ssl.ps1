# ============================================================================
# APEX DASHBOARD - LET'S ENCRYPT SSL CERTIFICATE SETUP (Windows PowerShell)
# For: dashboard.apexingoodcompany.co.uk
# ============================================================================

$ErrorActionPreference = "Stop"

Write-Host "⚡ APEX DASHBOARD - SSL CERTIFICATE SETUP" -ForegroundColor Cyan
Write-Host "==========================================`n" -ForegroundColor Cyan

# Configuration
$DOMAIN = "dashboard.apexingoodcompany.co.uk"
$EMAIL = "adam@apexingoodcompany.co.uk"
$CERT_DIR = "letsencrypt"
$WEBROOT_DIR = "certbot-webroot"

# Function to show errors in red
function Write-Error-Message {
    param([string]$message)
    Write-Host "✗ $message" -ForegroundColor Red
}

# Function to show success in green
function Write-Success {
    param([string]$message)
    Write-Host "✓ $message" -ForegroundColor Green
}

# Function to show info in yellow
function Write-Info {
    param([string]$message)
    Write-Host "ℹ $message" -ForegroundColor Yellow
}

try {
    # Step 1: Verify DNS
    Write-Info "Step 1: Verifying DNS configuration..."
    try {
        $result = [System.Net.Dns]::GetHostAddresses($DOMAIN)
        Write-Success "DNS resolves for $DOMAIN"
        Write-Info "  IP: $($result[0].IPAddressToString)"
    }
    catch {
        Write-Error-Message "DNS does not resolve for $DOMAIN"
        Write-Info ""
        Write-Host "Please ensure DNS A record is set in OVH Control Panel:" -ForegroundColor Yellow
        Write-Host "  Subdomain: dashboard" -ForegroundColor Gray
        Write-Host "  Type: A" -ForegroundColor Gray
        Write-Host "  Target: YOUR.PUBLIC.IP" -ForegroundColor Gray
        Write-Host ""
        Write-Info "Wait 15-30 minutes for DNS propagation, then try again."
        exit 1
    }

    # Step 2: Create directories
    Write-Info "`nStep 2: Creating directories..."
    New-Item -ItemType Directory -Force -Path $CERT_DIR | Out-Null
    New-Item -ItemType Directory -Force -Path $WEBROOT_DIR | Out-Null
    Write-Success "Directories created"

    # Step 3: Get SSL certificate
    Write-Info "`nStep 3: Obtaining SSL certificate from Let's Encrypt..."
    Write-Host "This may take 1-2 minutes...`n" -ForegroundColor Yellow

    $currentDir = Get-Location
    
    $certbotCmd = @(
        "run", "--rm",
        "-v", "$currentDir\$CERT_DIR`:/etc/letsencrypt",
        "-v", "$currentDir\$WEBROOT_DIR`:/var/www/certbot",
        "-p", "80:80",
        "-p", "443:443",
        "certbot/certbot", "certonly",
        "--standalone",
        "--agree-tos",
        "--no-eff-email",
        "--email", $EMAIL,
        "-d", $DOMAIN
    )

    & docker $certbotCmd
    
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Message "Failed to obtain certificate"
        exit 1
    }

    Write-Success "Certificate obtained successfully!"

    # Step 4: Verify certificate
    Write-Info "`nStep 4: Verifying certificate..."

    $CERT_PATH = "$CERT_DIR\live\$DOMAIN\fullchain.pem"
    if (Test-Path $CERT_PATH) {
        Write-Success "Certificate file found"
        Write-Info "  Location: $CERT_PATH"
    }
    else {
        Write-Error-Message "Certificate file not found at $CERT_PATH"
        exit 1
    }

    # Step 5: Create auto-renewal script
    Write-Info "`nStep 5: Setting up auto-renewal..."

    $renewalScriptContent = @'
# Auto-renew Let's Encrypt certificate for Apex Dashboard
Write-Host "Renewing Let's Encrypt certificate..." -ForegroundColor Cyan

$currentDir = Get-Location

$certbotCmd = @(
    "run", "--rm",
    "-v", "$currentDir\letsencrypt:/etc/letsencrypt",
    "-v", "$currentDir\certbot-webroot:/var/www/certbot",
    "-p", "80:80",
    "-p", "443:443",
    "certbot/certbot", "renew",
    "--quiet"
)

& docker $certbotCmd

# Reload nginx if it's running
$nginxContainer = & docker ps --format "table {{.Names}}" 2>$null | Select-String "apex-moto-nginx"
if ($nginxContainer) {
    Write-Host "Reloading nginx..." -ForegroundColor Cyan
    & docker exec apex-moto-nginx nginx -s reload
}

Write-Host "Certificate renewal complete" -ForegroundColor Green
'@

    $renewalScriptContent | Out-File -FilePath "renewal.ps1" -Encoding UTF8 -Force
    Write-Success "Auto-renewal script created (renewal.ps1)"

    # Step 6: Create scheduled task
    Write-Info "`nStep 6: Setting up scheduled task for renewal..."

    $taskName = "Apex-Dashboard-SSL-Renewal"
    $scriptPath = (Get-Item "renewal.ps1").FullName

    # Remove existing task if it exists
    try {
        Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
        Write-Info "  Removed existing scheduled task"
    }
    catch {}

    # Create task action
    $action = New-ScheduledTaskAction -Execute "powershell.exe" `
        -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""

    # Create trigger - run every Monday at 2am
    $trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 2am

    # Register the task
    Register-ScheduledTask -TaskName $taskName `
        -Action $action `
        -Trigger $trigger `
        -RunLevel Highest `
        -Description "Auto-renew Let's Encrypt certificate for Apex Dashboard" `
        -Force | Out-Null

    Write-Success "Scheduled task created (runs Mondays at 2am)"

    # Final summary
    Write-Host "`n" 
    Write-Host "===========================================" -ForegroundColor Green
    Write-Host "✓ SSL CERTIFICATE SETUP COMPLETE!" -ForegroundColor Green
    Write-Host "==========================================`n" -ForegroundColor Green

    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Update nginx configuration:" -ForegroundColor White
    Write-Host "   Copy-Item Apex-Monitoring-Dashboard\nginx-dashboard.conf -Destination nginx.conf" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Update Apex-Moto-Co\docker-compose.yml volumes:" -ForegroundColor White
    Write-Host "   volumes:" -ForegroundColor Gray
    Write-Host "     - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro" -ForegroundColor Gray
    Write-Host "     - ./letsencrypt:/etc/letsencrypt:ro" -ForegroundColor Gray
    Write-Host "     - ./certbot-webroot:/var/www/certbot:rw" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. Start nginx:" -ForegroundColor White
    Write-Host "   cd Apex-Moto-Co" -ForegroundColor Gray
    Write-Host "   docker compose up -d apex-moto-nginx" -ForegroundColor Gray
    Write-Host ""
    Write-Host "4. Test HTTPS:" -ForegroundColor White
    Write-Host "   curl -I https://$DOMAIN" -ForegroundColor Gray
    Write-Host "   Should return HTTP 200" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Certificate Details:" -ForegroundColor Cyan
    Write-Host "  Location: $CERT_DIR\live\$DOMAIN\" -ForegroundColor Gray
    Write-Host "  Auto-renewal: Enabled (Mondays at 2am)" -ForegroundColor Gray
    Write-Host "  Renewal script: .\renewal.ps1" -ForegroundColor Gray
    Write-Host "  Scheduled task: $taskName" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Certificate will automatically renew 30 days before expiry." -ForegroundColor Green
    Write-Host ""
}
catch {
    Write-Error-Message "An error occurred: $_"
    exit 1
}
