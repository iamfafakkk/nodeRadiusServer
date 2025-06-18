# RADIUS Server Management UI

UI manajemen untuk RADIUS Server menggunakan Node.js, Express, EJS, dan MySQL.

## Fitur

### Sistem Autentikasi
- ✅ Login & Logout dengan session management
- ✅ Setup admin pertama otomatis
- ✅ Middleware proteksi untuk halaman admin
- ✅ Hash password dengan bcryptjs

### Dashboard Admin
- ✅ Dashboard dengan statistik
- ✅ Manajemen user admin
- ✅ Tambah, edit, hapus user
- ✅ Role-based access (Super Admin)

### UI/UX
- ✅ Responsive design dengan CSS modern
- ✅ Template engine EJS
- ✅ Flash messages untuk feedback
- ✅ Loading states dan validasi form

## Instalasi

1. **Clone Repository**
   ```bash
   git clone <repository-url>
   cd nodeRadiusServer
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Setup Database**
   ```bash
   # Jalankan script SQL untuk membuat database dan tabel
   mysql -u root -p < database/setup.sql
   ```

4. **Konfigurasi Environment**
   ```bash
   cp .env.example .env
   # Edit file .env sesuai konfigurasi database Anda
   ```

5. **Jalankan Aplikasi**
   ```bash
   npm start
   ```

## Penggunaan

### Setup Awal

1. **Akses aplikasi** di `http://localhost:3000`
2. **Setup Admin Pertama**: Jika belum ada admin, sistem akan redirect ke halaman setup
3. **Login**: Gunakan credentials admin yang telah dibuat
4. **Dashboard**: Akses fitur manajemen setelah login

### Fitur Admin

#### Dashboard
- Statistik sistem
- Quick actions
- Status server

#### Manajemen Users (Super Admin Only)
- Lihat daftar semua admin users
- Tambah admin user baru
- Hapus admin user (kecuali diri sendiri)

### API Endpoints (Existing)

API RADIUS tetap tersedia di `/api/*`:
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/nas` - List NAS clients
- `POST /api/nas` - Add NAS client

### Web Interface Routes

```
GET  /               → Redirect to dashboard or setup
GET  /setup          → Setup admin pertama
POST /setup          → Process setup admin pertama
GET  /login          → Halaman login
POST /login          → Process login
GET  /logout         → Logout
GET  /dashboard      → Dashboard admin (require auth)
GET  /users          → Manajemen users (require super admin)
GET  /users/add      → Tambah user (require super admin)
POST /users/add      → Process tambah user
POST /users/:id/delete → Hapus user
```

## Middleware

### Auth Middleware
- `requireAuth`: Memastikan user sudah login
- `redirectIfAuth`: Redirect jika sudah login
- `checkAdminExists`: Cek apakah sudah ada admin
- `redirectIfAdminExists`: Redirect jika sudah ada admin
- `requireSuperAdmin`: Memastikan user adalah super admin

## Database Schema

### Tabel admin_users
```sql
CREATE TABLE admin_users (
  id int(11) NOT NULL AUTO_INCREMENT,
  username varchar(50) NOT NULL UNIQUE,
  email varchar(100) NOT NULL UNIQUE,
  password varchar(255) NOT NULL,
  is_super_admin tinyint(1) DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);
```

## Keamanan

- ✅ Password di-hash menggunakan bcryptjs
- ✅ Session-based authentication
- ✅ CSRF protection dengan form validation
- ✅ Input sanitization dan validation
- ✅ Role-based access control

## File Structure

```
├── controllers/
│   ├── AdminController.js    # Controller untuk admin UI
│   ├── NasController.js      # Existing
│   └── UserController.js     # Existing
├── middleware/
│   └── auth.js              # Middleware autentikasi
├── models/
│   ├── AdminModel.js        # Model untuk admin users
│   └── RadiusModel.js       # Existing
├── public/
│   ├── css/
│   │   └── style.css        # Styling UI
│   └── js/
│       └── main.js          # JavaScript frontend
├── routes/
│   ├── admin.js             # Routes untuk admin UI
│   └── api.js               # Existing API routes
├── views/
│   ├── partials/
│   │   ├── header.ejs       # Header component
│   │   └── alerts.ejs       # Alert messages
│   ├── setup.ejs            # Setup admin pertama
│   ├── login.ejs            # Halaman login
│   ├── dashboard.ejs        # Dashboard
│   ├── users.ejs            # Manajemen users
│   ├── add-user.ejs         # Tambah user
│   └── 404.ejs              # Error page
└── index.js                 # Main server file
```

## Environment Variables

```bash
# Server Configuration
HTTP_PORT=3000
RADIUS_PORT=1812

# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=radius

# Session Configuration
SESSION_SECRET=your-very-secret-session-key

# Environment
NODE_ENV=development
```

## Troubleshooting

### Database Connection Error
- Pastikan MySQL server berjalan
- Cek konfigurasi database di `.env`
- Pastikan database `radius` sudah dibuat

### Session Issues
- Pastikan `SESSION_SECRET` di set di `.env`
- Clear browser cookies jika ada masalah login

### Permission Issues
- Pastikan user pertama dibuat sebagai super admin
- Cek role user di database `admin_users.is_super_admin`

## Development

### Testing
```bash
# Install development dependencies
npm install --dev

# Run tests (if available)
npm test
```

### Production Deployment
1. Set `NODE_ENV=production` di `.env`
2. Gunakan reverse proxy (nginx) untuk SSL
3. Set `cookie.secure=true` untuk HTTPS
4. Gunakan process manager seperti PM2

```bash
# Using PM2
npm install -g pm2
pm2 start ecosystem.config.js
```

## Contributing

1. Fork repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## License

ISC License
