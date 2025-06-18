# ================================
# FINAL MIKROTIK CONFIGURATION
# ================================
# Berdasarkan log RADIUS yang berhasil diterima

# 1. UPDATE RADIUS CLIENT (perbaiki secret)
/radius
remove [find]
add address=172.16.4.205 secret=testing123 service=ppp timeout=3s accounting=yes

# 2. Verifikasi konfigurasi saat ini
/radius print detail

# 3. Test koneksi
/ping 172.16.4.205 count=3

# 4. Manual test user (tambah sementara untuk testing)
/ppp secret
add name=testuser password=testpass service=pppoe profile=pppoe-radius

# 5. Lihat status
/ppp active print
/log print where topics~"radius"

# ================================
# USERS YANG BISA DITEST:
# ================================
# testuser / testpass (group: default)
# mikrotik_user1 / mt123 (group: default)  
# simple_user / simple123 (group: default)
# admin / admin123 (group: unlimited)

# ================================
# TROUBLESHOOTING:
# ================================
# Jika masih gagal, coba:
/ppp aaa print
/ppp profile print where name="pppoe-radius"
/interface pppoe-server server print
