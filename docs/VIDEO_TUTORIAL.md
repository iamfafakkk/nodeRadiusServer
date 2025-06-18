# 🎥 VIDEO TUTORIAL: Setup MikroTik dengan RADIUS Server Node.js

## 📺 Daftar Isi Tutorial

### Part 1: Persiapan (5 menit)
- [00:00] Intro dan overview sistem
- [01:00] Check RADIUS server running
- [02:00] Check database connection
- [03:00] Test API endpoints
- [04:00] Review default users

### Part 2: Konfigurasi MikroTik (10 menit)
- [05:00] Login ke MikroTik via Winbox
- [06:00] Setup RADIUS client
- [07:00] Create IP pool
- [08:00] Create PPP profile
- [09:00] Setup PPPoE server
- [10:00] Enable PPP AAA
- [11:00] Configure firewall (jika perlu)
- [12:00] Enable logging
- [13:00] Save configuration
- [14:00] Test connectivity

### Part 3: Testing (8 menit)
- [15:00] Create test users via API
- [16:00] Test PPPoE client connection
- [17:00] Monitor active connections
- [18:00] Check RADIUS logs
- [19:00] Test different user groups
- [20:00] Troubleshooting common issues
- [21:00] Performance monitoring
- [22:00] Best practices

---

## 📋 Step-by-Step Tutorial Script

### PART 1: PERSIAPAN

#### Step 1.1: Start RADIUS Server
```bash
# Terminal 1: Start server
cd /Users/imf/Desktop/NODEJS/nodeRadiusServer
npm start

# Server akan running di:
# - RADIUS: Port 1812/1813
# - API: Port 3000
```

#### Step 1.2: Test API
```bash
# Terminal 2: Test API
curl http://localhost:3000/health
curl http://localhost:3000/api/users
```

#### Step 1.3: Default Users
- Username: `testuser`, Password: `testpass`
- Username: `admin`, Password: `admin123`  
- Username: `user1`, Password: `password1`

---

### PART 2: KONFIGURASI MIKROTIK

#### Step 2.1: Login MikroTik
1. Buka **Winbox**
2. Connect ke MikroTik router
3. Login dengan admin credentials

#### Step 2.2: RADIUS Client Setup
1. **System → Users → RADIUS**
2. Klik **[+]** untuk add new
3. Settings:
   - **Address**: `192.168.90.6` (IP RADIUS server)
   - **Secret**: `testing123`
   - **Service**: `ppp`
   - **Auth Port**: `1812`
   - **Acct Port**: `1813`
   - **Timeout**: `3`
   - **Accounting**: ✅ Enable

#### Step 2.3: IP Pool
1. **IP → Pool**
2. Klik **[+]**
3. Settings:
   - **Name**: `pppoe-pool`
   - **Addresses**: `192.168.100.10-192.168.100.100`

#### Step 2.4: PPP Profile
1. **PPP → Profiles**
2. Klik **[+]**
3. **General Tab**:
   - **Name**: `pppoe-radius`
   - **Local Address**: `192.168.100.1`
   - **Remote Address**: `pppoe-pool`
   - **Use Encryption**: ✅
4. **Networking Tab**:
   - **DNS Server**: `8.8.8.8,8.8.4.4`
   - **Change TCP MSS**: ✅

#### Step 2.5: PPPoE Server
1. **PPP → PPPoE Servers**
2. Klik **[+]**
3. Settings:
   - **Service Name**: `internet`
   - **Interface**: `ether2` (pilih interface LAN)
   - **Max MTU**: `1480`
   - **Max MRU**: `1480`
   - **Authentication**: `pap,chap`
   - **Keepalive Timeout**: `60`
   - **Default Profile**: `pppoe-radius`

#### Step 2.6: PPP AAA
1. **PPP → AAA**
2. Enable:
   - ✅ **Use RADIUS**
   - ✅ **Accounting**

#### Step 2.7: Logging (Optional)
1. **System → Logging**
2. Add new rule:
   - **Topics**: `radius,debug`
   - **Action**: `memory`

---

### PART 3: TESTING

#### Step 3.1: Create Test User
```bash
# Via API
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "username": "mt_test1",
    "password": "test123",
    "groupname": "default"
  }'
```

#### Step 3.2: Test PPPoE Client

**Windows Client:**
1. **Control Panel → Network → Create Connection**
2. **Connect to Internet → Broadband (PPPoE)**
3. Settings:
   - **Username**: `mt_test1`
   - **Password**: `test123`
   - **Connection Name**: `Test PPPoE`

**Linux Client:**
```bash
sudo pppoeconf
# Follow wizard, enter username/password
```

#### Step 3.3: Monitor di MikroTik

**Terminal Commands:**
```bash
# Lihat koneksi aktif
/ppp active print

# Monitor RADIUS
/radius incoming print

# Lihat logs
/log print where topics~"radius"

# Monitor interface
/interface monitor pppoe-out1
```

**Winbox Monitoring:**
1. **PPP → Active** - Lihat koneksi aktif
2. **System → Logging** - Lihat RADIUS logs
3. **Tools → Torch** - Monitor traffic

#### Step 3.4: Test Different Scenarios

1. **Valid User**: Login dengan `testuser/testpass`
2. **Invalid User**: Login dengan wrong credentials
3. **Premium User**: Test bandwidth difference
4. **Multiple Sessions**: Test concurrent connections

---

## 🚨 Common Issues & Solutions

### Issue 1: Authentication Failed
**Symptoms**: PPPoE client can't connect
**Check**:
```bash
# MikroTik
/log print where topics~"radius"
/radius print detail

# RADIUS Server  
tail -f logs/auth.log
curl http://localhost:3000/api/users/testuser
```

**Solutions**:
- Verify user exists in database
- Check RADIUS server IP/secret
- Test network connectivity

### Issue 2: Can't Reach RADIUS Server
**Symptoms**: No RADIUS traffic
**Check**:
```bash
# Test connectivity
/ping 192.168.90.6

# Test ports (dari komputer lain)
nc -u -v 192.168.90.6 1812
nc -u -v 192.168.90.6 1813
```

**Solutions**:
- Check firewall rules
- Verify server is listening
- Test network routing

### Issue 3: PPPoE Server Not Responding
**Symptoms**: Client can't discover PPPoE server
**Check**:
```bash
# MikroTik
/interface pppoe-server server print
/interface print where type="ether"
```

**Solutions**:
- Check interface configuration
- Verify service name
- Check physical connection

---

## 📊 Performance Monitoring

### Real-time Monitoring Commands

```bash
# MikroTik
/ppp active print interval=1
/interface monitor ether2 interval=1
/system resource print interval=1

# RADIUS Server
tail -f logs/auth.log
pm2 monit
```

### Key Metrics to Watch
- **Connection success rate**
- **Response time**
- **Concurrent sessions**
- **Memory usage**
- **CPU utilization**

---

## 💡 Production Tips

1. **Backup Configuration**:
   ```bash
   /export file=production-config-$(date +%Y%m%d)
   ```

2. **Regular Database Maintenance**:
   ```sql
   -- Cleanup old accounting records
   DELETE FROM radacct WHERE acctstarttime < DATE_SUB(NOW(), INTERVAL 3 MONTH);
   ```

3. **Log Rotation**:
   ```bash
   # Setup logrotate for RADIUS logs
   sudo nano /etc/logrotate.d/radius
   ```

4. **Monitor Disk Space**:
   ```bash
   df -h
   du -sh logs/
   ```

5. **Security**:
   - Change default RADIUS secret
   - Use strong passwords
   - Regular security updates
   - Monitor failed authentication attempts

---

## 🔚 Tutorial Summary

✅ **Completed Setup**:
- RADIUS Server running
- MikroTik configured
- PPPoE server active
- Users authenticated
- Monitoring enabled

✅ **Key Learning Points**:
- RADIUS protocol basics
- MikroTik PPPoE configuration
- Troubleshooting techniques
- Performance monitoring
- Security best practices

✅ **Next Steps**:
- Production deployment
- Advanced features
- Integration with billing system
- High availability setup
- Custom user management portal

---

**🎯 End of Tutorial - Happy Networking! 🚀**
