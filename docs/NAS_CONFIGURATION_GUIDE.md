# 📡 Panduan Konfigurasi NAS (Network Access Server)

## Apa itu NAS Name?

**NAS Name** = IP Address dari MikroTik router yang akan mengirim request autentikasi ke RADIUS Server.

## 🔍 Cara Mendapatkan NAS Name (IP Address MikroTik)

### 1. Dari Interface MikroTik

```bash
# Login ke MikroTik via Winbox atau SSH
/ip address print
```

**Output contoh:**
```
Flags: X - disabled, I - invalid, D - dynamic 
 #   ADDRESS            NETWORK         INTERFACE                           
 0   192.168.1.1/24     192.168.1.0     ether1                              
 1   10.10.10.1/24      10.10.10.0      ether2                              
 2   203.142.75.10/30   203.142.75.8    ether3
```

**Pilih IP yang bisa diakses oleh RADIUS Server:**
- Jika RADIUS Server di jaringan lokal: gunakan IP LAN (192.168.1.1)
- Jika RADIUS Server di internet: gunakan IP WAN (203.142.75.10)

### 2. Dari Command Line MikroTik

```bash
# Cek IP interface yang aktif
/interface print brief

# Cek routing table
/ip route print

# Cek gateway default
/ip route print where dst-address=0.0.0.0/0
```

### 3. Ping Test dari RADIUS Server

```bash
# Test konektivitas dari server ke MikroTik
ping 192.168.1.1

# Test port RADIUS
telnet 192.168.1.1 1812
```

## 🗄️ Cara Menambah NAS ke Database

### 1. Via SQL Direct

```sql
-- Login ke MySQL
mysql -u radius -p

-- Pilih database
USE radius;

-- Tambah NAS baru
INSERT INTO nas (nasname, shortname, type, ports, secret, description) VALUES
('192.168.1.1', 'mikrotik-main', 'mikrotik', 1700, 'rahasia123', 'MikroTik Router Utama'),
('192.168.2.1', 'mikrotik-branch', 'mikrotik', 1700, 'rahasia123', 'MikroTik Cabang'),
('10.10.10.1', 'mikrotik-hotspot', 'mikrotik', 1700, 'rahasia123', 'MikroTik Hotspot');

-- Lihat semua NAS
SELECT * FROM nas;
```

### 2. Via REST API (akan dibuat)

```bash
# Tambah NAS via API
curl -X POST http://localhost:3000/api/nas \
  -H "Content-Type: application/json" \
  -d '{
    "nasname": "192.168.1.1",
    "shortname": "mikrotik-main", 
    "secret": "rahasia123",
    "description": "MikroTik Router Utama"
  }'
```

## 🔧 Konfigurasi di MikroTik

### Step 1: Set IP Address RADIUS Server

```bash
# Ganti IP_RADIUS_SERVER dengan IP server Node.js
/radius
add address=192.168.1.100 secret=rahasia123 service=ppp
```

**Penjelasan:**
- `address=192.168.1.100` = IP RADIUS Server
- `secret=rahasia123` = Harus sama dengan di database
- `service=ppp` = Untuk PPPoE authentication

### Step 2: Test Konektivitas

```bash
# Test ping ke RADIUS server
/ping 192.168.1.100

# Test RADIUS authentication manual
/radius incoming print
```

## 📋 Contoh Skenario Network

### Skenario 1: RADIUS Server Lokal
```
Internet ── [Router] ── [Switch] ── [RADIUS Server: 192.168.1.100]
                │                      │
                └── [MikroTik: 192.168.1.1]
```

**Konfigurasi:**
- MikroTik IP: `192.168.1.1`
- RADIUS Server IP: `192.168.1.100`
- NAS Name di database: `192.168.1.1`

### Skenario 2: Multi-Location
```
Branch A: MikroTik 192.168.1.1 ──┐
Branch B: MikroTik 192.168.2.1 ──┼── Internet ── RADIUS Server (Public IP)
Branch C: MikroTik 192.168.3.1 ──┘
```

**Database NAS:**
```sql
INSERT INTO nas VALUES
(1, '192.168.1.1', 'branch-a', 'mikrotik', 1700, 'secret123', NULL, NULL, 'Branch A'),
(2, '192.168.2.1', 'branch-b', 'mikrotik', 1700, 'secret123', NULL, NULL, 'Branch B'),
(3, '192.168.3.1', 'branch-c', 'mikrotik', 1700, 'secret123', NULL, NULL, 'Branch C');
```

## 🚨 Troubleshooting

### Problem 1: Authentication Gagal

**Kemungkinan Penyebab:**
1. ❌ NAS IP tidak terdaftar di database
2. ❌ Secret key tidak cocok
3. ❌ Firewall block port 1812/1813

**Solusi:**
```sql
-- Cek NAS terdaftar
SELECT * FROM nas WHERE nasname = '192.168.1.1';

-- Update secret jika perlu
UPDATE nas SET secret = 'secret_baru' WHERE nasname = '192.168.1.1';
```

### Problem 2: Tidak Bisa Connect ke RADIUS

**Check List:**
```bash
# 1. Ping test
ping IP_RADIUS_SERVER

# 2. Port test
telnet IP_RADIUS_SERVER 1812

# 3. Firewall check di MikroTik
/ip firewall filter print

# 4. Check RADIUS server logs
tail -f /path/to/radius/logs/auth.log
```

### Problem 3: Multiple IP di MikroTik

Jika MikroTik punya banyak IP, tentukan mana yang digunakan untuk RADIUS:

```bash
# Lihat semua IP
/ip address print

# Lihat routing
/ip route print

# Set source IP untuk RADIUS (jika perlu)
/radius set src-address=192.168.1.1
```

## 📝 Checklist Konfigurasi

### ✅ Di Database RADIUS Server:
- [ ] NAS IP address sudah ditambahkan
- [ ] Secret key sudah diset
- [ ] Test koneksi database berhasil

### ✅ Di MikroTik:
- [ ] IP RADIUS server sudah dikonfigurasi
- [ ] Secret key sama dengan database
- [ ] Ping ke RADIUS server berhasil
- [ ] PPPoE server sudah dikonfigurasi

### ✅ Network:
- [ ] Firewall tidak block port 1812/1813
- [ ] Routing antar device sudah benar
- [ ] DNS resolution berfungsi (jika pakai hostname)

## 🔍 Monitoring Commands

```bash
# Di MikroTik - Monitor RADIUS
/radius incoming print
/log print where topics~"radius"

# Di RADIUS Server - Monitor logs
tail -f logs/auth.log
tail -f logs/server.log

# Check active PPPoE sessions
/ppp active print
```

## 📖 Quick Reference

| Item | Deskripsi | Contoh |
|------|-----------|---------|
| NAS Name | IP MikroTik yang kirim request | 192.168.1.1 |
| RADIUS Server | IP server Node.js | 192.168.1.100 |
| Secret | Password autentikasi | rahasia123 |
| Auth Port | Port autentikasi | 1812 |
| Accounting Port | Port accounting | 1813 |

---

**💡 Tips:** Selalu gunakan IP yang stabil dan bisa diakses mutual antara MikroTik dan RADIUS Server!
