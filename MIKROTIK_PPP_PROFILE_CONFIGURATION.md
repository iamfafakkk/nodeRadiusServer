# Konfigurasi PPP Profile Mikrotik menggunakan RADIUS

## Gambaran Umum

Dokumen ini menjelaskan cara mengkonfigurasi RADIUS server agar user pada tabel `radcheck` menggunakan PPP profile Mikrotik yang ditentukan dari attribute `Mikrotik-Group` pada `radreply` saat login.

## Alur Kerja

```
User Login → RADIUS Auth → Mikrotik-Group VSA → PPP Profile Assignment
```

1. **User login** ke RADIUS via PPP (misalnya PPPoE)
2. **Mikrotik** mengirim Access-Request ke RADIUS server
3. **RADIUS server** memvalidasi user dan mengirim Access-Accept dengan **Mikrotik-Group VSA**
4. **Mikrotik** menerima response dan menerapkan PPP profile sesuai nilai Mikrotik-Group

## Implementasi

### 1. Vendor Specific Attributes (VSA)

Server sekarang mendukung Mikrotik VSA dengan:
- **Vendor-ID**: 14988 (Mikrotik)
- **Attribute Type 3**: Mikrotik-Group (untuk PPP profile assignment)

### 2. Database Configuration

#### Tabel radreply - Menambahkan Mikrotik-Group

```sql
-- Contoh: User 'testuser' menggunakan PPP profile 'vip'
INSERT INTO radreply (username, attribute, op, value) VALUES 
('testuser', 'Mikrotik-Group', ':=', 'vip');

-- Backward compatibility: juga menambahkan Filter-Id
INSERT INTO radreply (username, attribute, op, value) VALUES 
('testuser', 'Filter-Id', ':=', 'vip');
```

#### Contoh Konfigurasi User

```sql
-- User dengan profile VIP
INSERT INTO radcheck (username, attribute, op, value) VALUES 
('user_vip', 'Cleartext-Password', ':=', 'password123');

INSERT INTO radreply (username, attribute, op, value) VALUES 
('user_vip', 'Mikrotik-Group', ':=', 'vip'),
('user_vip', 'Filter-Id', ':=', 'vip'),
('user_vip', 'Service-Type', ':=', 'Framed-User'),
('user_vip', 'Framed-Protocol', ':=', 'PPP');

-- User dengan profile reguler
INSERT INTO radcheck (username, attribute, op, value) VALUES 
('user_reguler', 'Cleartext-Password', ':=', 'password456');

INSERT INTO radreply (username, attribute, op, value) VALUES 
('user_reguler', 'Mikrotik-Group', ':=', 'reguler'),
('user_reguler', 'Filter-Id', ':=', 'reguler'),
('user_reguler', 'Service-Type', ':=', 'Framed-User'),
('user_reguler', 'Framed-Protocol', ':=', 'PPP');
```

### 3. Konfigurasi Mikrotik

#### A. Konfigurasi PPP Profiles

```routeros
# Buat PPP profiles yang sesuai dengan Mikrotik-Group values
/ppp profile
add name=vip \
    local-address=10.0.0.1 \
    remote-address=ppp-pool-vip \
    use-compression=no \
    use-encryption=no \
    only-one=yes \
    rate-limit=100M/100M \
    comment="VIP users profile"

add name=reguler \
    local-address=10.0.0.1 \
    remote-address=ppp-pool-reguler \
    use-compression=no \
    use-encryption=no \
    only-one=yes \
    rate-limit=10M/10M \
    comment="Regular users profile"

add name=default \
    local-address=10.0.0.1 \
    remote-address=ppp-pool-default \
    use-compression=no \
    use-encryption=no \
    only-one=yes \
    rate-limit=5M/5M \
    comment="Default users profile"
```

#### B. Konfigurasi IP Pools

```routeros
# IP pools untuk setiap profile
/ip pool
add name=ppp-pool-vip ranges=10.10.1.10-10.10.1.100 comment="VIP users pool"
add name=ppp-pool-reguler ranges=10.10.2.10-10.10.2.100 comment="Regular users pool"
add name=ppp-pool-default ranges=10.10.3.10-10.10.3.100 comment="Default users pool"
```

#### C. Konfigurasi RADIUS Client

```routeros
# Konfigurasi RADIUS client di Mikrotik
/radius
add address=YOUR_RADIUS_SERVER_IP \
    secret=mikrotik123 \
    service=ppp \
    src-address=YOUR_MIKROTIK_IP \
    comment="Main RADIUS server"

# Aktifkan RADIUS di AAA
/radius incoming
set accept=yes

# Konfigurasi AAA untuk menggunakan RADIUS
/ppp aaa
set accounting=yes \
    interim-update=5m \
    use-radius=yes
```

#### D. Konfigurasi PPPoE Server

```routeros
# Konfigurasi PPPoE server
/interface pppoe-server server
add authentication=pap,chap \
    default-profile=default \
    interface=ether2 \
    service-name=internet \
    disabled=no \
    comment="PPPoE server for internet access"
```

### 4. Testing

#### A. Test User Login

```bash
# Cek log RADIUS server
tail -f logs/server.log | grep "Mikrotik-Group"

# Expected output saat user login:
# Added Mikrotik-Group VSA: vip for user user_vip
```

#### B. Verify di Mikrotik

```routeros
# Cek active PPP sessions
/ppp active print

# Cek apakah profile yang benar digunakan
/ppp active print detail where name="user_vip"
```

## Troubleshooting

### 1. Profile tidak diterapkan

**Problem**: User login berhasil tapi menggunakan default profile

**Solutions**:
- Pastikan PPP profile dengan nama yang sama dengan Mikrotik-Group value sudah dibuat
- Cek log RADIUS server untuk memastikan VSA dikirim
- Pastikan Mikrotik-Group attribute ada di tabel radreply

### 2. Authentication gagal

**Problem**: User tidak bisa login

**Solutions**:
- Cek kredensial di tabel radcheck
- Pastikan shared secret sama antara Mikrotik dan RADIUS server
- Cek koneksi network antara Mikrotik dan RADIUS server

### 3. VSA tidak diterima

**Problem**: Mikrotik tidak mengenali Mikrotik-Group VSA

**Solutions**:
- Pastikan RouterOS support Mikrotik VSA (v6.0+)
- Cek apakah VSA format benar (Vendor-ID: 14988)
- Update RouterOS ke versi terbaru

## Monitoring

### RADIUS Server Logs

```bash
# Monitor authentication dengan Mikrotik-Group
grep "Mikrotik-Group" logs/server.log

# Monitor semua VSA activities
grep "VSA" logs/server.log
```

### Mikrotik Logs

```routeros
# Enable PPP logging
/system logging
add action=memory topics=ppp,info

# View PPP logs
/log print where topics~"ppp"
```

## Backup Compatibility

Server tetap mengirim `Filter-Id` attribute untuk backward compatibility dengan router yang belum mendukung Mikrotik VSA:

- **Mikrotik-Group VSA**: Method modern dan direkomendasikan
- **Filter-Id**: Fallback untuk kompatibilitas

## Security Considerations

1. **Shared Secret**: Gunakan shared secret yang kuat
2. **Network**: Gunakan network terisolasi untuk komunikasi RADIUS
3. **Encryption**: Pertimbangkan IPSec untuk enkripsi komunikasi RADIUS
4. **Firewall**: Batas akses ke port RADIUS (1812/1813) hanya dari NAS yang valid

## Kesimpulan

Konfigurasi ini memungkinkan:
- ✅ Assignment PPP profile otomatis berdasarkan user
- ✅ Support modern Mikrotik VSA dan backward compatibility
- ✅ Manajemen terpusat via database
- ✅ Logging dan monitoring lengkap
- ✅ Skalabilitas untuk multiple profiles dan users 