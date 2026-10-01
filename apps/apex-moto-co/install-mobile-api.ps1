$ErrorActionPreference = 'Stop'

$server = Join-Path (Get-Location) 'server.js'
$apiDir = Join-Path (Get-Location) 'website-api'
$apiFile = Join-Path $apiDir 'detailing-mobile-api.js'

if (-not (Test-Path $server)) {
    throw "server.js was not found in $((Get-Location).Path). Run this script from the APEX Moto & Co website root."
}

New-Item -ItemType Directory -Force -Path $apiDir | Out-Null
Copy-Item (Join-Path $PSScriptRoot 'website-api\detailing-mobile-api.js') $apiFile -Force

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = "$server.mobile-api-backup-$stamp"
Copy-Item $server $backup -Force

$content = Get-Content $server -Raw

if ($content -match "registerDetailingMobileApi") {
    Write-Host "Mobile API registration already appears to exist. API file has been copied; no server.js change made."
    exit 0
}

$requireLine = "const { registerDetailingMobileApi } = require('./website-api/detailing-mobile-api');"

# Insert require after dotenv.config() if possible, otherwise before app creation.
if ($content -match "dotenv\.config\(\);\s*") {
    $content = [regex]::Replace($content, "dotenv\.config\(\);", "dotenv.config();`r`n`r`n$requireLine", 1)
} else {
    $content = "$requireLine`r`n`r`n" + $content
}

$registration = @'

// APEX Detailing native Android API
registerDetailingMobileApi(app, db, {
  allowedRoles: (process.env.DETAILING_APP_ROLES || 'admin').split(',').map(r => r.trim()).filter(Boolean),
  tokenDays: 30,
  secret: process.env.DETAILING_APP_SECRET
});
'@

# Register immediately before app.listen so all helper functions and routes are already defined.
$idx = $content.IndexOf("app.listen(")
if ($idx -lt 0) {
    throw "Could not find app.listen(...) in server.js. No changes beyond the backup/API file were kept. Restore from $backup if needed."
}
$content = $content.Insert($idx, $registration + "`r`n")

Set-Content -Path $server -Value $content -Encoding UTF8

Write-Host ""
Write-Host "APEX Detailing Mobile API installed."
Write-Host "Backup: $backup"
Write-Host "API file: $apiFile"
Write-Host ""
Write-Host "NEXT: set DETAILING_APP_SECRET in the website environment, then restart the website service."
