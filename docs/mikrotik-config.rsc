# Konfigurasi MikroTik untuk RADIUS Server
# =======================================

# 1. SETUP RADIUS CLIENT
# Ganti IP_RADIUS_SERVER dengan IP server Node.js RADIUS Anda
/radius
add address=IP_RADIUS_SERVER secret=testing123 service=ppp timeout=3s

# 2. BUAT IP POOL UNTUK CLIENT
/ip pool
add name="pppoe-pool" ranges=192.168.100.10-192.168.100.100

# 3. BUAT PPP PROFILE
/ppp profile
add name="pppoe-radius" \
    local-address=192.168.100.1 \
    remote-address=pppoe-pool \
    use-encryption=yes \
    dns-server=8.8.8.8,8.8.4.4 \
    change-tcp-mss=yes

# 4. SETUP PPPOE SERVER
/interface pppoe-server server
add service-name="internet" \
    interface=ether2 \
    default-profile=pppoe-radius \
    authentication=pap,chap \
    keepalive-timeout=60

# 5. ENABLE RADIUS ACCOUNTING (OPSIONAL)
/radius
set [find] accounting=yes

# 6. FIREWALL RULES (JIKA DIPERLUKAN)
# Pastikan port 1812 (auth) dan 1813 (accounting) terbuka
/ip firewall filter
add chain=input protocol=udp dst-port=1812 action=accept comment="RADIUS Auth"
add chain=input protocol=udp dst-port=1813 action=accept comment="RADIUS Accounting"

# 7. MONITORING COMMANDS
# Untuk monitoring koneksi PPPoE:
/ppp active print
/ppp secret print

# Untuk test RADIUS:
/radius incoming print

# TROUBLESHOOTING:
# 1. Jika authentication gagal, cek:
#    - IP address RADIUS server benar
#    - Secret key cocok dengan database
#    - Port 1812/1813 tidak diblock firewall
#    - User credentials ada di database

# 2. Untuk debug, enable logging:
/system logging
add topics=radius,debug action=memory

# 3. Lihat log:
/log print where topics~"radius"

# CONTOH TESTING DARI MIKROTIK:
# Untuk test koneksi ke RADIUS server manual:
# /tool netwatch add host=IP_RADIUS_SERVER interval=30s

# BACKUP KONFIGURASI:
# /export file=backup-radius-config
