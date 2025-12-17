# Quick Deployment Guide

## Table of Contents

- [Prerequisites](#prerequisites)
- [How It Works](#how-it-works)
- [Deploy Anywhere](#deploy-anywhere)
  - [Steps](#steps)
  - [What Gets Deployed](#what-gets-deployed)
  - [Testing Locally](#testing-locally)
- [Deploying Updates](#deploying-updates)
  - [Quick Update Process](#quick-update-process)
  - [What Needs Restarting?](#what-needs-restarting)
  - [Update Checklist](#update-checklist)
  - [If Something Goes Wrong](#if-something-goes-wrong)
- [Auto-Restart Configuration](#auto-restart-configuration)
  - [Auto-Restart on Crash](#1-auto-restart-on-crash)
  - [Auto-Start on Server Reboot](#2-auto-start-on-server-reboot)
  - [Verify Auto-Start](#verify-auto-start-is-configured)
  - [Managing Multiple Apps](#managing-multiple-apps)
- [Troubleshooting](#troubleshooting)
  - [403/404 Errors](#403-forbidden-or-404-errors)
  - [Server Won't Start](#server-wont-start-pm2-shows-error-or-offline)
  - [Unsupported Engine Error](#unsupported-engine-error-during-npm-install)
  - [API Calls Fail](#static-files-load-but-login-gives-request-failed-404)
  - [Plesk Issues](#cant-find-additional-directives-in-plesk)
- [Upgrading Node.js](#upgrading-nodejs)

---

## Prerequisites

- **Node.js 20.19.0 or later** (required for Vite 7)
  - Check: `node -v`
  - Upgrade if needed: See [Node.js upgrade guide](#upgrading-nodejs) below
- **Web server with reverse proxy capability**
  - Apache with mod_proxy
  - Nginx
  - Plesk, cPanel, or other hosting panel
- **PM2** (recommended): `npm install -g pm2`

[↑ Back to Table of Contents](#table-of-contents)

## How It Works

**Important:** The Node.js server serves both the API and static files. You do NOT upload files to your web root.

**Architecture:**
```
User Browser (https://yourdomain.com/apps/ntbt)
       ↓
Apache/Nginx (port 80/443) - Your normal web server
       ↓ [reverse proxy]
Node.js Server (port 8787) - Serves API + static files
```

Users only see your normal domain - the internal port (8787) is never exposed.

[↑ Back to Table of Contents](#table-of-contents)

## Deploy Anywhere

This app can be deployed at the root (`/`) or in any subdirectory (`/apps/myapp/`).

### Steps

1. **Build the app locally:**
   ```bash
   npm run build
   ```

2. **Configure the base path** (if deploying to a subdirectory):
   
   Edit `dist/client/index.html` and change:
   ```html
   <meta name="base-path" content="/apps/ntbt" />
   ```
   
   Examples:
   - Root: `content="/"`
   - Subdirectory: `content="/apps/ntbt"`
   - Deep path: `content="/projects/bookmarks"`

3. **Upload to server** (anywhere - doesn't need to be in web root):
   ```bash
   # Create directory on server
   ssh user@server
   mkdir -p /var/www/apps/ntbt
   exit
   
   # Upload the entire built application
   scp -r dist/ package.json user@server:/var/www/apps/ntbt/
   
   # Or use SFTP/WinSCP/FileZilla
   ```

4. **Install dependencies and PM2 on server:**
   ```bash
   # SSH into your server
   ssh user@server
   
   # Install PM2 globally (if not already installed)
   npm install -g pm2
   # If permission denied, use: sudo npm install -g pm2
   
   # Go to app directory
   cd /var/www/apps/ntbt
   
   # Install production dependencies
   npm install --production
   ```

5. **Start the Node.js server:**
   ```bash
   # Start with PM2 (recommended - auto-restarts on crash/reboot)
   pm2 start dist/server/index.js --name ntbt
   pm2 save
   pm2 startup  # Follow the command it shows to enable auto-start on reboot
   
   # Verify it's running
   pm2 status
   pm2 logs ntbt
   
   # Alternative: Start directly (not recommended for production)
   node dist/server/index.js
   ```
   
   The server runs on **port 8787** by default (internal only, not exposed to internet).

6. **Configure reverse proxy** (choose your method):

   ### Option A: Plesk Control Panel
   
   1. Go to **Websites & Domains**
   2. Click your domain (e.g., **vincearter.com**)
   3. Click **Apache & nginx Settings**
   4. Scroll to the bottom of the page
   5. Add to **both** "Additional directives for HTTP" and "Additional directives for HTTPS":
      ```apache
      ProxyPass /apps/ntbt http://localhost:8787
      ProxyPassReverse /apps/ntbt http://localhost:8787
      ProxyPreserveHost On
      ```
   6. Click **OK** or **Apply**
   7. Test: Visit https://yourdomain.com/apps/ntbt
   
   ### Option B: cPanel with WHM
   
   1. Go to WHM → Service Configuration → Apache Configuration → Include Editor
   2. Select "Pre Main Include"
   3. Add:
      ```apache
      <VirtualHost *:80>
          ServerName yourdomain.com
          ProxyPass /apps/ntbt http://localhost:8787
          ProxyPassReverse /apps/ntbt http://localhost:8787
          ProxyPreserveHost On
      </VirtualHost>
      
      <VirtualHost *:443>
          ServerName yourdomain.com
          ProxyPass /apps/ntbt http://localhost:8787
          ProxyPassReverse /apps/ntbt http://localhost:8787
          ProxyPreserveHost On
      </VirtualHost>
      ```
   4. Click "Update"
   5. Rebuild Apache config and restart
   
   ### Option C: Apache (Direct VPS Access)
   
   **Enable required modules:**
   ```bash
   sudo a2enmod proxy proxy_http
   sudo systemctl restart apache2
   ```
   
   **Edit your vhost file** (usually in `/etc/apache2/sites-available/`):
   ```bash
   sudo nano /etc/apache2/sites-available/yourdomain.com.conf
   ```
   
   **Add inside the `<VirtualHost>` block:**
   ```apache
   <VirtualHost *:80>
       ServerName yourdomain.com
       
       # ... existing configuration ...
       
       ProxyPass /apps/ntbt http://localhost:8787
       ProxyPassReverse /apps/ntbt http://localhost:8787
       ProxyPreserveHost On
   </VirtualHost>
   ```
   
   **For HTTPS, add the same to the SSL vhost (port 443).**
   
   **Restart Apache:**
   ```bash
   sudo systemctl restart apache2
   ```
   
   ### Option D: Nginx (Direct VPS Access)
   
   **Edit your nginx site config** (usually in `/etc/nginx/sites-available/`):
   ```bash
   sudo nano /etc/nginx/sites-available/yourdomain.com
   ```
   
   **Add inside the `server` block:**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       # ... existing configuration ...
       
       location /apps/ntbt {
           proxy_pass http://localhost:8787;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   
   **Test and reload:**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### What Gets Deployed

**Everything goes to one location** (e.g., `/var/www/apps/ntbt/`):

- `dist/client/` - Static files (HTML, CSS, JS)
  - `index.html` - Entry point
  - `assets/app.css` - All styles
  - `assets/app.js` - Client bundle
- `dist/server/` - Compiled Node.js server
- `node_modules/` - Production dependencies only
- `package.json` - For npm install
- `data/` - SQLite database (auto-created)

**The Node.js server serves both:**
- API endpoints at `/api/*`
- Static client files at all other paths

### Testing Locally

```bash
npm run build
npm start
```

Visit http://localhost:8787

[↑ Back to Table of Contents](#table-of-contents)

## Deploying Updates

After making changes to your code, here's how to deploy updates:

### Quick Update Process

**On your development machine:**
```bash
# 1. Make your changes to code
# 2. Build the updated application
npm run build

# 3. Upload to server (same as initial deploy)
scp -r dist/ package.json user@server:/var/www/apps/ntbt/
```

**On your server:**
```bash
# 4. Install any new dependencies (if package.json changed)
cd /var/www/apps/ntbt
npm install --production

# 5. Restart the application
pm2 restart ntbt

# 6. Verify it's running
pm2 status
pm2 logs ntbt --lines 20
```

### What Needs Restarting?

- **Client changes only** (HTML/CSS/JS): Restart needed - PM2 serves static files
- **Server changes only** (API/backend): Restart needed - code is cached in memory
- **Both changed**: Restart needed

**Always restart after deploying updates:** `pm2 restart ntbt`

### Update Checklist

- [ ] Build locally: `npm run build`
- [ ] **⚠️ IMPORTANT: If deploying to subdirectory, update base-path in `dist/client/index.html`**
  - Edit line: `<meta name="base-path" content="/apps/ntbt" />`
  - Use `/` for root deployment, or your subdirectory path
- [ ] Upload `dist/` folder to server
- [ ] If package.json changed: `npm install --production` on server
- [ ] Restart: `pm2 restart ntbt`
- [ ] Test the application in browser
- [ ] Check logs: `pm2 logs ntbt`

### If Something Goes Wrong

**Rollback to previous version:**
```bash
# If you have a backup of dist/ folder
pm2 stop ntbt
mv dist dist-broken
mv dist-backup dist
pm2 start ntbt
```

**Check what went wrong:**
```bash
pm2 logs ntbt --err --lines 100
```

[↑ Back to Table of Contents](#table-of-contents)

## Auto-Restart Configuration

PM2 automatically handles crashes and server reboots if configured properly:

### 1. Auto-Restart on Crash

**PM2 does this automatically!** If your app crashes, PM2 will restart it immediately.

```bash
# Check auto-restart is working
pm2 status
# Look at the "restart" column - shows how many times it's restarted
```

### 2. Auto-Start on Server Reboot

**Configure once after initial setup:**

```bash
# Generate startup script
pm2 startup

# PM2 will show a command like:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u youruser --hp /home/youruser

# Copy and run that EXACT command it shows

# Save your current PM2 process list
pm2 save

# Test it works
pm2 list
```

**After this setup:**
- Server reboots → PM2 starts automatically
- PM2 starts → Your app starts automatically
- App crashes → PM2 restarts it immediately

### Verify Auto-Start Is Configured

```bash
# Check if PM2 will start on boot
systemctl status pm2-youruser

# List saved processes
pm2 list

# If you see your app listed, you're all set!
```

### Managing Multiple Apps

```bash
# Start multiple apps
pm2 start dist/server/index.js --name app1
pm2 start other-app/index.js --name app2

# Save all running apps
pm2 save

# They'll all auto-restart on crash/reboot
pm2 list
```

### Troubleshooting

**App not starting after reboot:**
```bash
# Check PM2 startup is configured
systemctl status pm2-youruser

# If not found, run pm2 startup again
pm2 startup
# Then run the command it shows
pm2 save
```

**App keeps crashing:**
```bash
# View error logs
pm2 logs ntbt --err

# Common issues:
# - Wrong Node.js version
# - Missing dependencies
# - Port already in use
# - File permission errors
```

[↑ Back to Table of Contents](#table-of-contents)

### Testing Locally

**403 Forbidden or 404 errors:**
- Verify Node.js server is running: `pm2 status` or `ps aux | grep node`
- Check server logs: `pm2 logs ntbt --lines 50`
- Test Node.js directly: Try accessing from the server itself
  ```bash
  # If curl gives "No such file or directory", install it:
  apt-get install curl  # or: yum install curl
  
  # Test the server:
  curl http://localhost:8787
  # Should return HTML
  ```
- Confirm reverse proxy is configured (check Apache/Nginx config)
- Restart web server after config changes:
  ```bash
  # Apache
  systemctl restart apache2
  
  # Nginx
  systemctl reload nginx
  
  # Plesk - automatic, but you can also:
  /usr/local/psa/admin/bin/httpdmng --reconfigure-domain yourdomain.com
  ```

**Server won't start (PM2 shows error or offline):**
- Check Node.js version: `node -v` (must be ≥20.19.0)
- Check if port 8787 is already in use:
  ```bash
  lsof -i :8787
  # Or: netstat -tlnp | grep 8787
  # Or: ss -tlnp | grep 8787
  ```
- View detailed error logs: `pm2 logs ntbt --err --lines 100`
- Try starting directly to see errors: `cd /var/www/apps/ntbt && node dist/server/index.js`

**"Unsupported engine" error during npm install:**
- Your Node.js version is too old (need ≥20.19.0)
- See [Upgrading Node.js](#upgrading-nodejs) below

**Static files load but login gives "Request failed: 404":**
- The reverse proxy isn't working or configured incorrectly
- API calls to `/apps/ntbt/api/*` aren't reaching the Node.js server
- Check that ProxyPass/proxy_pass is configured for the correct path
- Verify the base-path in `dist/client/index.html` matches your URL path

**Can't find "Additional directives" in Plesk:**
- Make sure you're on the **domain-specific** page (Websites & Domains → Click Domain → Apache & nginx Settings)
- NOT the server-wide "Tools & Settings → Apache & nginx Settings"

[↑ Back to Table of Contents](#table-of-contents)

### Upgrading Node.js

**If Node.js version is too old:**

**Ubuntu/Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v  # Verify
```

**CentOS/RHEL/Rocky Linux:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs
node -v  # Verify
```

**Using n (Node version manager):**
```bash
npm install -g n
n 20
# Or for latest LTS: n lts
node -v  # Verify
```

**Plesk/cPanel:** Check if your hosting panel has a Node.js version selector in the control panel.

[↑ Back to Table of Contents](#table-of-contents)

---

For full details, see [deployment.md](./deployment.md).
