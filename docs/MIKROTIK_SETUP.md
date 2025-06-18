# 🔧 Panduan Konfigurasi MikroTik dengan RADIUS Server

## 📋 Prerequisites

1. **RADIUS Server** sudah running di Node.js
2. **MikroTik RouterOS** v6.x atau v7.x
3. **Akses admin** ke MikroTik via Winbox/WebFig/SSH
4. **Koneksi jaringan** antara MikroTik dan RADIUS Server

---

## 🚀 Langkah 1: Setup RADIUS Client di MikroTik

### Via Winbox/WebFig:
1. Buka **System → Users → RADIUS**
2. Klik **Add New** (+)
3. Isi konfigurasi:
   - **Address**: `IP_RADIUS_SERVER` (ganti dengan IP server Node.js)
   - **Secret**: `testing123` (sesuai dengan database)
   - **Service**: `ppp`
   - **Authentication Port**: `1812`
   - **Accounting Port**: `1813`
   - **Timeout**: `3s`
   - **Accounting**: ✅ (centang jika ingin accounting)

### Via Terminal/SSH:
```bash
/radius
add address=192.168.1.100 secret=testing123 service=ppp timeout=3s accounting=yes
```

---

## 🌐 Langkah 2: Buat IP Pool untuk Client PPPoE

### Via Winbox/WebFig:
1. Buka **IP → Pool**
2. Klik **Add New** (+)
3. Isi:
   - **Name**: `pppoe-pool`
   - **Addresses**: `192.168.100.10-192.168.100.100`

### Via Terminal/SSH:
```bash
/ip pool
add name="pppoe-pool" ranges=192.168.100.10-192.168.100.100
```

---

## 👤 Langkah 3: Buat PPP Profile

### Via Winbox/WebFig:
1. Buka **PPP → Profiles**
2. Klik **Add New** (+)
3. **Tab General**:
   - **Name**: `pppoe-radius`
   - **Local Address**: `192.168.100.1`
   - **Remote Address**: `pppoe-pool`
   - **Use Encryption**: ✅
4. **Tab Protocols**:
   - **Use MPLS**: ❌
   - **Use Compression**: ❌
5. **Tab Networking**:
   - **DNS Server**: `8.8.8.8,8.8.4.4`
   - **Change TCP MSS**: ✅

### Via Terminal/SSH:
```bash
/ppp profile
add name="pppoe-radius" \
    local-address=192.168.100.1 \
    remote-address=pppoe-pool \
    use-encryption=yes \
    dns-server=8.8.8.8,8.8.4.4 \
    change-tcp-mss=yes
```

---

## 🔌 Langkah 4: Setup PPPoE Server

### Via Winbox/WebFig:
1. Buka **PPP → PPPoE Servers**
2. Klik **Add New** (+)
3. Isi:
   - **Service Name**: `internet`
   - **Interface**: `ether2` (pilih interface LAN Anda)
   - **Max MTU**: `1480`
   - **Max MRU**: `1480`
   - **Authentication**: `pap,chap`
   - **Keepalive Timeout**: `60`
   - **Default Profile**: `pppoe-radius`

### Via Terminal/SSH:
```bash
/interface pppoe-server server
add service-name="internet" \
    interface=ether2 \
    default-profile=pppoe-radius \
    authentication=pap,chap \
    keepalive-timeout=60 \
    max-mtu=1480 \
    max-mru=1480
```

---

## 🔐 Langkah 5: Konfigurasi PPP untuk RADIUS

### Via Winbox/WebFig:
1. Buka **PPP → AAA**
2. Centang:
   - ✅ **Use RADIUS**
   - ✅ **Accounting** (jika ingin logging)

### Via Terminal/SSH:
```bash
/ppp aaa
set use-radius=yes accounting=yes
```

---

## 🔒 Langkah 6: Firewall Configuration (Opsional)

Jika ada firewall yang memblok, buka port RADIUS:

```bash
/ip firewall filter
add chain=input protocol=udp dst-port=1812 action=accept comment="RADIUS Auth"
add chain=input protocol=udp dst-port=1813 action=accept comment="RADIUS Accounting"
```

---

## 🧪 Langkah 7: Testing Konfigurasi

### 1. Test User Manual (Via Terminal):
```bash
# Tambah user manual untuk testing
/ppp secret
add name=testuser password=testpass service=pppoe profile=pppoe-radius

# Test koneksi
/ppp active print
```

### 2. Test dari Client:
1. **Windows**: Buat koneksi PPPoE baru
   - Username: `testuser`
   - Password: `testpass`
   - Server: Otomatis terdeteksi

2. **Linux**:
   ```bash
   sudo pppoeconf
   # Ikuti wizard, masukkan username/password
   ```

### 3. Monitor di MikroTik:
```bash
# Lihat koneksi aktif
/ppp active print

# Lihat log RADIUS
/log print where topics~"radius"

# Monitor interface
/interface monitor pppoe-out1
```

---

## 📊 Monitoring dan Troubleshooting

### 1. Enable Logging untuk Debug:
```bash
/system logging
add topics=radius,debug action=memory
add topics=ppp,debug action=memory
```

### 2. Lihat Status RADIUS:
```bash
/radius print detail
/radius incoming print
```

### 3. Check Active Connections:
```bash
/ppp active print detail
/ppp secret print
```

### 4. Common Issues & Solutions:

| Problem | Solution |
|---------|----------|
| Authentication failed | • Check user exists in RADIUS database<br>• Verify secret key matches<br>• Check IP address RADIUS server |
| Can't reach RADIUS server | • Check network connectivity<br>• Verify firewall rules<br>• Test port 1812/1813 |
| PPPoE server not responding | • Check interface configuration<br>• Verify service name<br>• Check MTU/MRU settings |

---

## 🔧 Advanced Configuration

### 1. Multiple NAS Configuration:
Jika Anda punya beberapa MikroTik, tambahkan setiap router ke database:

```sql
INSERT INTO nas (nasname, shortname, type, ports, secret, description) VALUES
('192.168.1.1', 'mikrotik-branch1', 'mikrotik', 1700, 'secret123', 'Branch 1 Router'),
('192.168.2.1', 'mikrotik-branch2', 'mikrotik', 1700, 'secret456', 'Branch 2 Router');
```

### 2. Different Profiles per Group:
```bash
# Profile untuk premium users
/ppp profile
add name="premium-profile" \
    local-address=192.168.200.1 \
    remote-address=premium-pool \
    rate-limit=50M/50M

# Profile untuk standard users  
/ppp profile
add name="standard-profile" \
    local-address=192.168.100.1 \
    remote-address=standard-pool \
    rate-limit=10M/10M
```

### 3. Bandwidth Management:
```bash
# Simple queue berdasarkan user group
/queue simple
add name="premium-users" target=192.168.200.0/24 max-limit=50M/50M
add name="standard-users" target=192.168.100.0/24 max-limit=10M/10M
```

---

## 📋 Checklist Deployment

- [ ] RADIUS Server running dan accessible
- [ ] Database setup dengan user test
- [ ] MikroTik RADIUS client configured
- [ ] IP Pool created
- [ ] PPP Profile configured  
- [ ] PPPoE Server running
- [ ] PPP AAA menggunakan RADIUS
- [ ] Firewall rules (jika diperlukan)
- [ ] Test authentication berhasil
- [ ] Monitoring dan logging aktif

---

## 🚨 Important Notes

1. **Secret Key**: Pastikan secret key di MikroTik sama dengan di database `nas`
2. **IP Address**: Ganti `IP_RADIUS_SERVER` dengan IP actual server Node.js
3. **Interface**: Sesuaikan `ether2` dengan interface yang benar
4. **IP Range**: Sesuaikan range IP pool dengan network Anda
5. **MTU/MRU**: Setting 1480 untuk avoid fragmentation issues
6. **Backup**: Selalu backup config sebelum perubahan:
   ```bash
   /export file=backup-before-radius
   ```

---

## 📞 Support Commands

```bash
# Export current config
/export file=current-config

# Reset to factory (HATI-HATI!)
/system reset-configuration

# Reboot router
/system reboot

# Check version
/system routerboard print
/system resource print
```

Dengan mengikuti panduan ini, MikroTik Anda akan terhubung dengan RADIUS Server Node.js dan dapat melakukan autentikasi PPPoE users.
