# 🚀 RADIUS Server Management UI

Sistem manajemen RADIUS Server dengan antarmuka web yang modern dan user-friendly.

## ✨ Fitur Utama

### 🔐 Sistem Autentikasi
- **Setup Admin Pertama**: Otomatis redirect ke setup jika belum ada admin
- **Login/Logout**: Session-based authentication dengan keamanan tinggi
- **Role Management**: Super Admin dan Regular Admin
- **Password Security**: Hash dengan bcryptjs + salt

### 📊 Dashboard
- **Statistik Real-time**: User count, server status, dll
- **Quick Actions**: Akses cepat ke fitur utama
- **Responsive Design**: Optimal di desktop dan mobile

### 👥 Manajemen User
- **CRUD Operations**: Create, Read, Update, Delete users
- **Role-based Access**: Hanya Super Admin yang bisa manage users
- **Self-protection**: Tidak bisa hapus akun sendiri
- **Input Validation**: Validasi email, username, password

## 🛠 Instalasi & Setup

### Prerequisites
- Node.js (v14+)
- MySQL (v5.7+)
- NPM atau Yarn

### 1. Clone & Install
```bash
git clone <repository-url>
cd nodeRadiusServer
npm install
```

### 2. Database Setup
```bash
# Masuk ke MySQL
mysql -u root -p

# Jalankan script setup
mysql> source database/setup.sql;
```

### 3. Environment Configuration
```bash
# Copy file konfigurasi
cp .env.example .env

# Edit konfigurasi database
nano .env
```

### 4. Jalankan Aplikasi
```bash
# Development
npm start

# Atau dengan nodemon untuk auto-reload
npm run dev

# Production dengan PM2
pm2 start ecosystem.config.js
```

## 🌐 Akses Aplikasi

### Web Interface
- **URL**: `http://localhost:3000`
- **Setup**: Buat admin pertama jika belum ada
- **Login**: Gunakan credentials yang sudah dibuat

### API Endpoints
- **Base URL**: `http://localhost:3000/api`
- **Health Check**: `http://localhost:3000/health`
- **Documentation**: Lihat file API documentation

## 📱 Penggunaan

### Setup Awal
1. **Akses** `http://localhost:3000`
2. **Setup Admin**: Sistem akan redirect ke halaman setup jika belum ada admin
3. **Isi Form**: Username, email, password, konfirmasi password
4. **Submit**: Admin pertama otomatis menjadi Super Admin

### Login
1. **Akses** halaman login
2. **Masukkan** username dan password
3. **Login**: Redirect ke dashboard setelah berhasil

### Dashboard
- **Lihat statistik** sistem
- **Akses quick actions**
- **Navigate** ke fitur lain

### Manajemen Users (Super Admin)
1. **Akses** menu "Users"
2. **Tambah User**: Klik "Tambah User"
3. **Edit/Hapus**: Gunakan actions di tabel users

## 🔧 Konfigurasi

### Environment Variables (.env)
```bash
# Server Configuration
HTTP_PORT=3000                    # Port untuk web interface
RADIUS_PORT=1812                  # Port untuk RADIUS server

# Database Configuration
DB_HOST=localhost                 # MySQL host
DB_USER=root                      # MySQL username
DB_PASSWORD=your_password         # MySQL password
DB_NAME=radius                    # Database name

# Session Configuration
SESSION_SECRET=your-secret-key    # Secret untuk session (WAJIB GANTI!)

# Environment
NODE_ENV=development              # development atau production
```

### MySQL Configuration
```sql
-- Pastikan user MySQL memiliki privilege yang cukup
GRANT ALL PRIVILEGES ON radius.* TO 'root'@'localhost';
FLUSH PRIVILEGES;
```

## 🏗 Arsitektur

### Backend (Node.js + Express)
```
├── controllers/
│   ├── AdminController.js        # Logic untuk UI admin
│   ├── UserController.js         # Logic untuk RADIUS users
│   └── NasController.js          # Logic untuk NAS clients
├── models/
│   ├── AdminModel.js             # Model untuk admin users
│   └── RadiusModel.js            # Model untuk RADIUS data
├── middleware/
│   └── auth.js                   # Authentication middleware
├── routes/
│   ├── admin.js                  # Routes untuk web interface
│   └── api.js                    # Routes untuk API
└── services/
    └── RadiusService.js          # Service untuk RADIUS operations
```

### Frontend (EJS Templates)
```
├── views/
│   ├── partials/
│   │   ├── header.ejs            # Header component
│   │   └── alerts.ejs            # Flash messages
│   ├── setup.ejs                 # Setup admin pertama
│   ├── login.ejs                 # Login page
│   ├── dashboard.ejs             # Main dashboard
│   ├── users.ejs                 # User management
│   └── add-user.ejs              # Add user form
└── public/
    ├── css/style.css             # Styling
    └── js/main.js                # Frontend JavaScript
```

## 🔒 Keamanan

### Authentication
- **Session-based**: Tidak menggunakan JWT untuk keamanan ekstra
- **Password Hashing**: bcryptjs dengan salt rounds 12
- **Session Security**: HttpOnly cookies, secure flags

### Authorization
- **Role-based Access**: Super Admin vs Regular Admin
- **Route Protection**: Middleware untuk semua route sensitif
- **Self-protection**: User tidak bisa hapus akun sendiri

### Input Validation
- **Server-side**: Validasi di controller
- **Client-side**: JavaScript validation
- **Database**: Constraints dan unique indexes

## 🚨 Troubleshooting

### Database Connection Error
```bash
# Cek status MySQL
sudo systemctl status mysql

# Cek konfigurasi di .env
cat .env

# Test koneksi manual
mysql -h localhost -u root -p radius
```

### Port Already In Use
```bash
# Cek port yang digunakan
lsof -i :3000

# Kill process jika perlu
kill -9 <PID>

# Atau gunakan port lain
HTTP_PORT=3001 npm start
```

### Session Issues
```bash
# Clear browser cookies
# Atau restart server

# Pastikan SESSION_SECRET di set
grep SESSION_SECRET .env
```

### Permission Denied
```bash
# Pastikan file executable
chmod +x start.sh

# Cek ownership
ls -la start.sh
```

## 📈 Production Deployment

### 1. Environment Setup
```bash
# Set production environment
echo "NODE_ENV=production" >> .env

# Set secure session secret
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
```

### 2. Database Optimization
```sql
-- Add indexes untuk performance
CREATE INDEX idx_admin_username ON admin_users(username);
CREATE INDEX idx_admin_email ON admin_users(email);
```

### 3. Process Manager (PM2)
```bash
# Install PM2 globally
npm install -g pm2

# Start dengan PM2
pm2 start ecosystem.config.js --env production

# Setup auto-restart on reboot
pm2 startup
pm2 save
```

### 4. Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 5. SSL Certificate (Let's Encrypt)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com
```

## 🧪 Testing

### Manual Testing
1. **Setup Flow**: Test pembuatan admin pertama
2. **Authentication**: Test login/logout
3. **CRUD Operations**: Test create/read/update/delete users
4. **Access Control**: Test role-based permissions
5. **Error Handling**: Test invalid inputs

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Create test config (artillery.yml)
# Run load test
artillery run artillery.yml
```

## 🤝 Contributing

### Development Setup
```bash
# Install development dependencies
npm install --save-dev nodemon

# Run in development mode
npm run dev
```

### Code Style
- **ESLint**: Follow JavaScript Standard Style
- **Prettier**: Auto-format code
- **Comments**: JSDoc untuk functions penting

### Pull Request Process
1. Fork repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📝 Changelog

### v1.0.0 (Current)
- ✅ Basic authentication system
- ✅ User management interface
- ✅ Dashboard dengan statistik
- ✅ Responsive design
- ✅ Session management
- ✅ Role-based access control

### Roadmap v1.1.0
- 🔄 Real-time statistics
- 🔄 User activity logs
- 🔄 Bulk user operations
- 🔄 Advanced search & filtering
- 🔄 Export/Import functionality

## 📞 Support

### Documentation
- **API Docs**: `/api` endpoint
- **README**: File ini
- **Code Comments**: Inline documentation

### Issues
- **Bug Reports**: GitHub Issues
- **Feature Requests**: GitHub Discussions
- **Security Issues**: Email maintainer

### Community
- **Discord**: [Join our server]
- **Stack Overflow**: Tag `radius-server-nodejs`
- **GitHub Discussions**: Q&A dan ideas

---

## 📄 License

ISC License - Lihat file LICENSE untuk detail lengkap.

## 👨‍💻 Author

**iamfafakkk** - Initial work

---

**⭐ Jika project ini membantu, jangan lupa beri star di GitHub!**
