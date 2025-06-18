-- Database setup untuk RADIUS Server
-- Jalankan script ini di MySQL server Anda

CREATE DATABASE IF NOT EXISTS radius;
USE radius;

-- Tabel untuk menyimpan NAS clients (MikroTik routers)
CREATE TABLE IF NOT EXISTS nas (
  id int(10) NOT NULL AUTO_INCREMENT,
  nasname varchar(128) NOT NULL,
  shortname varchar(32) DEFAULT NULL,
  type varchar(30) DEFAULT 'other',
  ports int(5) DEFAULT NULL,
  secret varchar(60) NOT NULL DEFAULT 'secret',
  server varchar(64) DEFAULT NULL,
  community varchar(50) DEFAULT NULL,
  description varchar(200) DEFAULT 'RADIUS Client',
  PRIMARY KEY (id),
  UNIQUE KEY nasname (nasname)
);

-- Tabel untuk menyimpan user credentials
CREATE TABLE IF NOT EXISTS radcheck (
  id int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  username varchar(64) NOT NULL DEFAULT '',
  attribute varchar(64) NOT NULL DEFAULT '',
  op char(2) NOT NULL DEFAULT '==',
  value varchar(253) NOT NULL DEFAULT '',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY username (username(32))
);

-- Tabel untuk menyimpan reply attributes untuk user
CREATE TABLE IF NOT EXISTS radreply (
  id int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  username varchar(64) NOT NULL DEFAULT '',
  attribute varchar(64) NOT NULL DEFAULT '',
  op char(2) NOT NULL DEFAULT '=',
  value varchar(253) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY username (username(32))
);

-- Tabel untuk menyimpan group check attributes
CREATE TABLE IF NOT EXISTS radgroupcheck (
  id int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  groupname varchar(64) NOT NULL DEFAULT '',
  attribute varchar(64) NOT NULL DEFAULT '',
  op char(2) NOT NULL DEFAULT '==',
  value varchar(253) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY groupname (groupname(32))
);

-- Tabel untuk menyimpan group reply attributes
CREATE TABLE IF NOT EXISTS radgroupreply (
  id int(11) UNSIGNED NOT NULL AUTO_INCREMENT,
  groupname varchar(64) NOT NULL DEFAULT '',
  attribute varchar(64) NOT NULL DEFAULT '',
  op char(2) NOT NULL DEFAULT '=',
  value varchar(253) NOT NULL DEFAULT '',
  PRIMARY KEY (id),
  KEY groupname (groupname(32))
);

-- Tabel untuk mapping user ke group
CREATE TABLE IF NOT EXISTS radusergroup (
  username varchar(64) NOT NULL DEFAULT '',
  groupname varchar(64) NOT NULL DEFAULT '',
  priority int(11) NOT NULL DEFAULT 1,
  KEY username (username(32))
);

-- Tabel untuk accounting data
CREATE TABLE IF NOT EXISTS radacct (
  radacctid bigint(21) NOT NULL AUTO_INCREMENT,
  acctsessionid varchar(64) NOT NULL DEFAULT '',
  acctuniqueid varchar(32) NOT NULL DEFAULT '',
  username varchar(64) NOT NULL DEFAULT '',
  groupname varchar(64) NOT NULL DEFAULT '',
  realm varchar(64) DEFAULT '',
  nasipaddress varchar(15) NOT NULL DEFAULT '',
  nasportid varchar(15) DEFAULT NULL,
  nasporttype varchar(32) DEFAULT NULL,
  acctstarttime datetime NULL DEFAULT NULL,
  acctupdatetime datetime NULL DEFAULT NULL,
  acctstoptime datetime NULL DEFAULT NULL,
  acctinterval int(12) DEFAULT NULL,
  acctsessiontime int(12) UNSIGNED DEFAULT NULL,
  acctauthentic varchar(32) DEFAULT NULL,
  connectinfo_start varchar(50) DEFAULT NULL,
  connectinfo_stop varchar(50) DEFAULT NULL,
  acctinputoctets bigint(20) DEFAULT NULL,
  acctoutputoctets bigint(20) DEFAULT NULL,
  calledstationid varchar(50) NOT NULL DEFAULT '',
  callingstationid varchar(50) NOT NULL DEFAULT '',
  acctterminatecause varchar(32) NOT NULL DEFAULT '',
  servicetype varchar(32) DEFAULT NULL,
  framedprotocol varchar(32) DEFAULT NULL,
  framedipaddress varchar(15) NOT NULL DEFAULT '',
  PRIMARY KEY (radacctid),
  UNIQUE KEY acctuniqueid (acctuniqueid),
  KEY username (username),
  KEY framedipaddress (framedipaddress),
  KEY acctsessionid (acctsessionid),
  KEY acctsessiontime (acctsessiontime),
  KEY acctstarttime (acctstarttime),
  KEY acctinterval (acctinterval),
  KEY acctstoptime (acctstoptime),
  KEY nasipaddress (nasipaddress)
);

-- Tabel untuk admin users (untuk UI management)
CREATE TABLE IF NOT EXISTS admin_users (
  id int(11) NOT NULL AUTO_INCREMENT,
  username varchar(50) NOT NULL UNIQUE,
  email varchar(100) NOT NULL UNIQUE,
  password varchar(255) NOT NULL,
  api_key varchar(64) DEFAULT NULL UNIQUE,
  is_super_admin tinyint(1) DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

-- Insert default NAS client (MikroTik)
INSERT INTO nas (nasname, shortname, type, ports, secret, description) VALUES
('192.168.1.1', 'mikrotik-main', 'mikrotik', 1812, 'mikrotik123', 'Main MikroTik Router'),

-- Insert default groups
INSERT INTO radgroupcheck (groupname, attribute, op, value) VALUES
('default', 'Simultaneous-Use', ':=', '1'),
('premium', 'Simultaneous-Use', ':=', '2'),
('unlimited', 'Simultaneous-Use', ':=', '999');

INSERT INTO radgroupreply (groupname, attribute, op, value) VALUES
('default', 'Framed-Protocol', ':=', 'PPP'),
('default', 'Service-Type', ':=', 'Framed-User'),
('premium', 'Framed-Protocol', ':=', 'PPP'),
('premium', 'Service-Type', ':=', 'Framed-User'),
('unlimited', 'Framed-Protocol', ':=', 'PPP'),
('unlimited', 'Service-Type', ':=', 'Framed-User');

-- Insert sample users
INSERT INTO radcheck (username, attribute, op, value) VALUES
('testuser', 'Cleartext-Password', ':=', 'testpass'),

-- Map users to groups
INSERT INTO radusergroup (username, groupname, priority) VALUES
('testuser', 'default', 5);

-- Create indexes for better performance
CREATE INDEX idx_radcheck_username ON radcheck(username);
CREATE INDEX idx_radreply_username ON radreply(username);
CREATE INDEX idx_radusergroup_username ON radusergroup(username);
CREATE INDEX idx_radacct_username ON radacct(username);
CREATE INDEX idx_radacct_nasip ON radacct(nasipaddress);
CREATE INDEX idx_radacct_start ON radacct(acctstarttime);

COMMIT;
