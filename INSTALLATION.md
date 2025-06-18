# RADIUS Server VPS Installation Guide

Panduan lengkap untuk menginstall RADIUS Server di VPS Ubuntu tanpa akses root.

## Persyaratan Sistem

### VPS Requirements
- **OS**: Ubuntu 18.04, 20.04, 22.04, atau 24.04 LTS
- **RAM**: Minimal 1GB (Rekomendasi 2GB)
- **Storage**: Minimal 10GB free space
- **CPU**: 1 core (Rekomendasi 2 cores)
- **Network**: Public IP address

### User Requirements
- User account dengan sudo privileges (bukan root)
- SSH access ke VPS
- Internet connection untuk download packages

## Quick Installation

### 1. Upload Files ke VPS

```bash
# Method 1: Using SCP (from local machine)
scp -r /path/to/nodeRadiusServer username@your-vps-ip:~/

# Method 2: Using Git (on VPS)
cd ~
git clone https://github.com/your-repo/nodeRadiusServer.git

# Method 3: Using wget/curl (download zip)
wget https://github.com/your-repo/nodeRadiusServer/archive/main.zip
unzip main.zip
mv nodeRadiusServer-main nodeRadiusServer
```

### 2. Run Installation Script

```bash
cd ~/nodeRadiusServer
chmod +x install.sh setup.sh
./install.sh
```

### 3. Run Setup Configuration

```bash
./setup.sh
```

### 4. Start Server

```bash
~/start-radius.sh
```

## Detailed Installation Steps

### Step 1: Prepare VPS

1. **Login to VPS**:
   ```bash
   ssh username@your-vps-ip
   ```

2. **Update system** (optional, script will do this):
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

### Step 2: Run Installation Script

The `install.sh` script will automatically:

1. ✅ Check system compatibility
2. ✅ Install Node.js 18.x
3. ✅ Install MariaDB database
4. ✅ Install PM2 process manager
5. ✅ Setup database and user
6. ✅ Configure firewall rules
7. ✅ Create systemd service
8. ✅ Generate secure passwords
9. ✅ Create management scripts

**Installation log example**:
```
==========================================
   RADIUS Server Installation Script
==========================================

[INFO] Detected Ubuntu version: 22.04
[SUCCESS] Sudo access confirmed
[INFO] Updating system packages...
[SUCCESS] System packages updated
[INFO] Installing Node.js 18...
[SUCCESS] Node.js v18.17.0 installed
[SUCCESS] NPM 9.6.7 installed
...
[SUCCESS] Installation completed successfully!
```

### Step 3: Configuration Setup

The `setup.sh` script will:

1. ✅ Generate RADIUS secrets
2. ✅ Add test users and NAS devices
3. ✅ Setup log rotation
4. ✅ Create monitoring scripts
5. ✅ Create backup scripts

## Post-Installation Configuration

### 1. Environment Configuration

Edit the environment file:
```bash
nano ~/nodeRadiusServer/.env
```

Important settings:
```env
# Update these values for production
RADIUS_SECRET=your-secure-radius-secret
DB_PASSWORD=your-database-password
SERVER_PORT=3000

# Optional: Enable HTTPS
HTTPS_ENABLED=true
SSL_CERT_PATH=/path/to/certificate.crt
SSL_KEY_PATH=/path/to/private.key
```

### 2. Database Access

View database credentials:
```bash
cat ~/.radius_db_config
```

Access database directly:
```bash
# Load credentials
source ~/.radius_db_config

# Connect to database
mysql -u $DB_USER -p$DB_PASS $DB_NAME
```

### 3. Firewall Configuration

The script automatically configures UFW firewall:
- Port 22 (SSH)
- Port 1812 (RADIUS Authentication)
- Port 1813 (RADIUS Accounting)
- Port 3000 (Web Interface)

Check firewall status:
```bash
sudo ufw status
```

## Management Commands

### Server Control

```bash
# Start server
~/start-radius.sh

# Stop server
~/stop-radius.sh

# Check status
~/status-radius.sh

# Monitor server
~/monitor-radius.sh

# Update server
~/update-radius.sh

# Backup server
~/backup-radius.sh
```

### Alternative: System Service

```bash
# Start as system service
sudo systemctl start radius-server

# Stop system service
sudo systemctl stop radius-server

# Check service status
sudo systemctl status radius-server

# Enable auto-start on boot
sudo systemctl enable radius-server
```

### PM2 Commands

```bash
# PM2 status
pm2 status

# View logs
pm2 logs

# Restart application
pm2 restart all

# Stop application
pm2 stop all

# Monitor resources
pm2 monit
```

## Testing Installation

### 1. Check Server Status

```bash
~/monitor-radius.sh
```

Expected output:
```
==========================================
   RADIUS Server Status Monitor
==========================================

=== Process Status ===
✓ RADIUS Server is running
  Process ID: 12345
  Memory Usage: 45.2 MB
  CPU Usage: 0.1%

=== Database Status ===
✓ Database server is running
✓ Database connection successful
  Active Users: 3
  Active NAS Devices: 3

=== Port Status ===
✓ RADIUS Auth port (1812) is listening
✓ RADIUS Accounting port (1813) is listening
✓ Web interface port (3000) is listening
```

### 2. Test RADIUS Authentication

Install radtest (RADIUS client):
```bash
sudo apt install freeradius-utils
```

Test authentication:
```bash
# Test with default user
radtest testuser testpass localhost 1812 your-radius-secret

# Expected output for success:
# Sent Access-Request Id 123 from 0.0.0.0:xxxxx to 127.0.0.1:1812 length 73
# Received Access-Accept Id 123 from 127.0.0.1:1812 length 20
```

### 3. Access Web Interface

Open browser and visit:
```
http://your-vps-ip:3000
```

## Security Hardening

### 1. Change Default Passwords

```bash
# Change RADIUS secret
nano ~/nodeRadiusServer/.env

# Change database passwords
source ~/.radius_db_config
mysql -u $DB_USER -p$DB_PASS $DB_NAME
```

### 2. SSL/TLS Configuration

For production, enable HTTPS:

1. **Get SSL certificate** (Let's Encrypt recommended):
   ```bash
   sudo apt install certbot
   sudo certbot certonly --standalone -d your-domain.com
   ```

2. **Update .env file**:
   ```env
   HTTPS_ENABLED=true
   SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
   SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
   ```

### 3. Firewall Restrictions

Restrict access to specific IP ranges:
```bash
# Allow RADIUS only from specific networks
sudo ufw delete allow 1812/udp
sudo ufw delete allow 1813/udp
sudo ufw allow from 192.168.1.0/24 to any port 1812
sudo ufw allow from 192.168.1.0/24 to any port 1813

# Restrict web interface
sudo ufw delete allow 3000/tcp
sudo ufw allow from your-admin-ip to any port 3000
```

## Troubleshooting

### Common Issues

1. **Port already in use**:
   ```bash
   sudo netstat -tulpn | grep :1812
   sudo kill -9 <process-id>
   ```

2. **Database connection failed**:
   ```bash
   sudo systemctl restart mariadb
   source ~/.radius_db_config
   mysql -u $DB_USER -p$DB_PASS $DB_NAME
   ```

3. **Permission denied**:
   ```bash
   sudo chown -R $USER:$USER ~/nodeRadiusServer
   chmod +x ~/nodeRadiusServer/*.sh
   ```

4. **Service won't start**:
   ```bash
   sudo systemctl status radius-server
   sudo journalctl -u radius-server -f
   ```

### Log Files

Check logs for errors:
```bash
# Application logs
tail -f ~/nodeRadiusServer/logs/server.log
tail -f ~/nodeRadiusServer/logs/auth.log
tail -f ~/nodeRadiusServer/logs/error.log

# System logs
sudo journalctl -u radius-server -f

# PM2 logs
pm2 logs
```

## Maintenance

### Regular Tasks

1. **Update system packages**:
   ```bash
   sudo apt update && sudo apt upgrade -y
   ```

2. **Backup data**:
   ```bash
   ~/backup-radius.sh
   ```

3. **Monitor disk space**:
   ```bash
   df -h
   ```

4. **Check log sizes**:
   ```bash
   du -sh ~/nodeRadiusServer/logs/
   ```

### Database Maintenance

```bash
# Optimize database
source ~/.radius_db_config
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "OPTIMIZE TABLE users, nas, accounting;"

# Check database size
mysql -u $DB_USER -p$DB_PASS $DB_NAME -e "SELECT table_name, ROUND(((data_length + index_length) / 1024 / 1024), 2) AS 'Size (MB)' FROM information_schema.tables WHERE table_schema = '$DB_NAME';"
```

## Support

### Getting Help

1. **Check logs** for error messages
2. **Run monitor script** to check status
3. **Verify configuration** files
4. **Test network connectivity**

### Contact Information

- GitHub Issues: [Create an issue](https://github.com/your-repo/nodeRadiusServer/issues)
- Documentation: [Wiki](https://github.com/your-repo/nodeRadiusServer/wiki)

## Files Created by Installation

### Configuration Files
- `~/.radius_db_config` - Database credentials
- `~/.mysql_root_password` - MySQL root password
- `~/nodeRadiusServer/.env` - Environment configuration

### Management Scripts
- `~/start-radius.sh` - Start server
- `~/stop-radius.sh` - Stop server
- `~/status-radius.sh` - Check status
- `~/monitor-radius.sh` - Monitor server
- `~/update-radius.sh` - Update server
- `~/backup-radius.sh` - Backup data

### System Files
- `/etc/systemd/system/radius-server.service` - Systemd service
- `/etc/logrotate.d/radius-server` - Log rotation config

---

**Note**: This installation guide assumes you have basic Linux command-line knowledge. Always test in a development environment before deploying to production.
