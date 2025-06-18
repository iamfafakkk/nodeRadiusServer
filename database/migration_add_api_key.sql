-- Migration script untuk menambahkan kolom api_key ke tabel admin_users
-- Jalankan script ini pada database yang sudah ada

-- Cek apakah kolom api_key sudah ada
SET @exist := (SELECT COUNT(*) FROM information_schema.COLUMNS 
    WHERE TABLE_NAME = 'admin_users' 
    AND COLUMN_NAME = 'api_key' 
    AND TABLE_SCHEMA = DATABASE());

-- Tambahkan kolom api_key jika belum ada
SET @sql = IF(@exist = 0, 
    'ALTER TABLE admin_users ADD COLUMN api_key varchar(64) DEFAULT NULL UNIQUE AFTER password',
    'SELECT "Column api_key already exists" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verifikasi hasil
SELECT 'Migration completed successfully' as status;
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
FROM information_schema.COLUMNS 
WHERE TABLE_NAME = 'admin_users' 
AND TABLE_SCHEMA = DATABASE()
ORDER BY ORDINAL_POSITION;
