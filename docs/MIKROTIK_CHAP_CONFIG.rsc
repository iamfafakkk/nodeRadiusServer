# ================================
# MIKROTIK CHAP AUTHENTICATION CONFIG
# ================================
# Konfigurasi untuk menggunakan CHAP authentication di MikroTik

# 1. Update RADIUS client (pastikan secret benar)
/radius
remove [find]
add address=172.16.4.205 secret=mikrotik123 service=ppp timeout=3s accounting=yes

# 2. Konfigurasi PPP Profile untuk CHAP
/ppp profile
set [find name="pppoe-radius"] authentication=chap,mschap1,mschap2 change-tcp-mss=yes dns-server=8.8.8.8,8.8.4.4 only-one=yes use-mpls=default use-compression=default use-encryption=default use-vj-compression=default

# 3. Pastikan AAA menggunakan RADIUS
/ppp aaa
set accounting=yes interim-update=0s use-radius=yes

# 4. Konfigurasi PPPoE Server
/interface pppoe-server server
set [find interface="bridge1"] authentication=chap,mschap1,mschap2 default-profile=pppoe-radius keepalive-timeout=60 max-mru=1480 max-mtu=1480 mrru=disabled one-session-per-host=yes service-name=JPW-2099

# 5. Verifikasi konfigurasi
/radius print detail
/ppp profile print detail where name="pppoe-radius"
/ppp aaa print
/interface pppoe-server server print detail

# 6. Test koneksi RADIUS
/ping 172.16.4.205 count=3

# ================================
# PENJELASAN CHAP:
# ================================
# CHAP (Challenge Handshake Authentication Protocol):
# - Lebih aman dari PAP
# - Password tidak pernah dikirim dalam bentuk plain text
# - Menggunakan challenge-response mechanism
# - Server mengirim challenge, client menghitung MD5 hash

# ================================
# TROUBLESHOOTING:
# ================================
# Jika CHAP gagal, cek log dengan:
/log print where topics~"radius"
/log print where topics~"ppp"

# Untuk debugging, bisa enable logging:
/system logging
add topics=radius,debug action=memory
add topics=ppp,debug action=memory

# ================================
# FALLBACK KE PAP (jika diperlukan):
# ================================
# Jika CHAP bermasalah, bisa fallback ke PAP:
# /ppp profile
# set [find name="pppoe-radius"] authentication=pap,chap,mschap1,mschap2

# /interface pppoe-server server
# set [find interface="bridge1"] authentication=pap,chap,mschap1,mschap2

# ================================
# TESTING:
# ================================
# 1. Restart PPPoE server setelah perubahan:
/interface pppoe-server server disable [find]
/interface pppoe-server server enable [find]

# 2. Test dengan client PPPoE
# Username: radius
# Password: radius

# 3. Monitor log real-time:
/log print follow where topics~"radius,ppp" 