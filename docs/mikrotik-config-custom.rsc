# ================================
# KONFIGURASI MIKROTIK - UNTUK SETUP ANDA
# ================================
# Database MySQL: 192.168.90.6
# Node.js RADIUS Server: 172.16.4.205  
# MikroTik NAS IP: 172.16.4.1

# 1. SETUP RADIUS CLIENT
/radius
add address=172.16.4.205 secret=testing123 service=ppp timeout=3s accounting=yes

# 2. BUAT IP POOL (sesuaikan dengan network Anda)
/ip pool
add name="pppoe-pool" ranges=172.16.4.50-172.16.4.100

# Alternative: Jika ingin menggunakan network terpisah
# /ip pool
# add name="pppoe-pool-alt" ranges=192.168.100.10-192.168.100.100

# 3. BUAT PPP PROFILE
/ppp profile
add name="pppoe-radius" \
    local-address=172.16.4.1 \
    remote-address=pppoe-pool \
    use-encryption=yes \
    dns-server=8.8.8.8,8.8.4.4 \
    change-tcp-mss=yes

# 4. SETUP PPPOE SERVER 
# Pilih interface yang tepat dari list Anda:
# - bridge1 (untuk network 172.16.4.x)
# - 5.ether4 (untuk network 172.16.6.x)
# - VLAN-DIAN (untuk network 192.168.6.x)

/interface pppoe-server server
add service-name="internet" \
    interface=bridge1 \
    default-profile=pppoe-radius \
    authentication=pap,chap \
    keepalive-timeout=60

# 5. ENABLE RADIUS UNTUK PPP
/ppp aaa
set use-radius=yes accounting=yes

# 6. FIREWALL (pastikan tidak memblok RADIUS traffic)
/ip firewall filter
add chain=input protocol=udp dst-port=1812 src-address=172.16.4.0/24 action=accept comment="RADIUS Auth"
add chain=input protocol=udp dst-port=1813 src-address=172.16.4.0/24 action=accept comment="RADIUS Accounting"

# 7. ENABLE LOGGING
/system logging
add topics=radius,debug action=memory

# ================================
# TESTING COMMANDS
# ================================

# Test koneksi ke RADIUS server
/ping 172.16.4.205 count=5

# Test resolusi nama (jika menggunakan hostname)
/ping 172.16.4.205

# Lihat interface aktif
/interface print stats

# Monitor bridge1
/interface monitor bridge1

# ================================
# TROUBLESHOOTING COMMANDS
# ================================

# Lihat status RADIUS
/radius print detail

# Lihat koneksi PPPoE aktif
/ppp active print

# Lihat log RADIUS
/log print where topics~"radius"

# Test dengan user default
# Username: testuser, Password: testpass

# ================================
# BACKUP & EXPORT
# ================================

# Backup konfigurasi
/export file=backup-radius-$(date +%Y%m%d)

# Export hanya konfigurasi RADIUS
/radius export file=radius-config
