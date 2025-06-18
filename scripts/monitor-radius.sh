#!/bin/bash

# ================================
# RADIUS SERVER MONITORING SCRIPT
# ================================

echo "=== RADIUS SERVER STATUS ==="
echo "Current time: $(date)"
echo

# Check if server is running
echo "1. Checking server process..."
ps aux | grep node | grep index.js || echo "❌ Server not running"
echo

# Check ports
echo "2. Checking RADIUS ports..."
netstat -un | grep 1812 && echo "✅ Port 1812 (auth) listening" || echo "❌ Port 1812 not listening"
netstat -un | grep 1813 && echo "✅ Port 1813 (acct) listening" || echo "❌ Port 1813 not listening"
echo

# Check database connection
echo "3. Testing database connection..."
node -e "
const db = require('./config/database');
db.pool.execute('SELECT COUNT(*) as count FROM radcheck')
  .then(([rows]) => console.log('✅ Database OK - Users in radcheck:', rows[0].count))
  .catch(err => console.log('❌ Database error:', err.message))
  .finally(() => process.exit());
" 2>/dev/null
echo

# Check recent logs
echo "4. Recent authentication logs (last 10)..."
tail -n 10 logs/server.log | grep -i "auth" || echo "No recent auth logs"
echo

# Check accounting logs
echo "5. Recent accounting logs (last 10)..."
tail -n 10 logs/server.log | grep -i "account" || echo "No recent accounting logs"
echo

# Check radacct table
echo "6. Active sessions in radacct..."
node -e "
const db = require('./config/database');
db.pool.execute('SELECT username, acctsessionid, acctstarttime, acctstoptime FROM radacct WHERE acctstoptime IS NULL ORDER BY acctstarttime DESC LIMIT 5')
  .then(([rows]) => {
    if (rows.length > 0) {
      console.log('Active sessions:');
      rows.forEach(row => console.log(\`- \${row.username} (session: \${row.acctsessionid}) started: \${row.acctstarttime}\`));
    } else {
      console.log('❌ No active sessions found');
    }
  })
  .catch(err => console.log('❌ Database error:', err.message))
  .finally(() => process.exit());
" 2>/dev/null
echo

# Check NAS configuration
echo "7. NAS configuration..."
node -e "
const db = require('./config/database');
db.pool.execute('SELECT nasname, secret, shortname FROM nas')
  .then(([rows]) => {
    console.log('Configured NAS:');
    rows.forEach(row => console.log(\`- \${row.nasname} (\${row.shortname}) secret: \${row.secret}\`));
  })
  .catch(err => console.log('❌ Database error:', err.message))
  .finally(() => process.exit());
" 2>/dev/null
echo

echo "=== MONITORING COMPLETE ==="
echo
echo "To monitor real-time:"
echo "  tail -f logs/server.log"
echo
echo "To test authentication:"
echo "  Try connecting PPPoE client with user: radius, password: radius"
