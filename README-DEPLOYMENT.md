# RADIUS Server - VPS Deployment Scripts

Koleksi lengkap script untuk deploy RADIUS Server di VPS Ubuntu tanpa akses root.

## 📦 File Yang Disediakan

### Script Instalasi
- `install.sh` - Script instalasi utama untuk VPS Ubuntu
- `setup.sh` - Konfigurasi lanjutan setelah instalasi
- `validate.sh` - Validasi instalasi dan konfigurasi
- `create-dist.sh` - Membuat paket distribusi

### Script Management
- `start-radius.sh` - Mulai server (dibuat otomatis)
- `stop-radius.sh` - Hentikan server (dibuat otomatis)
- `status-radius.sh` - Cek status server (dibuat otomatis)
- `monitor-radius.sh` - Monitor server (dibuat otomatis)
- `backup-radius.sh` - Backup data (dibuat otomatis)

### Dokumentasi
- `INSTALLATION.md` - Panduan instalasi lengkap
- `README-DEPLOY.md` - Panduan deployment (dibuat otomatis)

## 🚀 Quick Start

### 1. Persiapan Paket Distribusi

```bash
# Jalankan di komputer lokal
./create-dist.sh
```

Script ini akan membuat:
- `radius-server-YYYYMMDD_HHMMSS.tar.gz` - Paket lengkap
- `upload-to-vps.sh` - Helper script upload

### 2. Upload ke VPS

```bash
# Method 1: Manual upload
scp radius-server-*.tar.gz user@vps-ip:~/

# Method 2: Menggunakan helper script
./upload-to-vps.sh user@vps-ip

# Method 3: Upload dengan SSH key
./upload-to-vps.sh user@vps-ip ~/.ssh/id_rsa
```

### 3. Install di VPS

```bash
# Login ke VPS
ssh user@vps-ip

# Extract dan install
tar -xzf radius-server-*.tar.gz
cd radius-server-dist
./quick-start.sh
```

## 📋 Persyaratan Sistem

### VPS Requirements
- **OS**: Ubuntu 18.04, 20.04, 22.04, atau 24.04 LTS
- **RAM**: Minimal 1GB (Rekomendasi 2GB)
- **Storage**: Minimal 10GB free space
- **CPU**: 1 core (Rekomendasi 2 cores)
- **Network**: Public IP address

### User Requirements
- User account dengan sudo privileges (BUKAN root)
- SSH access ke VPS
- Internet connection untuk download packages

## 🔧 Proses Instalasi Detail

### Script install.sh akan melakukan:

1. ✅ **System Check** - Validasi Ubuntu dan sudo access
2. ✅ **System Update** - Update package repository
3. ✅ **Install Dependencies** - Node.js 18.x, build tools
4. ✅ **Database Setup** - MariaDB server dan konfigurasi
5. ✅ **Security Setup** - Generate password aman
6. ✅ **PM2 Installation** - Process manager
7. ✅ **Firewall Config** - UFW rules untuk RADIUS ports
8. ✅ **Service Setup** - Systemd service
9. ✅ **App Deployment** - Copy dan install aplikasi
10. ✅ **Scripts Creation** - Management scripts

### Script setup.sh akan melakukan:

1. ✅ **RADIUS Secrets** - Generate RADIUS secret
2. ✅ **Test Data** - User dan NAS test
3. ✅ **Log Rotation** - Konfigurasi logrotate
4. ✅ **Monitoring** - Script monitoring
5. ✅ **Backup Setup** - Script backup otomatis

## 🛠 Management Commands

Setelah instalasi, tersedia command berikut:

```bash
# Server Control
~/start-radius.sh      # Start server
~/stop-radius.sh       # Stop server
~/status-radius.sh     # Check status

# Monitoring
~/monitor-radius.sh    # Real-time monitoring
~/validate.sh          # Validate installation

# Maintenance
~/backup-radius.sh     # Backup data
~/update-radius.sh     # Update server (jika ada git repo)

# Alternative: System Service
sudo systemctl start radius-server
sudo systemctl stop radius-server
sudo systemctl status radius-server
```

## 📊 Default Configuration

Setelah instalasi:

### Network Ports
- **RADIUS Auth**: 1812/udp
- **RADIUS Accounting**: 1813/udp  
- **Web Interface**: 3000/tcp

### Test Accounts
- **Users**: testuser/testpass, admin/admin123, guest/guest123
- **NAS Secrets**: testing123, mikrotik123, cisco123

### Database
- **Host**: localhost
- **Database**: radius_db
- **User**: radius_user
- **Password**: Auto-generated (saved in ~/.radius_db_config)

### Log Files
- **Server**: ~/nodeRadiusServer/logs/server.log
- **Auth**: ~/nodeRadiusServer/logs/auth.log
- **Error**: ~/nodeRadiusServer/logs/error.log

## 🔒 Security Notes

### Setelah Instalasi:
1. **Ganti Password Default**:
   ```bash
   nano ~/nodeRadiusServer/.env
   # Update RADIUS_SECRET dan password lainnya
   ```

2. **Konfigurasi Firewall**:
   ```bash
   # Restrict ke network tertentu
   sudo ufw delete allow 1812/udp
   sudo ufw allow from 192.168.1.0/24 to any port 1812
   ```

3. **SSL/TLS untuk Web Interface**:
   ```bash
   # Install certbot untuk Let's Encrypt
   sudo apt install certbot
   sudo certbot certonly --standalone -d yourdomain.com
   
   # Update .env
   HTTPS_ENABLED=true
   SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
   SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
   ```

## 🧪 Testing Installation

### 1. Validasi Otomatis
```bash
./validate.sh
```

### 2. Test Manual RADIUS
```bash
# Install RADIUS client tools
sudo apt install freeradius-utils

# Test authentication
radtest testuser testpass localhost 1812 your-radius-secret
```

### 3. Monitor Real-time
```bash
~/monitor-radius.sh
```

### 4. Check Logs
```bash
tail -f ~/nodeRadiusServer/logs/server.log
tail -f ~/nodeRadiusServer/logs/auth.log
```

## 🔧 Troubleshooting

### Common Issues:

1. **Port sudah digunakan**:
   ```bash
   sudo netstat -tulpn | grep :1812
   sudo kill -9 <process-id>
   ```

2. **Database connection error**:
   ```bash
   sudo systemctl restart mariadb
   ~/validate.sh
   ```

3. **Permission denied**:
   ```bash
   sudo chown -R $USER:$USER ~/nodeRadiusServer
   chmod +x ~/*.sh
   ```

4. **Service tidak start**:
   ```bash
   sudo systemctl status radius-server
   sudo journalctl -u radius-server -f
   ```

## 📁 File Structure Setelah Install

```
~/nodeRadiusServer/           # Main application
├── index.js                 # Server entry point
├── package.json             # Dependencies
├── .env                     # Environment config
├── config/                  # Configuration files
├── controllers/             # Route controllers
├── models/                  # Database models
├── services/                # Business logic
├── routes/                  # API routes
├── database/               # SQL scripts
├── logs/                   # Log files
└── docs/                   # Documentation

~/                          # Home directory
├── .radius_db_config       # Database credentials
├── .mysql_root_password    # MySQL root password
├── start-radius.sh         # Management scripts
├── stop-radius.sh
├── status-radius.sh
├── monitor-radius.sh
├── backup-radius.sh
└── radius-backups/         # Backup directory

/etc/systemd/system/
└── radius-server.service   # System service

/etc/logrotate.d/
└── radius-server           # Log rotation config
```

## 🚨 Emergency Commands

### Jika Server Tidak Responsif:
```bash
# Force stop all processes
sudo pkill -f "node.*index.js"
pm2 kill

# Restart database
sudo systemctl restart mariadb

# Check system resources
df -h          # Disk space
free -h        # Memory usage
top            # CPU usage
```

### Reset Complete:
```bash
# Stop everything
~/stop-radius.sh
sudo systemctl stop radius-server

# Remove PM2 processes
pm2 delete all

# Start fresh
~/start-radius.sh
```

## 📞 Support

### Getting Help:
1. **Validasi instalasi**: `./validate.sh`
2. **Check logs**: Lihat di `~/nodeRadiusServer/logs/`
3. **System logs**: `sudo journalctl -u radius-server`
4. **Documentation**: Baca `INSTALLATION.md`

### Contact:
- GitHub Issues: Create issue di repository
- Documentation: Check wiki atau docs folder

---

**Catatan**: Script ini dirancang untuk Ubuntu VPS dengan user non-root. Selalu test di development environment sebelum production deployment.

## 📝 Changelog

- **v1.0**: Initial release dengan complete installation scripts
- Automated Ubuntu VPS deployment
- Non-root user installation
- Complete security setup
- Management utilities
- Validation tools

## 🧹 Production Cleanup

### Automatic Cleanup
Script `create-dist.sh` secara otomatis mengecualikan file debugging:

**File yang dikecualikan:**
- `debug_auth.js` - Authentication debug
- `debug_packet.js` - Packet debug  
- `check_user.js` - User check debug
- `debug-auth.sh` - Debug shell script
- `test.sh` - General test script
- `test-custom-setup.sh` - Custom test script
- `mikrotik-test.sh` - MikroTik test
- `mikrotik-fix.sh` - MikroTik fix

### Manual Cleanup
Untuk development environment yang sudah ada:

```bash
# Jalankan production cleanup
./production-cleanup.sh

# Atau create clean distribution
./create-dist.sh
```

### Yang Dihapus oleh Production Cleanup:
- ✅ **Debug scripts**: debug_auth.js, debug_packet.js, check_user.js
- ✅ **Test scripts**: test.sh, mikrotik-test.sh, test-custom-setup.sh
- ✅ **Development files**: .git, .vscode, .gitignore
- ✅ **Temporary files**: *.log, *.bak, *.orig
- ✅ **Development dependencies**: devDependencies dari package.json
- ✅ **Old log files**: Membersihkan log lama

### Yang Dipertahankan:
- ✅ **Core files**: index.js, ecosystem.config.js
- ✅ **Installation scripts**: install.sh, setup.sh, validate.sh
- ✅ **Configuration**: config/, .env
- ✅ **Business logic**: controllers/, models/, services/, routes/
- ✅ **Database**: database/ folder
- ✅ **Documentation**: INSTALLATION.md, docs/
