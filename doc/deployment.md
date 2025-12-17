# Deployment Guide

## Table of Contents

- [Overview](#overview)
- [Server Prerequisites](#server-prerequisites)
  - [Required on Server](#required-on-server)
  - [NOT Required on Server](#not-required-on-server)
  - [Server Directory Structure](#server-directory-structure)
- [Deployment Methods](#deployment-methods)
  - [How the Application Works](#how-the-application-works)
  - [Subdirectory Deployment](#subdirectory-deployment)
  - [Method 1: Push Built Code](#method-1-push-built-code-recommended)
  - [Method 2: Pull and Build on Server](#method-2-pull-and-build-on-server-alternative)
  - [Quick Deployment Script](#quick-deployment-script)
- [Setup Reverse Proxy (Required)](#setup-reverse-proxy-required)
  - [Option 1: Plesk Control Panel](#option-1-plesk-control-panel)
  - [Option 2: cPanel with WHM](#option-2-cpanel-with-whm-access)
  - [Option 3: Apache (Direct VPS)](#option-3-apache-direct-vpsdedicated-server)
  - [Option 4: Nginx (Direct VPS)](#option-4-nginx-direct-vpsdedicated-server)
  - [Testing Your Reverse Proxy](#testing-your-reverse-proxy)
  - [Common Reverse Proxy Issues](#common-reverse-proxy-issues)
- [Updates](#updates)
  - [Understanding What Changes Require](#understanding-what-changes-require)
  - [Quick Update Workflow](#quick-update-workflow)
  - [Detailed Update Methods](#detailed-update-methods)
  - [Update Checklist](#update-checklist)
  - [Rollback Procedure](#rollback-procedure)
  - [Automated Deployment Script](#automated-deployment-script)
- [Auto-Restart Configuration](#auto-restart-configuration)
  - [Auto-Restart on Crash](#auto-restart-on-application-crash)
  - [Auto-Start on Reboot](#auto-start-on-server-reboot)
  - [Updating Startup Configuration](#updating-the-startup-configuration)
  - [Multiple Applications](#multiple-applications)
  - [Troubleshooting Auto-Restart](#troubleshooting-auto-restart)
- [Backup](#backup)
- [Troubleshooting](#troubleshooting)
  - [Server Not Starting](#server-not-starting)
  - [Application Returns 403/404](#application-returns-403404)
  - [API Calls Fail](#api-calls-fail-request-failed-404)
  - [Database Issues](#database-issues)
  - [PM2 Issues](#pm2-issues)
  - [Performance Issues](#performance-issues)
  - [Getting Help](#getting-help)
- [File Structure](#file-structure-after-build)
- [Minimal Deployment](#minimal-deployment)

---

## Overview

This application is designed for simple deployment on any Linux VPS with Node.js installed. No additional services (databases, Redis, etc.) are required.

You can deploy by either:
1. **Pushing built code** (recommended, simpler) - Just copy the built artifacts
2. **Pulling repository** (alternative) - Clone and build on server

[↑ Back to Table of Contents](#table-of-contents)

## Server Prerequisites

### Required on Server

1. **Node.js 20.19.0+** (required for Vite 7)
   ```bash
   # Check if installed
   node --version
   
   # Install on Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Verify
   node --version  # Must be v20.19.0 or later
   npm --version
   ```

2. **PM2 (Process Manager)** - Recommended for keeping the app running
   ```bash
   sudo npm install -g pm2
   ```

3. **Nginx or Apache** - Required for reverse proxy
   ```bash
   # Nginx
   sudo apt-get install nginx
   
   # Or Apache with proxy modules
   sudo apt-get install apache2
   sudo a2enmod proxy proxy_http
   ```

### NOT Required on Server

- Database server (MySQL, PostgreSQL, etc.)
- Redis
- Git (if using push deployment)
- TypeScript compiler (code is pre-built)
- Build tools (esbuild, etc.)

### Server Directory Structure

Create the application directory:
```bash
sudo mkdir -p /var/www/neotypa-booktabs
sudo chown $USER:$USER /var/www/neotypa-booktabs
cd /var/www/neotypa-booktabs
```

[↑ Back to Table of Contents](#table-of-contents)

## Deployment Methods

### How the Application Works

**Important:** The Node.js server serves both:
- **Static files** (HTML, CSS, JS) from `dist/client/`
- **API endpoints** at `/api/*`

You don't upload files to your web root. Instead, you:
1. Deploy the entire app to any directory (e.g., `/var/www/apps/ntbt/`)
2. Start the Node.js server
3. Configure a reverse proxy (Nginx/Apache) to forward requests to the Node.js server

### Subdirectory Deployment

The application can be deployed at the domain root (`/`) or in any subdirectory (e.g., `/apps/ntbt/`).

**To deploy in a subdirectory:**
1. Edit `dist/client/index.html` after building
2. Change the `base-path` meta tag:
   ```html
   <meta name="base-path" content="/apps/myapp" />
   ```
3. Configure your reverse proxy to forward that path to the Node.js server

**Example configurations:**
- Root deployment: `<meta name="base-path" content="/" />` (default)
- Subdirectory: `<meta name="base-path" content="/apps/ntbt" />`
- Deep path: `<meta name="base-path" content="/projects/bookmarks/prod" />`

The assets use relative paths (`./assets/`) and API calls automatically use the configured base path.

[↑ Back to Table of Contents](#table-of-contents)

### Method 1: Push Built Code (Recommended)

This method builds locally and pushes only what's needed to run.

#### Step 1: Build Locally (on your dev machine)

```bash
# On your development machine
cd d:\projects\neotypa-booktabs

# Install dependencies and build
npm install
npm run build
```

This creates:
- `dist/server/` - Compiled server JavaScript
- `dist/client/` - Built client application

#### Step 2: Create Deployment Package

```bash
# On your development machine
# Create a deployment archive with only what's needed
tar -czf deploy.tar.gz \
  dist/ \
  node_modules/ \
  package.json \
  package-lock.json

# Or use PowerShell on Windows:
# Compress-Archive -Path dist,package.json,package-lock.json -DestinationPath deploy.zip
```

#### Step 3: Copy to Server

```bash
# Using SCP (from your dev machine)
scp deploy.tar.gz user@your-server.com:/var/www/neotypa-booktabs/

# Or using SFTP/FTP client like FileZilla, WinSCP, etc.
```

#### Step 4: Extract and Install on Server

```bash
# On your server
cd /var/www/neotypa-booktabs
tar -xzf deploy.tar.gz

# Install production dependencies only
npm install --production

# Create data directory
mkdir -p data

# Set permissions
chmod 755 dist/server
```

#### Step 5: Configure Environment

```bash
# On your server
nano .env
```

Add:
```env
PORT=8787
DB_PATH=/var/www/neotypa-booktabs/data/app.sqlite
PUBLIC_DIR=/var/www/neotypa-booktabs/dist/client
NODE_ENV=production
```

#### Step 6: Start with PM2

```bash
# Start the application
pm2 start dist/server/index.js --name neotypa-booktabs

# Save PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
# Follow the command it gives you (run with sudo)

# Check status
pm2 status
pm2 logs neotypa-booktabs
```

### Method 2: Pull and Build on Server (Alternative)

Only use this if you want to build on the server (requires more resources).

```bash
# On your server
cd /var/www/neotypa-booktabs

# Clone the repository
git clone <your-repo-url> .

# Install all dependencies (including dev deps for building)
npm install

# Build the application
npm run build

# Then follow steps 5-6 from Method 1
```

## Quick Deployment Script

Save this as `deploy.sh` on your dev machine:

```bash
#!/bin/bash
# Build and deploy to server

SERVER="user@your-server.com"
DEPLOY_PATH="/var/www/neotypa-booktabs"

echo "🏗️  Building application..."
npm run build

echo "📦 Creating deployment package..."
tar -czf deploy.tar.gz dist/ package.json package-lock.json

echo "📤 Uploading to server..."
scp deploy.tar.gz $SERVER:$DEPLOY_PATH/

echo "Deploying on server..."
ssh $SERVER << 'EOF'
cd /var/www/neotypa-booktabs
tar -xzf deploy.tar.gz
npm install --production
pm2 restart neotypa-booktabs || pm2 start dist/server/index.js --name neotypa-booktabs
pm2 save
EOF

echo "Deployment complete!"
echo "Check status: ssh $SERVER 'pm2 status'"
```

Make it executable:
```bash
chmod +x deploy.sh
```

Then deploy with:
```bash
./deploy.sh
```

[↑ Back to Table of Contents](#table-of-contents)

## Setup Reverse Proxy (Required)

**Important:** The Node.js server runs on port 8787 internally. You MUST configure a reverse proxy so users can access it via your normal domain (port 80/443).

**The reverse proxy:**
- Accepts requests on port 80/443 (your normal web traffic)
- Forwards them to Node.js on port 8787 (internal only)
- Returns responses to users
- Port 8787 never needs to be exposed to the internet

### Choose Your Method:

#### Option 1: Plesk Control Panel

**Most common for shared/managed hosting**

1. Go to **Websites & Domains** in your Plesk panel
2. Click on your domain (e.g., **yourdomain.com**)
3. Click **Apache & nginx Settings** (for that specific domain)
4. Scroll to the bottom of the page
5. Find "Additional directives for HTTP" and "Additional directives for HTTPS"
6. Add to **BOTH** sections:
   ```apache
   ProxyPass /apps/ntbt http://localhost:8787
   ProxyPassReverse /apps/ntbt http://localhost:8787
   ProxyPreserveHost On
   ```
   
   **Note:** Adjust `/apps/ntbt` to match your deployment path:
   - For root deployment: `/` instead of `/apps/ntbt`
   - For different path: `/your/custom/path`

7. Click **OK** or **Apply**
8. Test by visiting your domain

**Troubleshooting Plesk:**
- Can't find "Additional directives"? Make sure you're on the **domain-specific** page, not the server-wide "Tools & Settings" page
- 403/404 errors? Check PM2 status: `pm2 status` and `pm2 logs appname`

#### Option 2: cPanel with WHM Access

1. Log into WHM (Web Host Manager)
2. Go to **Service Configuration → Apache Configuration → Include Editor**
3. Select **Pre Main Include**
4. Add:
   ```apache
   <VirtualHost *:80>
       ServerName yourdomain.com
       ProxyPass /apps/ntbt http://localhost:8787
       ProxyPassReverse /apps/ntbt http://localhost:8787
       ProxyPreserveHost On
   </VirtualHost>
   
   <VirtualHost *:443>
       ServerName yourdomain.com
       SSLEngine on
       # Your existing SSL config...
       ProxyPass /apps/ntbt http://localhost:8787
       ProxyPassReverse /apps/ntbt http://localhost:8787
       ProxyPreserveHost On
   </VirtualHost>
   ```
5. Click **Update**
6. Restart Apache: **Restart Services → HTTP Server (Apache)**

#### Option 3: Apache (Direct VPS/Dedicated Server)

**Step 1: Enable proxy modules**
```bash
sudo a2enmod proxy proxy_http
sudo systemctl restart apache2
```

**Step 2: Edit your virtual host file**

Usually in `/etc/apache2/sites-available/yourdomain.com.conf`:

```bash
sudo nano /etc/apache2/sites-available/yourdomain.com.conf
```

**Step 3: Add proxy directives inside `<VirtualHost>` blocks**

**For HTTP (port 80):**
```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    
    # Existing configuration...
    DocumentRoot /var/www/html
    
    # Add reverse proxy for the app
    ProxyPass /apps/ntbt http://localhost:8787
    ProxyPassReverse /apps/ntbt http://localhost:8787
    ProxyPreserveHost On
    
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

**For HTTPS (port 443):**
```apache
<VirtualHost *:443>
    ServerName yourdomain.com
    ServerAlias www.yourdomain.com
    
    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem
    
    # Add reverse proxy for the app
    ProxyPass /apps/ntbt http://localhost:8787
    ProxyPassReverse /apps/ntbt http://localhost:8787
    ProxyPreserveHost On
    
    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined
</VirtualHost>
```

**Step 4: Test and restart**
```bash
# Test configuration
sudo apache2ctl configtest

# If OK, restart
sudo systemctl restart apache2
```

**For root deployment (/):** Change `/apps/ntbt` to `/`:
```apache
ProxyPass / http://localhost:8787/
ProxyPassReverse / http://localhost:8787/
```

#### Option 4: Nginx (Direct VPS/Dedicated Server)

**Step 1: Edit nginx site configuration**

Usually in `/etc/nginx/sites-available/yourdomain.com`:

```bash
sudo nano /etc/nginx/sites-available/yourdomain.com
```

**Step 2: Add proxy configuration**

**For subdirectory deployment:**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name yourdomain.com www.yourdomain.com;
    
    # Existing configuration...
    root /var/www/html;
    index index.html;
    
    # Reverse proxy for the app
    location /apps/ntbt {
        proxy_pass http://localhost:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}

# HTTPS version
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    
    # Reverse proxy for the app
    location /apps/ntbt {
        proxy_pass http://localhost:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }
}
```

**For root deployment:** Use `/` instead:
```nginx
location / {
    proxy_pass http://localhost:8787;
    # ... same headers as above
}
```

**Step 3: Test and reload**
```bash
# Test configuration
sudo nginx -t

# If OK, reload
sudo systemctl reload nginx
```

**Step 4: Setup HTTPS with Let's Encrypt (if not already configured)**
```bash
sudo apt-get install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Testing Your Reverse Proxy

**1. Verify Node.js is running:**
```bash
pm2 status
pm2 logs appname
```

**2. Test Node.js directly (from server):**
```bash
curl http://localhost:8787
# Should return HTML
```

**3. Test through reverse proxy:**
```bash
curl http://yourdomain.com/apps/ntbt
# Should return the same HTML
```

**4. Test in browser:**
- Visit `https://yourdomain.com/apps/ntbt`
- Should load the login page
- Check browser console for errors (F12)

### Common Reverse Proxy Issues

**403 Forbidden:**
- Reverse proxy not configured
- Proxy modules not enabled (Apache)
- Wrong file path in config

**404 Not Found:**
- Node.js server not running (`pm2 status`)
- Wrong proxy path (check `/apps/ntbt` matches your URL)
- Base path mismatch in `dist/client/index.html`

**502 Bad Gateway:**
- Node.js crashed or not running
- Wrong port in proxy config (should be 8787)
- Firewall blocking localhost connections (unlikely)

**Static files load but API fails:**
- Reverse proxy only partially configured
- Check that ALL requests under the path are proxied, not just the root

[↑ Back to Table of Contents](#table-of-contents)

## Updates

### Understanding What Changes Require

Different types of changes require different update procedures:

| Change Type | What to Update | Restart Required? |
|-------------|---------------|------------------|
| Client only (HTML/CSS/JS) | Upload `dist/client/` | Yes - PM2 serves static files |
| Server only (API/backend) | Upload `dist/server/` | Yes - code cached in memory |
| Dependencies | Run `npm install --production` | Yes |
| Configuration (.env) | Edit `.env` file | Yes |
| Database schema | May need migration script | Yes |

**Always restart after updates:** Changes won't take effect until the server restarts.

### Quick Update Workflow

**For most updates (recommended):**

```bash
# On your development machine
npm run build
scp -r dist/ user@server:/var/www/neotypa-booktabs/

# On server
ssh user@server
cd /var/www/neotypa-booktabs
pm2 restart neotypa-booktabs
pm2 logs neotypa-booktabs --lines 20
```

### Detailed Update Methods

#### Method 1: Push Deployment (Recommended)

**Best for:** Most deployments, especially production

**On your dev machine:**
```bash
# 1. Build latest version
npm run build

# 2. Create deployment package
tar -czf deploy.tar.gz dist/ package.json package-lock.json

# 3. Upload to server
scp deploy.tar.gz user@your-server.com:/var/www/neotypa-booktabs/
```

**On server:**
```bash
# 4. SSH into server
ssh user@your-server.com
cd /var/www/neotypa-booktabs

# 5. Extract files
tar -xzf deploy.tar.gz

# 6. Install/update dependencies (only if package.json changed)
npm install --production

# 7. Restart application
pm2 restart neotypa-booktabs

# 8. Verify it's running
pm2 status
pm2 logs neotypa-booktabs --lines 20

# 9. Test in browser
# Visit your application URL
```

**Or use the automated deployment script:**
```bash
./deploy.sh
```

#### Method 2: Git Pull (Alternative)

**Best for:** Development/staging servers, when you have git on server

**On your server:**
```bash
# 1. Pull latest changes
cd /var/www/neotypa-booktabs
git pull

# 2. Install/update dependencies (if package.json changed)
npm install

# 3. Rebuild application
npm run build

# 4. Restart
pm2 restart neotypa-booktabs

# 5. Verify
pm2 status
pm2 logs neotypa-booktabs
```

#### Method 3: Individual File Updates (Quick Fixes)

**For emergency hotfixes or small changes:**

```bash
# Upload only changed files
scp dist/server/index.js user@server:/var/www/neotypa-booktabs/dist/server/
scp dist/client/index.html user@server:/var/www/neotypa-booktabs/dist/client/

# Restart
ssh user@server "cd /var/www/neotypa-booktabs && pm2 restart neotypa-booktabs"
```

### Zero-Downtime Updates (Advanced)

**For high-traffic sites, use PM2 reload instead of restart:**

```bash
# On server after uploading files
pm2 reload neotypa-booktabs

# reload vs restart:
# - restart: Stops app, then starts it (brief downtime)
# - reload: Starts new instance before stopping old one (zero downtime)
```

### Update Checklist

Use this checklist for each deployment:

- [ ] **Backup database** (optional but recommended)
  ```bash
  cp data/app.sqlite data/app.sqlite.backup-$(date +%Y%m%d-%H%M)
  ```
- [ ] **Build on dev machine**: `npm run build`
- [ ] **⚠️ IMPORTANT: If deploying to subdirectory, update base-path in `dist/client/index.html`**
  - Edit the meta tag: `<meta name="base-path" content="/apps/ntbt" />`
  - Use `/` for root deployment, or your subdirectory path (e.g., `/apps/ntbt`)
  - **This must be done after each build if not deploying to root**
- [ ] **Test locally**: `npm start` and verify it works
- [ ] **Upload to server**: `scp` or `tar + upload`
- [ ] **Update dependencies** (if package.json changed): `npm install --production`
- [ ] **Restart application**: `pm2 restart appname`
- [ ] **Check status**: `pm2 status`
- [ ] **Check logs**: `pm2 logs appname --lines 50`
- [ ] **Test in browser**: Visit your URL and verify functionality
- [ ] **Monitor for errors**: Check logs for 5-10 minutes

### Rollback Procedure

If an update breaks something:

```bash
# On server
cd /var/www/neotypa-booktabs

# Stop the broken version
pm2 stop neotypa-booktabs

# Restore from backup
mv dist dist-broken
mv dist-backup dist

# Or restore database if needed
cp data/app.sqlite.backup-YYYYMMDD data/app.sqlite

# Restart
pm2 start neotypa-booktabs

# Verify
pm2 logs neotypa-booktabs
```

**Pro tip:** Keep a backup of the previous `dist/` folder:
```bash
# Before extracting new files
mv dist dist-backup
tar -xzf deploy.tar.gz
```

### Automated Deployment Script

Create `deploy.sh` on your dev machine for one-command deploys:

```bash
#!/bin/bash
# Automated deployment script

set -e  # Exit on error

SERVER="user@your-server.com"
DEPLOY_PATH="/var/www/neotypa-booktabs"
APP_NAME="neotypa-booktabs"

echo "🏗️  Building application..."
npm run build

echo "📦 Creating deployment package..."
tar -czf deploy.tar.gz dist/ package.json package-lock.json

echo "📤 Uploading to server..."
scp deploy.tar.gz $SERVER:$DEPLOY_PATH/

echo "🚀 Deploying on server..."
ssh $SERVER << EOF
  cd $DEPLOY_PATH
  
  # Backup current version
  if [ -d dist ]; then
    mv dist dist-backup-\$(date +%Y%m%d-%H%M)
  fi
  
  # Extract new version
  tar -xzf deploy.tar.gz
  
  # Install dependencies
  npm install --production
  
  # Restart app
  pm2 restart $APP_NAME || pm2 start dist/server/index.js --name $APP_NAME
  
  # Save PM2 config
  pm2 save
  
  # Show status
  echo "📊 Application Status:"
  pm2 status
  
  echo "📝 Recent Logs:"
  pm2 logs $APP_NAME --lines 10 --nostream
EOF

echo "Deployment complete!"
echo "Monitor logs: ssh $SERVER 'pm2 logs $APP_NAME'"
echo "Check status: ssh $SERVER 'pm2 status'"
```

**Make it executable and use:**
```bash
chmod +x deploy.sh
./deploy.sh
```

## Auto-Restart Configuration

PM2 provides automatic restart capabilities for both crashes and server reboots.

### Auto-Restart on Application Crash

**This works automatically with PM2!** No configuration needed.

When your app crashes or exits unexpectedly:
- PM2 detects it immediately
- Automatically restarts your app
- Logs the restart event
- Tracks restart count

**Monitor restarts:**
```bash
pm2 status
# Look at the "restart" column - shows restart count

pm2 logs neotypa-booktabs
# Shows crash/restart events
```

**Configure restart behavior (optional):**
```bash
# Limit restart attempts (if app keeps crashing)
pm2 start dist/server/index.js --name ntbt --max-restarts 10

# Delay between restarts
pm2 start dist/server/index.js --name ntbt --restart-delay 3000

# Don't auto-restart (for debugging)
pm2 start dist/server/index.js --name ntbt --no-autorestart
```

### Auto-Start on Server Reboot

**Configure this once after initial deployment:**

```bash
# Step 1: Generate startup script
pm2 startup

# PM2 will output a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u youruser --hp /home/youruser
# 
# Copy and run that EXACT command (the one PM2 shows you)

# Step 2: Save your current PM2 process list
pm2 save

# This saves all currently running apps to be restored on reboot
```

**After this setup:**
- Server reboots → PM2 starts automatically
- PM2 starts → All saved apps start automatically  
- App crashes → PM2 restarts it immediately

**Verify auto-start is working:**
```bash
# Check if PM2 service is enabled
systemctl status pm2-youruser  # Replace 'youruser' with your username

# Should show: "active (running)" or "loaded"

# List saved apps
pm2 list

# If your app appears, it will start on reboot
```

**Test the auto-start (optional):**
```bash
# Reboot the server
sudo reboot

# After reboot, SSH back in and check:
pm2 status
# Your app should be running!
```

### Updating the Startup Configuration

**If you add/remove apps, update the saved list:**

```bash
# Start your apps as needed
pm2 start app1/index.js --name app1
pm2 start app2/index.js --name app2

# Save the new configuration
pm2 save

# PM2 will now start these apps on reboot
```

**Remove an app from auto-start:**
```bash
pm2 delete appname
pm2 save
```

### Multiple Applications

PM2 can manage multiple Node.js apps on one server:

```bash
# Start multiple apps
pm2 start /var/www/app1/dist/server/index.js --name app1
pm2 start /var/www/app2/dist/server/index.js --name app2
pm2 start /var/www/app3/dist/server/index.js --name app3

# Save all to auto-start
pm2 save

# Manage individually
pm2 restart app1
pm2 logs app2
pm2 stop app3

# Or manage all at once
pm2 restart all
pm2 logs --lines 20
```

### Troubleshooting Auto-Restart

**App not starting after reboot:**

```bash
# Check PM2 service status
systemctl status pm2-$USER

# If not running, enable it:
pm2 startup
# Run the command it shows
pm2 save
```

**App keeps crashing and restarting:**

```bash
# View error logs
pm2 logs appname --err --lines 100

# Common causes:
# - Node.js version mismatch
# - Missing dependencies (run npm install)
# - Port already in use
# - Database file permissions
# - Environment variables not set

# Stop auto-restart to debug:
pm2 stop appname
node dist/server/index.js  # Run directly to see errors
```

**PM2 doesn't save configuration:**

```bash
# Check PM2 home directory
echo $PM2_HOME
# Usually ~/.pm2

# Verify dump file exists
ls -la ~/.pm2/dump.pm2

# If missing, save again:
pm2 save --force
```

### Advanced: PM2 Ecosystem File

For complex setups, create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'neotypa-booktabs',
    script: './dist/server/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 8787
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
```

**Start using ecosystem file:**
```bash
pm2 start ecosystem.config.js
pm2 save
```

[↑ Back to Table of Contents](#table-of-contents)

## Backup

The database is a single file at the path specified in `DB_PATH` (default: `./data/app.sqlite`).

To backup:
```bash
# Create backup
cp data/app.sqlite data/app.sqlite.backup-$(date +%Y%m%d)

# Or use automated backup script
0 2 * * * cp /path/to/neotypa-booktabs/data/app.sqlite /path/to/backups/app-$(date +\%Y\%m\%d).sqlite
```

[↑ Back to Table of Contents](#table-of-contents)

## Troubleshooting

### Server Not Starting

**1. Check Node.js version:**
```bash
node -v
# Must be v20.19.0 or later
```

**If too old:**
```bash
# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# CentOS/RHEL
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# Using n
npm install -g n
n 20
```

**2. Check PM2 status and logs:**
```bash
pm2 status
pm2 logs appname --lines 100
pm2 logs appname --err
```

**3. Try starting directly to see errors:**
```bash
cd /var/www/neotypa-booktabs
node dist/server/index.js
# Watch for error messages
```

**4. Check if port is already in use:**
```bash
lsof -i :8787
# Or: netstat -tlnp | grep 8787
# Or: ss -tlnp | grep 8787
```

### Application Returns 403/404

**1. Verify Node.js is running:**
```bash
pm2 status
# Should show 'online'
```

**2. Test Node.js directly:**
```bash
curl http://localhost:8787
# Should return HTML, not error
```

**3. Check reverse proxy configuration:**
- Plesk: Check "Additional directives" are saved
- Apache: `sudo apache2ctl configtest` then `sudo systemctl status apache2`
- Nginx: `sudo nginx -t` then `sudo systemctl status nginx`

**4. Check proxy modules (Apache):**
```bash
apache2ctl -M | grep proxy
# Should show: proxy_module, proxy_http_module

# If not enabled:
sudo a2enmod proxy proxy_http
sudo systemctl restart apache2
```

**5. Check base-path configuration:**
```bash
# Check what's in your index.html
grep 'base-path' /var/www/neotypa-booktabs/dist/client/index.html
# Should match your URL path (e.g., /apps/ntbt)
```

### API Calls Fail ("Request failed: 404")

**Static HTML loads but login fails:**

1. **Open browser dev tools** (F12) → Network tab
2. **Try to login** and watch the requests
3. **Look for API calls** (usually to `/api/auth/login`)
4. **Check if they're 404 or 500**

**Common causes:**
- Reverse proxy not configured properly
- Base path mismatch
- Node.js server crashed after initial load

**Fix:**
```bash
# Check server logs
pm2 logs appname --lines 50

# Restart server
pm2 restart appname

# Test API directly
curl http://localhost:8787/api/auth/login
# Should return JSON error (because no credentials), not 404
```

### Database Issues

**Permission errors:**
```bash
# Ensure data directory exists and is writable
mkdir -p /var/www/neotypa-booktabs/data
chmod 755 /var/www/neotypa-booktabs/data

# If running as specific user:
chown -R youruser:youruser /var/www/neotypa-booktabs/data
```

**Database locked:**
- Another process has the database open
- Old lock file exists
```bash
# Check for lock file
ls -la /var/www/neotypa-booktabs/data/
# If app.sqlite.lock exists and app is not running:
rm /var/www/neotypa-booktabs/data/app.sqlite.lock
```

### PM2 Issues

**PM2 not found after install:**
```bash
# Install globally
sudo npm install -g pm2

# Or without sudo (add to PATH):
npm install -g pm2
export PATH=$PATH:~/.npm-global/bin
```

**App keeps crashing:**
```bash
# Check error logs
pm2 logs appname --err --lines 200

# Check if it's a Node.js version issue
node -v

# Try running directly to see full error
cd /var/www/neotypa-booktabs
node dist/server/index.js
```

**PM2 doesn't auto-start on reboot:**
```bash
pm2 startup
# Follow the command it shows (usually need to run with sudo)

pm2 save
# This saves the current process list
```

### Performance Issues

**High memory usage:**
```bash
pm2 monit
# Shows real-time stats

# Restart if needed
pm2 restart appname
```

**Slow response times:**
- Check database size: `ls -lh data/app.sqlite`
- Check server resources: `htop` or `top`
- Check network: `ping` your server

### Getting Help

**Collect diagnostic info:**
```bash
# System info
node -v
npm -v
pm2 -v

# Process status
pm2 status
pm2 logs appname --lines 100

# Port check
lsof -i :8787

# Web server status
sudo systemctl status apache2  # or nginx

# Test direct access
curl -v http://localhost:8787
```

```
/var/www/neotypa-booktabs/
├── dist/
│   ├── client/              # Built SPA (HTML, CSS, JS)
│   │   ├── index.html
│   │   └── assets/
│   │       └── app.js
│   └── server/              # Compiled Node.js server
│       ├── index.js
│       ├── config.js
│       ├── auth.js
│       └── ...
├── data/
│   ├── app.sqlite           # Database file (auto-created)
│   └── app.sqlite.lock      # Lock file (auto-created)
├── node_modules/            # Dependencies (production only)
├── .env                     # Your configuration
├── package.json
└── package-lock.json
```

## What Gets Deployed

### Required Files (from build):
- ✅ `dist/` - Compiled JavaScript
- ✅ `package.json` - Dependency list
- ✅ `package-lock.json` - Exact versions

### Created on Server:
- `.env` - Configuration (you create this)
- `data/` - Database directory (auto-created)
- `node_modules/` - Installed via `npm install`

### NOT Needed on Server:
- ❌ `server/src/` - TypeScript source
- ❌ `client/src/` - Client source
- ❌ `scripts/` - Build scripts
- ❌ `tsconfig.json` - TypeScript config
- ❌ Dev dependencies (esbuild, TypeScript, etc.)

## Minimal Server Setup Summary

**One-time server setup:**
```bash
# 1. Install Node.js 18+ (if not installed)
node --version  # Check version

# 2. Install PM2 globally
sudo npm install -g pm2

# 3. Create app directory
sudo mkdir -p /var/www/neotypa-booktabs
sudo chown $USER:$USER /var/www/neotypa-booktabs
```

**Deploy application:**
```bash
# On dev machine: build and upload
npm run build
tar -czf deploy.tar.gz dist/ package.json package-lock.json
scp deploy.tar.gz user@server:/var/www/neotypa-booktabs/

# On server: extract and run
cd /var/www/neotypa-booktabs
tar -xzf deploy.tar.gz
npm install --production
echo "PORT=8787
DB_PATH=/var/www/neotypa-booktabs/data/app.sqlite
PUBLIC_DIR=/var/www/neotypa-booktabs/dist/client
NODE_ENV=production" > .env
mkdir -p data
pm2 start dist/server/index.js --name neotypa-booktabs
pm2 save
pm2 startup  # Follow the command it gives
```

That's it! No database service, no containers, no complex setup.
- The database uses file locking for safe concurrent access

## File Structure After Build

```
neotypa-booktabs/
├── dist/
│   ├── client/      # Built SPA (HTML, CSS, JS)
│   └── server/      # Compiled Node.js server
├── data/
│   ├── app.sqlite   # Database file
│   └── app.sqlite.lock
├── .env             # Your configuration
├── package.json
└── node_modules/
```

## Minimal Deployment

For the absolute minimal deployment, you only need:
- `dist/` directory
- `node_modules/` directory
- `package.json`
- `.env` file
- `data/` directory (created automatically)

You can even zip these and deploy anywhere Node.js runs!

[↑ Back to Table of Contents](#table-of-contents)

---

*End of Deployment Guide*
