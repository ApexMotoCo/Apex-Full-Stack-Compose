@echo off
REM ============================================================================
REM APEX DASHBOARD - LET'S ENCRYPT SSL CERTIFICATE SETUP (Windows Batch)
REM For: dashboard.apexingoodcompany.co.uk
REM ============================================================================

setlocal enabledelayedexpansion

cls
echo.
echo ============================================================================
echo ⚡ APEX DASHBOARD - SSL CERTIFICATE SETUP (WINDOWS)
echo ============================================================================
echo.

REM Configuration
set DOMAIN=dashboard.apexingoodcompany.co.uk
set EMAIL=adam@apexingoodcompany.co.uk
set CERT_DIR=letsencrypt
set WEBROOT_DIR=certbot-webroot

REM Step 1: Verify DNS
echo Step 1: Verifying DNS configuration...
nslookup %DOMAIN% >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERROR: DNS does not resolve for %DOMAIN%
    echo.
    echo Please ensure DNS A record is set in OVH Control Panel:
    echo   Subdomain: dashboard
    echo   Type: A
    echo   Target: YOUR.PUBLIC.IP
    echo.
    echo Wait 15-30 minutes for DNS propagation, then try again.
    echo.
    pause
    exit /b 1
)
echo ✓ DNS resolves for %DOMAIN%
echo.

REM Step 2: Create directories
echo Step 2: Creating directories...
if not exist "%CERT_DIR%" mkdir "%CERT_DIR%"
if not exist "%WEBROOT_DIR%" mkdir "%WEBROOT_DIR%"
echo ✓ Directories created
echo.

REM Step 3: Get SSL certificate
echo Step 3: Obtaining SSL certificate from Let's Encrypt...
echo This may take 1-2 minutes...
echo.

for /f "delims=" %%A in ('cd') do set "CURRENT_DIR=%%A"

docker run --rm ^
  -v "%CURRENT_DIR%\%CERT_DIR%:/etc/letsencrypt" ^
  -v "%CURRENT_DIR%\%WEBROOT_DIR%:/var/www/certbot" ^
  -p 80:80 ^
  -p 443:443 ^
  certbot/certbot certonly ^
  --standalone ^
  --agree-tos ^
  --no-eff-email ^
  --email %EMAIL% ^
  -d %DOMAIN%

if errorlevel 1 (
    echo.
    echo ERROR: Failed to obtain certificate
    echo.
    pause
    exit /b 1
)

echo.
echo ✓ Certificate obtained successfully!
echo.

REM Step 4: Verify certificate
echo Step 4: Verifying certificate...

set "CERT_PATH=%CERT_DIR%\live\%DOMAIN%\fullchain.pem"
if exist "%CERT_PATH%" (
    echo ✓ Certificate file found
    echo   Location: %CERT_PATH%
) else (
    echo ERROR: Certificate file not found at %CERT_PATH%
    echo.
    pause
    exit /b 1
)
echo.

REM Step 5: Create auto-renewal script
echo Step 5: Setting up auto-renewal...

(
echo @echo off
echo REM Auto-renew Let's Encrypt certificate for Apex Dashboard
echo echo Renewing Let's Encrypt certificate...
echo.
echo for /f "delims=" %%%%A in ('cd') do set "CURRENT_DIR=%%%%A"
echo.
echo docker run --rm ^
echo   -v "!CURRENT_DIR!\letsencrypt:/etc/letsencrypt" ^
echo   -v "!CURRENT_DIR!\certbot-webroot:/var/www/certbot" ^
echo   -p 80:80 ^
echo   -p 443:443 ^
echo   certbot/certbot renew ^
echo   --quiet
echo.
echo REM Reload nginx if it's running
echo docker ps --format "table {{.Names}}" | find "apex-moto-nginx" >nul 2>&1
echo if not errorlevel 1 (
echo     echo Reloading nginx...
echo     docker exec apex-moto-nginx nginx -s reload
echo )
echo.
echo echo Certificate renewal complete
) > renewal.bat

echo ✓ Auto-renewal script created (renewal.bat)
echo.

REM Step 6: Create scheduled task
echo Step 6: Setting up scheduled task for renewal...

REM Get full path to renewal script
for /f "delims=" %%A in ('cd') do set "RENEWAL_PATH=%%A\renewal.bat"

REM Create scheduled task
schtasks /create /tn "Apex-Dashboard-SSL-Renewal" ^
  /tr "cmd.exe /c %RENEWAL_PATH%" ^
  /sc weekly /d MON /st 02:00 ^
  /f >nul 2>&1

if errorlevel 1 (
    schtasks /delete /tn "Apex-Dashboard-SSL-Renewal" /f >nul 2>&1
    schtasks /create /tn "Apex-Dashboard-SSL-Renewal" ^
      /tr "cmd.exe /c %RENEWAL_PATH%" ^
      /sc weekly /d MON /st 02:00 ^
      /f >nul 2>&1
)

echo ✓ Scheduled task created (runs Mondays at 2am)
echo.

REM Final summary
cls
echo.
echo ============================================================================
echo ✓ SSL CERTIFICATE SETUP COMPLETE!
echo ============================================================================
echo.
echo Next steps:
echo.
echo 1. Update nginx configuration:
echo    copy Apex-Monitoring-Dashboard\nginx-dashboard.conf nginx.conf
echo.
echo 2. Update Apex-Moto-Co\docker-compose.yml volumes:
echo    volumes:
echo      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
echo      - ./letsencrypt:/etc/letsencrypt:ro
echo      - ./certbot-webroot:/var/www/certbot:rw
echo.
echo 3. Start nginx:
echo    cd Apex-Moto-Co
echo    docker compose up -d apex-moto-nginx
echo.
echo 4. Test HTTPS:
echo    curl -I https://%DOMAIN%
echo    Should return HTTP 200
echo.
echo Certificate Details:
echo   Location: %CERT_DIR%\live\%DOMAIN%\
echo   Auto-renewal: Enabled (Mondays at 2am)
echo   Renewal script: renewal.bat
echo   Scheduled task: Apex-Dashboard-SSL-Renewal
echo.
echo Certificate will automatically renew 30 days before expiry.
echo.
pause
