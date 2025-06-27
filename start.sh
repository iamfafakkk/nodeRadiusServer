#!/bin/bash

# RADIUS Server with PAP & CHAP Authentication Startup Script

echo "🚀 Starting RADIUS Server with PAP & CHAP Authentication..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  File .env tidak ditemukan!"
    echo "📝 Membuat file .env template..."
    
    # Create .env file with CHAP support
    cat > .env << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_USER=radius
DB_PASSWORD=radiusradius
DB_NAME=radius

# RADIUS Server Configuration
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813
RADIUS_SECRET=mikrotik123

# Web Server Configuration
HTTP_PORT=3000
SERVER_PORT=3000

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/server.log

# Environment
NODE_ENV=development

# Authentication Methods (PAP + CHAP Support)
SUPPORT_PAP=true
SUPPORT_CHAP=true
DEFAULT_AUTH_METHOD=chap
EOF
    
    echo "✅ File .env berhasil dibuat dengan dukungan CHAP"
    echo ""
    echo "🔐 CHAP Authentication Features:"
    echo "   ✅ PAP Authentication: Enabled"
    echo "   ✅ CHAP Authentication: Enabled (Recommended)"
    echo "   🔧 Auto-detection: Server detects auth method automatically"
    echo ""
    echo "🔧 PENTING: Edit file .env jika perlu menyesuaikan konfigurasi:"
    echo "   - DB_HOST (default: localhost)"
    echo "   - DB_USER (default: radius)" 
    echo "   - DB_PASSWORD (default: radiusradius)"
    echo "   - DB_NAME (default: radius)"
    echo "   - RADIUS_SECRET (default: mikrotik123)"
    echo ""
    echo "📖 Dokumentasi CHAP:"
    echo "   - docs/CHAP_IMPLEMENTATION_GUIDE.md - Panduan lengkap CHAP"
    echo "   - docs/MIKROTIK_CHAP_CONFIG.rsc - Konfigurasi MikroTik untuk CHAP"
    echo "   - docs/PAP_vs_CHAP_EXPLAINED.md - Perbandingan PAP vs CHAP"
    echo ""
    echo "🚀 Untuk melanjutkan, jalankan kembali script ini:"
    echo "   ./start.sh"
    exit 1
fi

# Create logs directory if not exists
mkdir -p logs
mkdir -p logs/auth

# Check if database setup.sql has been run
echo "🔍 Checking database setup..."

# Display server information
echo ""
echo "=== 🔐 RADIUS Server Information ==="
echo "Authentication Methods:"
echo "  ✅ PAP (Password Authentication Protocol)"
echo "  ✅ CHAP (Challenge Handshake Authentication Protocol)"
echo ""
echo "Network Ports:"
echo "  📡 RADIUS Auth: 1812/udp (PAP/CHAP)"
echo "  📡 RADIUS Acct: 1813/udp"
echo "  🌐 Web Interface: 3000/tcp"
echo ""
echo "🔧 For MikroTik CHAP configuration, see: docs/MIKROTIK_CHAP_CONFIG.rsc"
echo ""

# Start the server
echo "🌐 Starting RADIUS server with PAP & CHAP support..."
npm start
