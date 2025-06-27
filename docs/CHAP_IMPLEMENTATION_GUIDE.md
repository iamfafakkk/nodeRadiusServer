# ================================
# CHAP AUTHENTICATION IMPLEMENTATION GUIDE
# ================================

## 📋 Overview

Server RADIUS Node.js sekarang mendukung **CHAP (Challenge Handshake Authentication Protocol)** sebagai tambahan dari PAP authentication yang sudah ada.

## 🔐 Cara Kerja CHAP

### 1. Challenge-Response Flow:
```
1. Client → NAS: Request connection
2. NAS → RADIUS: Access-Request with CHAP-Password + CHAP-Challenge
3. RADIUS Server: 
   - Ambil stored password dari database
   - Hitung MD5(CHAP-ID + stored_password + challenge)
   - Bandingkan dengan received hash
4. RADIUS → NAS: Access-Accept/Reject
5. NAS → Client: Connection established/denied
```

### 2. CHAP Packet Structure:
```
CHAP-Password = [ID][16-byte MD5 hash]
- ID (1 byte): CHAP identifier
- Hash (16 bytes): MD5(ID + password + challenge)

CHAP-Challenge = [16-byte random challenge]
- Random bytes yang berubah setiap request
```

## 🛠️ Implementation Details

### Server Side (Node.js):

#### 1. Attributes Handling:
```javascript
// Attribute definitions
CHAP_PASSWORD: 3,      // [ID][MD5-Hash]
CHAP_CHALLENGE: 60,    // Challenge bytes

// Parsing in handleAuthRequest
const chapPassword = parsed.attributes[RadiusService.ATTRIBUTES.CHAP_PASSWORD];
const chapChallenge = parsed.attributes[RadiusService.ATTRIBUTES.CHAP_CHALLENGE];
```

#### 2. Authentication Logic:
```javascript
async authenticateUserCHAP(username, chapPassword, challenge) {
    // Get stored cleartext password
    const storedPassword = await getStoredPassword(username);
    
    // Extract CHAP ID and received hash
    const chapId = chapPassword[0];
    const receivedHash = chapPassword.slice(1);
    
    // Calculate expected hash
    const expectedHash = MD5(chapId + storedPassword + challenge);
    
    // Compare hashes
    return expectedHash.equals(receivedHash);
}
```

### Client Side (MikroTik):

#### 1. PPP Profile Configuration:
```
/ppp profile
set [find name="pppoe-radius"] authentication=chap,mschap1,mschap2
```

#### 2. PPPoE Server Configuration:
```
/interface pppoe-server server
set [find interface="bridge1"] authentication=chap,mschap1,mschap2
```

## 🚀 Upgrade Steps

### Step 1: Update MikroTik Configuration
```bash
# Copy konfigurasi CHAP ke MikroTik
/file upload

# Import konfigurasi
/import file-name=MIKROTIK_CHAP_CONFIG.rsc

# Verifikasi
/ppp profile print detail where name="pppoe-radius"
/interface pppoe-server server print detail
```

### Step 2: Restart RADIUS Server
```bash
# Restart server untuk load CHAP support
pm2 restart radius-server

# Atau manual restart
node index.js
```

### Step 3: Test Authentication
```bash
# Test user yang sudah ada
Username: radius
Password: radius

# Monitor logs
tail -f logs/auth.log
```

## 📊 Monitoring & Debugging

### 1. CHAP Authentication Logs:
```
[INFO] CHAP authentication attempt for user: radius
[DEBUG] CHAP ID: 123
[DEBUG] Received hash: a1b2c3d4e5f6...
[DEBUG] Challenge: f1e2d3c4b5a6...
[DEBUG] Expected hash: a1b2c3d4e5f6...
[INFO] CHAP authentication successful for user: radius
```

### 2. Troubleshooting Commands:

#### MikroTik:
```
# Monitor RADIUS traffic
/log print follow where topics~"radius"

# Check PPP sessions
/ppp active print

# Debug authentication
/system logging add topics=radius,debug action=memory
```

#### Server:
```bash
# Real-time logs
tail -f logs/auth.log | grep -i chap

# Check server status
curl http://localhost:3000/api/status
```

## 🔧 Hybrid Support (PAP + CHAP)

Server mendukung **kedua metode** secara bersamaan:

### Auto-Detection Logic:
```javascript
if (chapPassword) {
    // Use CHAP authentication
    isValid = await authenticateUserCHAP(username, chapPassword, challenge);
} else if (encryptedPassword) {
    // Use PAP authentication  
    isValid = await authenticateUser(username, decryptedPassword);
}
```

### Fallback Configuration:
```
# MikroTik: Support both methods
authentication=pap,chap,mschap1,mschap2

# Server akan detect otomatis method yang digunakan
```

## 🛡️ Security Benefits

### CHAP vs PAP:

| Aspect | PAP | CHAP |
|--------|-----|------|
| Password transmission | Plain text (encrypted) | Never transmitted |
| Replay protection | ❌ | ✅ |
| Challenge mechanism | ❌ | ✅ |
| Cryptographic strength | Basic | MD5 Hash |
| Security level | Low-Medium | Medium-High |

### Best Practices:

1. **Production**: Gunakan CHAP only
   ```
   authentication=chap,mschap1,mschap2
   ```

2. **Development**: Hybrid untuk flexibility
   ```
   authentication=pap,chap,mschap1,mschap2
   ```

3. **Database**: Pastikan password tersimpan sebagai cleartext
   ```sql
   INSERT INTO radcheck (username, attribute, value) 
   VALUES ('user', 'Cleartext-Password', 'password');
   ```

## 🧪 Testing Scenarios

### Test 1: CHAP Only
```bash
# MikroTik: Set CHAP only
/ppp profile set [find name="pppoe-radius"] authentication=chap

# Expected: CHAP authentication successful
```

### Test 2: PAP Fallback
```bash
# MikroTik: Set PAP first
/ppp profile set [find name="pppoe-radius"] authentication=pap,chap

# Expected: PAP authentication (first in list)
```

### Test 3: CHAP Priority
```bash
# MikroTik: Set CHAP first
/ppp profile set [find name="pppoe-radius"] authentication=chap,pap

# Expected: CHAP authentication (first in list)
```

## 📈 Performance Impact

### CHAP vs PAP Performance:

- **CHAP**: Sedikit lebih lambat karena MD5 calculation
- **PAP**: Lebih cepat karena simple comparison
- **Impact**: Minimal (< 1ms difference)

### Recommended Configuration:
```
# Production: CHAP only untuk security
authentication=chap

# High-traffic: Hybrid untuk compatibility
authentication=pap,chap
```

## 🔍 Troubleshooting Common Issues

### Issue 1: CHAP-Password Length Mismatch
```
Error: Invalid CHAP-Password format. Expected 17 bytes, got X
```
**Solution**: Check MikroTik CHAP implementation

### Issue 2: Challenge Not Found
```
Warning: No CHAP-Challenge attribute found, using Request Authenticator
```
**Solution**: Normal behavior, server menggunakan Request Authenticator sebagai challenge

### Issue 3: Hash Mismatch
```
Warning: CHAP authentication failed - hash mismatch
```
**Solution**: 
1. Verify stored password di database
2. Check CHAP ID dan challenge
3. Verify MD5 calculation

### Issue 4: User Not Found
```
Debug: User not found in database
```
**Solution**: Ensure user exists dengan Cleartext-Password attribute

---

## ✅ Status: CHAP Implementation Complete

✅ **Server**: Support PAP + CHAP authentication  
✅ **MikroTik**: Konfigurasi CHAP tersedia  
✅ **Database**: Compatible dengan Cleartext-Password  
✅ **Logging**: Detailed CHAP authentication logs  
✅ **Testing**: Ready untuk production testing  

**Server RADIUS sekarang siap untuk CHAP authentication!** 