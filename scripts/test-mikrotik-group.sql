-- Script untuk testing konfigurasi Mikrotik-Group VSA
-- Jalankan script ini untuk membuat test users dengan berbagai PPP profiles

USE radius;

-- Hapus test users yang mungkin sudah ada
DELETE FROM radcheck WHERE username LIKE 'test_%';
DELETE FROM radreply WHERE username LIKE 'test_%';
DELETE FROM radusergroup WHERE username LIKE 'test_%';

-- Test User 1: VIP Profile
INSERT INTO radcheck (username, attribute, op, value) VALUES 
('test_vip', 'Cleartext-Password', ':=', 'password123');

INSERT INTO radreply (username, attribute, op, value) VALUES 
('test_vip', 'Mikrotik-Group', ':=', 'vip'),
('test_vip', 'Filter-Id', ':=', 'vip'),
('test_vip', 'Service-Type', ':=', 'Framed-User'),
('test_vip', 'Framed-Protocol', ':=', 'PPP');

-- Test User 2: Regular Profile
INSERT INTO radcheck (username, attribute, op, value) VALUES 
('test_reguler', 'Cleartext-Password', ':=', 'password456');

INSERT INTO radreply (username, attribute, op, value) VALUES 
('test_reguler', 'Mikrotik-Group', ':=', 'reguler'),
('test_reguler', 'Filter-Id', ':=', 'reguler'),
('test_reguler', 'Service-Type', ':=', 'Framed-User'),
('test_reguler', 'Framed-Protocol', ':=', 'PPP');

-- Test User 3: Default Profile
INSERT INTO radcheck (username, attribute, op, value) VALUES 
('test_default', 'Cleartext-Password', ':=', 'password789');

INSERT INTO radreply (username, attribute, op, value) VALUES 
('test_default', 'Mikrotik-Group', ':=', 'default'),
('test_default', 'Filter-Id', ':=', 'default'),
('test_default', 'Service-Type', ':=', 'Framed-User'),
('test_default', 'Framed-Protocol', ':=', 'PPP');

-- Test User 4: Legacy user (hanya Filter-Id)
INSERT INTO radcheck (username, attribute, op, value) VALUES 
('test_legacy', 'Cleartext-Password', ':=', 'password000');

INSERT INTO radreply (username, attribute, op, value) VALUES 
('test_legacy', 'Filter-Id', ':=', 'legacy'),
('test_legacy', 'Service-Type', ':=', 'Framed-User'),
('test_legacy', 'Framed-Protocol', ':=', 'PPP');

-- Verify test users
SELECT 'Test Users Created' as status;

SELECT 
    rc.username,
    rc.attribute as check_attr,
    rc.value as check_value
FROM radcheck rc 
WHERE rc.username LIKE 'test_%' 
ORDER BY rc.username;

SELECT 
    rr.username,
    rr.attribute as reply_attr,
    rr.value as reply_value
FROM radreply rr 
WHERE rr.username LIKE 'test_%' 
ORDER BY rr.username, rr.attribute;

-- Query untuk testing
SELECT 'Test Queries for Verification' as info;

-- Cek user dengan Mikrotik-Group
SELECT 
    rc.username,
    rc.value as password,
    rr.value as mikrotik_group
FROM radcheck rc
JOIN radreply rr ON rc.username = rr.username
WHERE rc.attribute = 'Cleartext-Password'
  AND rr.attribute = 'Mikrotik-Group'
  AND rc.username LIKE 'test_%';

-- Cek user dengan Filter-Id saja
SELECT 
    rc.username,
    rc.value as password,
    rr.value as filter_id
FROM radcheck rc
JOIN radreply rr ON rc.username = rr.username
WHERE rc.attribute = 'Cleartext-Password'
  AND rr.attribute = 'Filter-Id'
  AND rc.username = 'test_legacy';

COMMIT; 