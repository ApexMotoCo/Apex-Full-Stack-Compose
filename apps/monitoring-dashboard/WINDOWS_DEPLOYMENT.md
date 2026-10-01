# 🪟 WINDOWS DEPLOYMENT GUIDE - STEP BY STEP

## Getting to Your Apex Directory on Windows

### Option 1: Using PowerShell (Recommended)

**1. Open PowerShell as Administrator:**
- Press `Win + X` → Select "Windows PowerShell (Admin)"

**2. Navigate to your Apex directory:**
```powershell
cd C:\Users\Adam\Documents\GitHub\Apex-Full-Stack-Compose
```

**3. Verify you're in the right place:**
```powershell
ls
# Should see: Apex-Monitoring-Dashboard, Apex-Moto-Co, etc.
```

**4. Run the SSL setup:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\Apex-Monitoring-Dashboard\setup-ssl.ps1
```

---

### Option 2: Using Command Prompt (cmd.exe)

**1. Open Command Prompt as Administrator:**
- Press `Win + R` → Type `cmd` → Press Enter

**2. Navigate to your Apex directory:**
```cmd
cd C:\Users\Adam\Documents\GitHub\Apex-Full-Stack-Compose
```

**3. Verify you're in the right place:**
```cmd
dir
```

**4. Run the SSL setup (PowerShell):**
```cmd
powershell -ExecutionPolicy Bypass -File .\Apex-Monitoring-Dashboard\setup-ssl.ps1
```

---

### Option 3: Using File Explorer + PowerShell (Easiest)

**1. Open File Explorer:**
- Press `Win + E`

**2. Navigate to:**
```
C:\Users\Adam\Documents\GitHub\Apex-Full-Stack-Compose
```

**3. In the folder, type in address bar:**
```
powershell
```
Then press Enter - PowerShell opens IN that directory

**4. Run the SSL setup:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
.\Apex-Monitoring-Dashboard\setup-ssl.ps1
```

---

## Understanding the Path Structure

### Your Current Setup:
```
C:\Users\Adam\Documents\GitHub\
├── Apex-Full-Stack-Compose/          ← You need to be HERE
│   ├── Apex-Monitoring-Dashboard/    ← setup-ssl.ps1 is here
│   ├── Apex-Moto-Co/
│   ├── Apex-Asset-Management-GIT/
│   └── ...
```

### From PowerShell:
```powershell
# Navigate to root directory
cd C:\Users\Adam\Documents\GitHub\Apex-Full-Stack-Compose

# Now you can run setup script
.\Apex-Monitoring-Dashboard\setup-ssl.ps1
```

### The "./" means:
- `.` = Current directory
- `/` = Path separator
- `./script.ps1` = Run script in current directory

---

## Complete Windows Deployment Steps

### Step 1: Open PowerShell Admin
```powershell
# Press: Win + X → Windows PowerShell (Admin)
```

### Step 2: Navigate to Apex directory
```powershell
cd C:\Users\Adam\Documents\GitHub\Apex-Full-Stack-Compose
```

### Step 3: Verify location
```powershell
pwd  # Shows current directory
ls   # Lists files - should show Apex-Monitoring-Dashboard folder
```

### Step 4: Set execution policy (one-time)
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
```

### Step 5: Run SSL setup script
```powershell
.\Apex-Monitoring-Dashboard\setup-ssl.ps1
```

### Step 6: Follow the script prompts
- It will verify DNS
- Get the certificate
- Create renewal script
- Set up scheduled task

### Step 7: Update nginx
```powershell
# Copy nginx config
Copy-Item Apex-Monitoring-Dashboard\nginx-dashboard.conf -Destination nginx.conf

# Update Apex-Moto-Co compose
cd Apex-Moto-Co
docker compose up -d apex-moto-nginx
```

### Step 8: Test SSL
```powershell
curl -I https://dashboard.apexingoodcompany.co.uk
```

---

## Troubleshooting Windows PowerShell

### "Cannot be loaded because running scripts is disabled"
**Fix:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
# Then run your script again
```

### "command not recognized"
**Check:**
1. You're in the right directory: `pwd`
2. File exists: `ls Apex-Monitoring-Dashboard\`
3. Use full path: `.\Apex-Monitoring-Dashboard\setup-ssl.ps1`

### "Cannot find path"
**Solution:**
```powershell
# Verify current directory
Get-Location

# If wrong, navigate:
cd C:\Users\Adam\Documents\GitHub\Apex-Full-Stack-Compose

# Then try again
.\Apex-Monitoring-Dashboard\setup-ssl.ps1
```

### "Script file not found"
**Check:**
```powershell
# List what's in Apex-Monitoring-Dashboard
ls Apex-Monitoring-Dashboard\

# Should show: setup-ssl.ps1, server.js, Dockerfile, etc.
```

---

## SSH to OVH Cloud (Also on Windows)

### Using PowerShell:
```powershell
# SSH to your OVH server
ssh root@YOUR.PUBLIC.IP

# Navigate to apex directory
cd /path/to/apex

# Run Linux version of script
chmod +x Apex-Monitoring-Dashboard/setup-ssl.sh
./Apex-Monitoring-Dashboard/setup-ssl.sh
```

### Using PuTTY (GUI):
1. Download PuTTY: https://www.putty.org/
2. Enter Host: `YOUR.PUBLIC.IP`
3. Port: `22`
4. Click Open
5. Login as: `root`
6. Then run the same commands

---

## Quick Reference

| Task | Command |
|------|---------|
| Navigate to Apex | `cd C:\Users\Adam\Documents\GitHub\Apex-Full-Stack-Compose` |
| Show current dir | `pwd` or `Get-Location` |
| List files | `ls` or `Get-ChildItem` |
| Run script | `.\script-name.ps1` |
| Allow scripts | `Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process` |
| SSH to server | `ssh root@YOUR.PUBLIC.IP` |
| Copy file | `Copy-Item source destination` |

---

## Complete Example: From Start to Finish

```powershell
# 1. Open PowerShell as Admin (Win + X → PowerShell Admin)

# 2. Go to Apex directory
cd C:\Users\Adam\Documents\GitHub\Apex-Full-Stack-Compose

# 3. Check you're in right place
ls
# Should show: Apex-Monitoring-Dashboard, Apex-Moto-Co, etc.

# 4. Allow script execution (one-time)
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

# 5. Run SSL setup
.\Apex-Monitoring-Dashboard\setup-ssl.ps1
# Follow prompts...

# 6. Update nginx config
Copy-Item Apex-Monitoring-Dashboard\nginx-dashboard.conf -Destination nginx.conf

# 7. Start nginx
cd Apex-Moto-Co
docker compose up -d apex-moto-nginx

# 8. Test
curl -I https://dashboard.apexingoodcompany.co.uk
```

---

## One More Thing: On Your OVH Server

Even though you're on Windows, SSH into your OVH server and run:

```bash
# SSH first
ssh root@YOUR.PUBLIC.IP

# Then in the server (Linux commands)
cd /path/to/apex
chmod +x Apex-Monitoring-Dashboard/setup-ssl.sh
./Apex-Monitoring-Dashboard/setup-ssl.sh
```

---

**Windows PowerShell Reference**: 🪟  
**Status**: READY  
**Next**: Set DNS, then run SSL setup script
