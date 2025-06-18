const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

class RadiusModel {
  
  // Mendapatkan user berdasarkan username
  static async getUserByUsername(username) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM radcheck WHERE username = ? AND attribute = "Cleartext-Password"',
        [username]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Mendapatkan semua users
  static async getAllUsers() {
    try {
      const [rows] = await pool.execute(`
        SELECT 
          rc.username,
          rc.value as password,
          rg.groupname,
          rc.created_at,
          rc.updated_at
        FROM radcheck rc
        LEFT JOIN radusergroup rug ON rc.username = rug.username
        LEFT JOIN radgroupcheck rg ON rug.groupname = rg.groupname
        WHERE rc.attribute = "Cleartext-Password"
        ORDER BY rc.username
      `);
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Membuat user baru
  static async createUser(username, password, groupname = 'default') {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Insert ke radcheck
      await connection.query(
        'INSERT INTO radcheck (username, attribute, op, value) VALUES (?, "Cleartext-Password", ":=", ?)',
        [username, password]
      );

      // Insert ke radusergroup jika groupname diberikan
      if (groupname) {
        await connection.query(
          'INSERT INTO radusergroup (username, groupname, priority) VALUES (?, ?, 5)',
          [username, groupname]
        );
      }

      await connection.commit();
      return { success: true, message: 'User created successfully' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Update user
  static async updateUser(username, newPassword, groupname) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Update password di radcheck
      if (newPassword) {
        await connection.query(
          'UPDATE radcheck SET value = ?, updated_at = NOW() WHERE username = ? AND attribute = "Cleartext-Password"',
          [newPassword, username]
        );
      }

      // Update group jika diberikan
      if (groupname) {
        await connection.query(
          'UPDATE radusergroup SET groupname = ? WHERE username = ?',
          [groupname, username]
        );
      }

      await connection.commit();
      return { success: true, message: 'User updated successfully' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Hapus user
  static async deleteUser(username) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Hapus dari radcheck
      await connection.query(
        'DELETE FROM radcheck WHERE username = ?',
        [username]
      );

      // Hapus dari radusergroup
      await connection.query(
        'DELETE FROM radusergroup WHERE username = ?',
        [username]
      );

      // Hapus dari radacct jika ada
      await connection.query(
        'DELETE FROM radacct WHERE username = ?',
        [username]
      );

      await connection.commit();
      return { success: true, message: 'User deleted successfully' };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // Mendapatkan NAS clients
  static async getNasClients() {
    try {
      const [rows] = await pool.execute('SELECT * FROM nas');
      return rows;
    } catch (error) {
      throw error;
    }
  }

  // Verify NAS client
  static async verifyNasClient(nasIp, secret) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM nas WHERE nasname = ? AND secret = ?',
        [nasIp, secret]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Log accounting with better handling for different status types
  static async logAccounting(data) {
    try {
      const { 
        sessionId, uniqueId, username, nasIp, nasPort, nasPortType,
        startTime, updateTime, interval, sessionTime, inputOctets, outputOctets,
        calledStation, callingStation, terminateCause, serviceType, 
        framedProtocol, framedIp
      } = data;

      // Check if this is an accounting start, update, or stop
      if (startTime) {
        // This is an accounting start - create new record
        const insertQuery = `
          INSERT INTO radacct (
            acctsessionid, acctuniqueid, username, nasipaddress, 
            nasportid, nasporttype, acctstarttime, acctupdatetime, 
            acctinterval, acctsessiontime, acctinputoctets, acctoutputoctets,
            calledstationid, callingstationid, servicetype, framedprotocol, framedipaddress
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            acctupdatetime = VALUES(acctupdatetime),
            acctinterval = VALUES(acctinterval),
            acctsessiontime = VALUES(acctsessiontime),
            acctinputoctets = VALUES(acctinputoctets),
            acctoutputoctets = VALUES(acctoutputoctets)
        `;

        await pool.execute(insertQuery, [
          sessionId, uniqueId, username, nasIp, nasPort, nasPortType,
          startTime, updateTime, interval, sessionTime, inputOctets, outputOctets,
          calledStation, callingStation, serviceType, framedProtocol, framedIp
        ]);
      } else if (terminateCause) {
        // This is an accounting stop - update existing record
        const updateQuery = `
          UPDATE radacct SET 
            acctstoptime = ?,
            acctupdatetime = ?,
            acctsessiontime = ?,
            acctinputoctets = ?,
            acctoutputoctets = ?,
            acctterminatecause = ?
          WHERE acctsessionid = ? AND username = ? AND nasipaddress = ?
        `;

        await pool.execute(updateQuery, [
          updateTime, updateTime, sessionTime, inputOctets, outputOctets,
          terminateCause, sessionId, username, nasIp
        ]);
      } else {
        // This is an accounting update
        const updateQuery = `
          UPDATE radacct SET 
            acctupdatetime = ?,
            acctinterval = ?,
            acctsessiontime = ?,
            acctinputoctets = ?,
            acctoutputoctets = ?
          WHERE acctsessionid = ? AND username = ? AND nasipaddress = ? AND acctstoptime IS NULL
        `;

        await pool.execute(updateQuery, [
          updateTime, interval, sessionTime, inputOctets, outputOctets,
          sessionId, username, nasIp
        ]);
      }

      return { success: true };
    } catch (error) {
      console.error('Error logging accounting data:', error);
      throw error;
    }
  }

  // Get NAS by IP
  static async getNasByIp(nasIp) {
    try {
      const [rows] = await pool.execute(
        'SELECT * FROM nas WHERE nasname = ?',
        [nasIp]
      );
      return rows[0] || null;
    } catch (error) {
      throw error;
    }
  }

  // Create new NAS
  static async createNas(nasData) {
    try {
      const { nasname, shortname, type, ports, secret, description } = nasData;
      await pool.execute(
        'INSERT INTO nas (nasname, shortname, type, ports, secret, description) VALUES (?, ?, ?, ?, ?, ?)',
        [nasname, shortname, type, ports, secret, description]
      );
      return { success: true, message: 'NAS created successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Update NAS
  static async updateNas(nasIp, updateData) {
    try {
      const fields = [];
      const values = [];
      
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          fields.push(`${key} = ?`);
          values.push(updateData[key]);
        }
      });
      
      if (fields.length === 0) {
        return { success: false, message: 'No fields to update' };
      }
      
      values.push(nasIp);
      
      await pool.execute(
        `UPDATE nas SET ${fields.join(', ')} WHERE nasname = ?`,
        values
      );
      
      return { success: true, message: 'NAS updated successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Delete NAS
  static async deleteNas(nasIp) {
    try {
      await pool.execute(
        'DELETE FROM nas WHERE nasname = ?',
        [nasIp]
      );
      return { success: true, message: 'NAS deleted successfully' };
    } catch (error) {
      throw error;
    }
  }
}

module.exports = RadiusModel;
