# Node.js RADIUS Server

RADIUS Server sederhana yang dibangun dengan Node.js untuk autentikasi PPPoE dari MikroTik menggunakan MySQL sebagai database.

## ✨ Fitur

- 🔐 Autentikasi RADIUS (PAP/CHAP)
- 📊 Accounting RADIUS  
- 🖥️ Support multi NAS (MikroTik)
- 🚀 Deployment dengan PM2
- 📝 Logging lengkap
- 🌐 REST API untuk CRUD user
- 💾 Database MySQL
- ⚡ Performa tinggi dengan connection pooling

## 🏗️ Arsitektur

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   MikroTik      │    │  RADIUS Server  │    │     MySQL       │
│   (NAS Client)  │◄──►│   (Node.js)     │◄──►│   Database      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   REST API      │
                       │   (Express)     │
                       └─────────────────┘
```

## 📋 Requirements

- Node.js >= 16.x
- MySQL >= 5.7
- PM2 (untuk production)

## 🚀 Installation

### 1. Clone Repository & Install Dependencies

```bash
cd nodeRadiusServer
npm install
```

### 2. Setup Database

```bash
# Login ke MySQL sebagai root
mysql -u root -p

# Import database schema
mysql -u root -p < database/setup.sql
```

### 3. Konfigurasi Environment

File `.env` sudah ada dengan konfigurasi:

```env
DB_HOST=192.168.90.6
DB_USER=radius
DB_PASS=radiusradius
DB_NAME=radius
```

Sesuaikan dengan konfigurasi MySQL Anda.

### 4. Jalankan Server

#### Development Mode
```bash
npm run dev
```

#### Production Mode dengan PM2
```bash
npm run pm2:start
```

## 📡 Konfigurasi MikroTik

### 1. Tambah RADIUS Client

```bash
/radius
add address=IP_RADIUS_SERVER secret=testing123 service=ppp timeout=3s
```

### 2. Konfigurasi PPP Profile

```bash
/ppp profile
add name="radius-profile" use-encryption=yes local-address=192.168.100.1 remote-address=radius-pool dns-server=8.8.8.8,8.8.4.4
```

### 3. Konfigurasi IP Pool

```bash
/ip pool
add name="radius-pool" ranges=192.168.100.10-192.168.100.100
```

### 4. Setup PPPoE Server

```bash
/interface pppoe-server server
add service-name="internet" interface=ether2 default-profile=radius-profile authentication=pap,chap
```

## 🌐 REST API Documentation

Base URL: `http://localhost:3000/api`

### Users Endpoints

#### Get All Users
```http
GET /api/users
```

#### Get User by Username
```http
GET /api/users/{username}
```

#### Create User
```http
POST /api/users
Content-Type: application/json

{
  "username": "newuser",
  "password": "newpassword",
  "groupname": "default"
}
```

#### Update User
```http
PUT /api/users/{username}
Content-Type: application/json

{
  "password": "newpassword",
  "groupname": "premium"
}
```

#### Delete User
```http
DELETE /api/users/{username}
```

#### Bulk Create Users
```http
POST /api/users/bulk
Content-Type: application/json

{
  "users": [
    {
      "username": "user1",
      "password": "pass1",
      "groupname": "default"
    },
    {
      "username": "user2", 
      "password": "pass2",
      "groupname": "premium"
    }
  ]
}
```

## 📊 Monitoring

### Health Check
```http
GET /health
```

### Logs
- Authentication logs: `logs/auth.log`
- Server logs: `logs/server.log`
- Error logs: `logs/error.log`
- PM2 logs: `logs/pm2-*.log`

### PM2 Commands

```bash
# Start
npm run pm2:start

# Stop
npm run pm2:stop

# Restart
npm run pm2:restart

# Delete
npm run pm2:delete

# Monitor
pm2 monit

# Logs
pm2 logs noderadiusserver
```

## 🔧 Database Schema

### Key Tables

- `nas` - NAS clients (MikroTik routers)
- `radcheck` - User credentials
- `radreply` - User reply attributes
- `radgroupcheck` - Group check attributes
- `radgroupreply` - Group reply attributes
- `radusergroup` - User to group mapping
- `radacct` - Accounting data

### Default Groups

- `default` - Standard users (1 concurrent session)
- `premium` - Premium users (2 concurrent sessions)
- `unlimited` - Unlimited users (999 concurrent sessions)

## 🔐 Default Users

| Username | Password | Group |
|----------|----------|-------|
| testuser | testpass | default |
| admin | admin123 | unlimited |
| user1 | password1 | premium |

## 🚨 Troubleshooting

### Common Issues

1. **Database Connection Failed**
   - Check MySQL service status
   - Verify credentials in `.env`
   - Ensure database `radius` exists

2. **RADIUS Port in Use**
   - Check if other RADIUS server is running
   - Use different port in environment variables

3. **MikroTik Can't Authenticate**
   - Verify NAS client secret in database
   - Check firewall rules (port 1812/1813)
   - Verify user credentials

### Debug Mode

```bash
NODE_ENV=development npm start
```

## 📈 Performance Tips

1. **Database Optimization**
   - Regular cleanup of old `radacct` records
   - Proper indexing (already included)
   - Connection pooling (implemented)

2. **Server Optimization**  
   - Use PM2 in production
   - Monitor memory usage
   - Regular log rotation

## 🔄 Updates & Maintenance

### Update Dependencies
```bash
npm update
```

### Database Backup
```bash
mysqldump -u radius -p radius > backup_$(date +%Y%m%d).sql
```

### Log Rotation
Consider setting up log rotation for production:

```bash
# Add to crontab
0 0 * * * /usr/sbin/logrotate /path/to/logrotate.conf
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Create Pull Request

## 📄 License

ISC License

## 👨‍💻 Author

iamfafakkk

---

**Happy coding! 🚀**
