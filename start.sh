#!/bin/bash

# RADIUS Server Management UI Startup Script

echo "🚀 Starting RADIUS Server Management..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  File .env tidak ditemukan!"
    echo "📝 Membuat file .env dari template..."
    cp .env.example .env
    echo "✅ File .env berhasil dibuat"
    echo ""
    echo "🔧 PENTING: Edit file .env dan sesuaikan konfigurasi database Anda!"
    echo "   - DB_HOST (default: localhost)"
    echo "   - DB_USER (default: root)" 
    echo "   - DB_PASSWORD (masukkan password MySQL Anda)"
    echo "   - DB_NAME (default: radius)"
    echo ""
    echo "📖 Setelah mengedit .env, jalankan kembali script ini dengan:"
    echo "   ./start.sh"
    exit 1
fi

# Check if database setup.sql has been run
echo "🔍 Checking database setup..."

# Start the server
echo "🌐 Starting server..."
npm start
