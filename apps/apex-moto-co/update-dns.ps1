# ============================================================
# APEX Moto & Co - OVHcloud Dynamic DNS Updater
# ============================================================
#
# Updates:
#   apexingoodcompany.co.uk
#   vpn.apexingoodcompany.co.uk
#   dashboard.apexingoodcompany.co.uk
#
# The OVH credentials are stored locally in an encrypted file
# protected by Windows DPAPI and your Windows user account.
#
# ============================================================

$ErrorActionPreference = "Stop"

# ------------------------------------------------------------
# Configuration
# ------------------------------------------------------------

$Domain = "apexingoodcompany.co.uk"

$ScriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path

$CredentialFile = Join-Path $ScriptDirectory "ovh-dns-credentials.xml"
$LastIPFile     = Join-Path $ScriptDirectory "last-public-ip.txt"
$LogFile        = Join-Path $ScriptDirectory "dns-update.log"

# OVH Europe API
$OvhEndpoint = "https://eu.api.ovh.com/1.0"

# Records we want to maintain
$DnsRecords = @(
    @{
        SubDomain = ""
        Name      = "apexingoodcompany.co.uk"
    },
    @{
        SubDomain = "vpn"
        Name      = "vpn.apexingoodcompany.co.uk"
    },
    @{
        SubDomain = "dashboard"
        Name      = "dashboard.apexingoodcompany.co.uk"
    }
)

# ------------------------------------------------------------
# Logging
# ------------------------------------------------------------

function Write-Log {
    param(
        [string]$Message
    )

    $Timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $Line = "$Timestamp - $Message"

    Write-Host $Line

    try {
        Add-Content -Path $LogFile -Value $Line -Encoding UTF8
    }
    catch {
        Write-Warning "Could not write to log file: $($_.Exception.Message)"
    }
}

# ------------------------------------------------------------
# Get public IP
# ------------------------------------------------------------

function Get-PublicIP {

    try {

        $Response = Invoke-RestMethod `
            -Uri "https://api.ipify.org?format=json" `
            -Method Get `
            -TimeoutSec 15

        if (-not $Response.ip) {
            throw "Public IP service returned no IP address."
        }

        $IP = $Response.ip.ToString().Trim()

        if ($IP -notmatch '^(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])(\.(25[0-5]|2[0-4][0-9]|1?[0-9]?[0-9])){3}$') {
            throw "Returned value does not appear to be a valid IPv4 address: $IP"
        }

        return $IP
    }
    catch {

        Write-Log "ERROR getting public IP: $($_.Exception.Message)"

        return $null
    }
}

# ------------------------------------------------------------
# Load / create OVH credentials
# ------------------------------------------------------------

function Get-OvhCredentials {

    if (Test-Path $CredentialFile) {

        try {

            Write-Log "Loading encrypted OVH credentials."

            $Credentials = Import-Clixml -Path $CredentialFile

            if (
                [string]::IsNullOrWhiteSpace($Credentials.ApplicationKey) -or
                [string]::IsNullOrWhiteSpace($Credentials.ApplicationSecret) -or
                [string]::IsNullOrWhiteSpace($Credentials.ConsumerKey)
            ) {
                throw "Credential file is missing one or more required values."
            }

            return $Credentials
        }
        catch {

            Write-Log "ERROR loading credential file: $($_.Exception.Message)"

            throw
        }
    }

    # --------------------------------------------------------
    # First-run setup
    # --------------------------------------------------------

    Write-Host ""
    Write-Host "============================================================"
    Write-Host " OVHcloud DNS updater - first-time setup"
    Write-Host "============================================================"
    Write-Host ""
    Write-Host "The credentials will be encrypted using Windows DPAPI."
    Write-Host "They are NOT stored in this PowerShell script."
    Write-Host ""

    $ApplicationKey = Read-Host "Enter OVH Application Key"
    $ApplicationSecret = Read-Host "Enter OVH Application Secret" -AsSecureString
    $ConsumerKey = Read-Host "Enter OVH Consumer Key" -AsSecureString

    if ([string]::IsNullOrWhiteSpace($ApplicationKey)) {
        throw "Application Key cannot be empty."
    }

    $Credentials = [PSCustomObject]@{
        ApplicationKey    = $ApplicationKey
        ApplicationSecret = $ApplicationSecret
        ConsumerKey       = $ConsumerKey
    }

    try {

        $Credentials | Export-Clixml -Path $CredentialFile

        Write-Log "Encrypted OVH credentials saved."

        # Restrict access to the current Windows user
        try {
            icacls $CredentialFile /inheritance:r | Out-Null
            icacls $CredentialFile /grant:r "$env:USERNAME:(R,W)" | Out-Null
        }
        catch {
            Write-Log "WARNING: Could not modify credential file permissions."
        }

        return $Credentials
    }
    catch {

        Write-Log "ERROR saving encrypted credentials: $($_.Exception.Message)"

        throw
    }
}

# ------------------------------------------------------------
# Generate OVH API signature
# ------------------------------------------------------------

function Get-OvhSignature {

    param(
        [string]$ApplicationSecret,
        [string]$ConsumerKey,
        [string]$Method,
        [string]$Query,
        [string]$Body,
        [long]$Timestamp
    )

    $ToSign = "$ApplicationSecret+$ConsumerKey+$Method+$Query+$Body+$Timestamp"

    $SHA1 = [System.Security.Cryptography.SHA1]::Create()

    try {

        $Bytes = [System.Text.Encoding]::UTF8.GetBytes($ToSign)

        $Hash = $SHA1.ComputeHash($Bytes)

        $Hex = -join ($Hash | ForEach-Object {
            $_.ToString("x2")
        })

        return "`$1`$$Hex"
    }
    finally {

        $SHA1.Dispose()
    }
}

# ------------------------------------------------------------
# OVH API request
# ------------------------------------------------------------

function Invoke-OvhApi {

    param(
        [string]$Method,
        [string]$Path,
        [string]$Body = ""
    )

    $Credentials = Get-OvhCredentials

    $TimestampResponse = Invoke-RestMethod `
        -Uri "$OvhEndpoint/auth/time" `
        -Method Get `
        -TimeoutSec 15

    $Timestamp = [long]$TimestampResponse

    $Query = "$OvhEndpoint$Path"

    $Signature = Get-OvhSignature `
        -ApplicationSecret (
            [System.Net.NetworkCredential]::new(
                "",
                $Credentials.ApplicationSecret
            ).Password
        ) `
        -ConsumerKey (
            [System.Net.NetworkCredential]::new(
                "",
                $Credentials.ConsumerKey
            ).Password
        ) `
        -Method $Method `
        -Query $Query `
        -Body $Body `
        -Timestamp $Timestamp

    $Headers = @{
        "X-Ovh-Application" = $Credentials.ApplicationKey
        "X-Ovh-Consumer"    = (
            [System.Net.NetworkCredential]::new(
                "",
                $Credentials.ConsumerKey
            ).Password
        )
        "X-Ovh-Timestamp"   = $Timestamp
        "X-Ovh-Signature"   = $Signature
    }

    $Uri = "$OvhEndpoint$Path"

    Write-Log "$Method $Path"

    if ($Method -eq "GET") {

        return Invoke-RestMethod `
            -Uri $Uri `
            -Method Get `
            -Headers $Headers `
            -TimeoutSec 30
    }

    return Invoke-RestMethod `
        -Uri $Uri `
        -Method $Method `
        -Headers $Headers `
        -ContentType "application/json" `
        -Body $Body `
        -TimeoutSec 30
}

# ------------------------------------------------------------
# Find DNS record
# ------------------------------------------------------------

function Get-ARecord {

    param(
        [string]$SubDomain
    )

    $EncodedSubDomain = [System.Uri]::EscapeDataString($SubDomain)

    $Path = "/domain/zone/$Domain/record?fieldType=A&subDomain=$EncodedSubDomain"

    $Records = Invoke-OvhApi `
        -Method "GET" `
        -Path $Path

    if (-not $Records) {
        return $null
    }

    return @($Records)
}

# ------------------------------------------------------------
# Get record details
# ------------------------------------------------------------

function Get-ARecordDetails {

    param(
        [long]$RecordId
    )

    $Path = "/domain/zone/$Domain/record/$RecordId"

    return Invoke-OvhApi `
        -Method "GET" `
        -Path $Path
}

# ------------------------------------------------------------
# Update or create DNS record
# ------------------------------------------------------------

function Update-DnsRecord {

    param(
        [string]$SubDomain,
        [string]$RecordName,
        [string]$TargetIP
    )

    Write-Log "Checking $RecordName"

    $RecordIds = Get-ARecord -SubDomain $SubDomain

    # --------------------------------------------------------
    # Existing record
    # --------------------------------------------------------

    if ($RecordIds.Count -gt 0) {

        foreach ($RecordId in $RecordIds) {

            $Record = Get-ARecordDetails -RecordId $RecordId

            if ($Record.fieldType -ne "A") {
                continue
            }

            Write-Log "$RecordName currently points to $($Record.target)"

            if ($Record.target -eq $TargetIP) {

                Write-Log "$RecordName already points to $TargetIP"

                return
            }

            $Body = @{
                target = $TargetIP
            } | ConvertTo-Json -Compress

            $Path = "/domain/zone/$Domain/record/$RecordId"

            Invoke-OvhApi `
                -Method "PUT" `
                -Path $Path `
                -Body $Body | Out-Null

            Write-Log "UPDATED $RecordName -> $TargetIP"

            return
        }
    }

    # --------------------------------------------------------
    # No record found - create it
    # --------------------------------------------------------

    Write-Log "$RecordName does not have an A record. Creating one."

    $Body = @{
        fieldType = "A"
        subDomain = $SubDomain
        target    = $TargetIP
        ttl       = 300
    } | ConvertTo-Json -Compress

    $Path = "/domain/zone/$Domain/record"

    Invoke-OvhApi `
        -Method "POST" `
        -Path $Path `
        -Body $Body | Out-Null

    Write-Log "CREATED $RecordName -> $TargetIP"
}

# ------------------------------------------------------------
# Refresh OVH DNS zone
# ------------------------------------------------------------

function Refresh-DnsZone {

    Write-Log "Refreshing OVH DNS zone."

    $Path = "/domain/zone/$Domain/refresh"

    Invoke-OvhApi `
        -Method "POST" `
        -Path $Path | Out-Null

    Write-Log "DNS zone refresh requested."
}

# ------------------------------------------------------------
# Main
# ------------------------------------------------------------

try {

    Write-Log "============================================================"
    Write-Log "APEX DNS updater started."
    Write-Log "============================================================"

    $CurrentIP = Get-PublicIP

    if (-not $CurrentIP) {

        Write-Log "Could not determine public IP. Exiting."

        exit 1
    }

    Write-Log "Current public IP: $CurrentIP"

    $LastIP = ""

    if (Test-Path $LastIPFile) {

        $LastIP = (Get-Content $LastIPFile -Raw).Trim()
    }

    # --------------------------------------------------------
    # If the public IP has not changed, still make sure the VPN
    # record exists and is correct.
    # --------------------------------------------------------

    $IpChanged = $CurrentIP -ne $LastIP

    if ($IpChanged) {

        Write-Log "Public IP has changed: $LastIP -> $CurrentIP"
    }
    else {

        Write-Log "Public IP unchanged: $CurrentIP"
    }

    # --------------------------------------------------------
    # Update both records
    # --------------------------------------------------------

    foreach ($Record in $DnsRecords) {

        Update-DnsRecord `
            -SubDomain $Record.SubDomain `
            -RecordName $Record.Name `
            -TargetIP $CurrentIP
    }

    # --------------------------------------------------------
    # Refresh zone
    # --------------------------------------------------------

    Refresh-DnsZone

    # --------------------------------------------------------
    # Store last known IP
    # --------------------------------------------------------

    Set-Content `
        -Path $LastIPFile `
        -Value $CurrentIP `
        -Encoding ASCII

    Write-Log "Last known IP saved."

    Write-Log "DNS update completed successfully."
    Write-Log "============================================================"

    exit 0
}
catch {

    Write-Log "============================================================"
    Write-Log "DNS UPDATE FAILED"
    Write-Log $_.Exception.Message
    Write-Log "============================================================"

    exit 1
}