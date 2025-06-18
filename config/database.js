const mysql = require('mysql2');
require('dotenv').config();

// Konfigurasi database MySQL
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'radius',
  password: process.env.DB_PASSWORD || 'radiusradius',
  database: process.env.DB_NAME || 'radius',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

// Membuat connection pool
const pool = mysql.createPool(dbConfig);

// Menggunakan promise untuk query
const promisePool = pool.promise();

// Test koneksi database
async function testConnection() {
  try {
    const connection = await promisePool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

module.exports = {
  pool: promisePool,
  testConnection
};
