# ================================
# MIKROTIK PPPoE + RADIUS FIX
# ================================
# Untuk mengatasi masalah PPPoE tidak connect dan accounting tidak jalan

# STEP 1: Pastikan RADIUS client dikonfigurasi dengan benar
/radius
remove [find]
add address=172.16.4.205 secret=testing123 service=ppp timeout=3s accounting=yes

# STEP 2: Aktifkan RADIUS di PPP AAA (INI YANG SERING TERLEWAT!)
/ppp aaa
set use-radius=yes accounting=yes

# STEP 3: Pastikan PPP profile benar
/ppp profile
set [find name="pppoe-radius"] use-compression=no use-encryption=yes

# STEP 4: Test koneksi ke RADIUS server
/tool netwatch
add host=172.16.4.205 interval=30s

# STEP 5: Enable debug logging untuk troubleshoot
/system logging
add topics=radius,debug action=memory
add topics=ppp,debug action=memory

# STEP 6: Cek status dan test
/radius print detail
/ppp aaa print
/ppp profile print where name="pppoe-radius"

# STEP 7: Manual test user (pastikan user ada di database RADIUS)
# Test dengan user: radius / password: radius

# ================================
# COMMANDS UNTUK MONITORING:
# ================================

# Lihat PPPoE active sessions:
/ppp active print

# Lihat RADIUS log:
/log print where topics~"radius"

# Lihat PPP log:
/log print where topics~"ppp"

# Test ping ke RADIUS server:
/ping 172.16.4.205 count=5

# ================================
# TROUBLESHOOTING CHECKLIST:
# ================================

# 1. RADIUS server berjalan di port 1812/1813? ✓
# 2. Secret sama antara MikroTik dan database? ✓ (testing123)
# 3. PPP AAA menggunakan RADIUS? HARUS DICHECK!
# 4. User ada di database radcheck? ✓
# 5. Firewall tidak blok port 1812/1813? 
# 6. Interface PPPoE server benar?

# ================================
# JIKA MASIH GAGAL, COBA RESET PPP:
# ================================
# /ppp secret print
# /ppp active print
# (jika ada session hanging, disconnect dulu)

# ================================
# EXPECTED HASIL:
# ================================
# - Authentication berhasil (sudah ✓)
# - Accounting START dikirim ke RADIUS server
# - PPPoE client dapat IP dari pool
# - Session tersimpan di radacct table
