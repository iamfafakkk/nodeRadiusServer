# ================================
# TROUBLESHOOTING PPPoE CONNECTION
# ================================
# Untuk mengatasi masalah PPPoE tidak connect meskipun authentication berhasil

# STEP 1: Cek status PPPoE server
/interface pppoe-server server print detail

# STEP 2: Cek PPP profile detail
/ppp profile print detail where name="pppoe-radius"

# STEP 3: Cek IP pool tersedia
/ip pool print detail where name="pppoe-pool"

# STEP 4: Cek active PPP sessions
/ppp active print detail

# STEP 5: Cek secret yang terdaftar (backup)
/ppp secret print

# STEP 6: Test manual dengan local user (backup)
/ppp secret
add name=testlocal password=testlocal service=pppoe profile=pppoe-radius

# ================================
# COMMON ISSUES & SOLUTIONS:
# ================================

# Issue 1: Interface tidak ada atau salah
# Solution: Cek interface yang tersedia dan pastikan ada
/interface print where type="ethernet"
# Ganti interface di PPPoE server ke yang benar, misal:
/interface pppoe-server server set [find] interface=bridge1

# Issue 2: IP pool habis atau tidak valid
# Solution: Extend pool atau buat pool baru
/ip pool set [find name="pppoe-pool"] ranges=172.16.4.50-172.16.4.100

# Issue 3: Local address conflict
# Solution: Pastikan local-address tidak conflict
/ppp profile set [find name="pppoe-radius"] local-address=172.16.4.1

# Issue 4: DNS tidak diset
# Solution: Set DNS di profile
/ppp profile set [find name="pppoe-radius"] dns-server=8.8.8.8,8.8.4.4

# Issue 5: MTU/MSS issues
# Solution: Adjust MTU
/ppp profile set [find name="pppoe-radius"] change-tcp-mss=yes

# ================================
# DEBUGGING COMMANDS:
# ================================

# Enable detail logging
/system logging
add topics=ppp,info,debug action=memory
add topics=radius,info,debug action=memory

# Monitor logs real-time
/log print follow where topics~"ppp|radius"

# Clear old logs
/log print
# /log remove [find message~"old_pattern"]

# ================================
# MANUAL TEST STEPS:
# ================================

# 1. Test dengan user local dulu (bypass RADIUS)
/ppp secret add name=localtest password=localtest service=pppoe

# 2. Connect dari client ke localtest
# 3. Jika berhasil, masalah di RADIUS response
# 4. Jika gagal, masalah di PPPoE server config

# ================================
# RADIUS RESPONSE ATTRIBUTES:
# ================================
# Pastikan RADIUS server mengirim attribute yang benar:
# - Framed-IP-Address (optional, bisa dari pool)
# - Framed-IP-Netmask (optional)
# - Session-Timeout (optional)

# ================================
# NETWORK REQUIREMENTS:
# ================================
# 1. Interface yang digunakan PPPoE server harus UP
# 2. IP pool harus valid dan available
# 3. Routing harus benar untuk subnet client
# 4. Firewall tidak boleh block PPPoE traffic

# ================================
# EXPECTED FLOW:
# ================================
# 1. Client kirim PPPoE Discovery
# 2. MikroTik respond dengan PPPoE Offer
# 3. Client request authentication
# 4. MikroTik forward ke RADIUS (✓ sudah berhasil)
# 5. RADIUS accept (✓ sudah berhasil)
# 6. MikroTik assign IP dari pool
# 7. PPPoE session established
# 8. Accounting START sent ke RADIUS

# ================================
# QUICK FIX COMMANDS:
# ================================

# Reset PPPoE server
/interface pppoe-server server disable [find]
/interface pppoe-server server enable [find]

# Check interface status
/interface print stats where name~"bridge1|ether"

# Force pool refresh
/ip pool print where name="pppoe-pool"

# Check system resources
/system resource print
