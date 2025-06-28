const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'radius',
  password: process.env.DB_PASSWORD || 'radiusradius',
  database: process.env.DB_NAME || 'radius',
};

class RadiusUserModel {
  constructor() {
    this.db = null;
  }

  async getConnection() {
    if (!this.db) {
      this.db = await mysql.createConnection(dbConfig);
    }
    return this.db;
  }

  // Get all RADIUS users with pagination
  async getAllUsers(page = 1, limit = 10) {
    try {
      const connection = await this.getConnection();
      // Ensure parameters are integers
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;
      
      console.log('getAllUsers params:', { pageNum, limitNum, offset });
      
      // Get users from radcheck table - using query instead of execute for debugging
      const [users] = await connection.query(
        `SELECT DISTINCT username, 
               MAX(CASE WHEN attribute = 'Cleartext-Password' THEN value END) as password,
               MIN(created_at) as created_at,
               MAX(updated_at) as updated_at
        FROM radcheck 
        WHERE attribute = 'Cleartext-Password'
        GROUP BY username 
        ORDER BY created_at DESC 
        LIMIT ${limitNum} OFFSET ${offset}`
      );

      // Get total count
      const [countResult] = await connection.query(
        `SELECT COUNT(DISTINCT username) as total 
        FROM radcheck 
        WHERE attribute = 'Cleartext-Password'`
      );

      return {
        users,
        total: countResult[0].total,
        page: pageNum,
        totalPages: Math.ceil(countResult[0].total / limitNum)
      };
    } catch (error) {
      console.error('Error getting all RADIUS users:', error);
      throw error;
    }
  }

  // Get user by username
  async getUserByUsername(username) {
    try {
      const connection = await this.getConnection();
      
      // Get radcheck data
      const [radcheckRows] = await connection.execute(
        'SELECT * FROM radcheck WHERE username = ?',
        [username]
      );
      
      // Get radreply data
      const [radreplyRows] = await connection.execute(
        'SELECT * FROM radreply WHERE username = ?',
        [username]
      );
      
      // Return combined data
      return {
        radcheck: radcheckRows,
        radreply: radreplyRows
      };
    } catch (error) {
      console.error('Error getting RADIUS user:', error);
      throw error;
    }
  }

  // Create new RADIUS user
  async createUser(userData) {
    try {
      const connection = await this.getConnection();
      
      // Start transaction
      await connection.beginTransaction();
      
      try {
        // Insert password
        await connection.execute(
          'INSERT INTO radcheck (username, attribute, op, value) VALUES (?, ?, ?, ?)',
          [userData.username, 'Cleartext-Password', ':=', userData.password]
        );

        // Insert Mikrotik-Group VSA or Filter-Id radreply attribute if provided (for MikroTik profile assignment)
        if (userData.mikrotikGroup) {
          // Use Mikrotik-Group VSA (preferred method for newer MikroTik routers)
          await connection.execute(
            'INSERT INTO radreply (username, attribute, op, value) VALUES (?, ?, ?, ?)',
            [userData.username, 'Mikrotik-Group', ':=', userData.mikrotikGroup]
          );
          
          // Also insert Filter-Id for backward compatibility
          await connection.execute(
            'INSERT INTO radreply (username, attribute, op, value) VALUES (?, ?, ?, ?)',
            [userData.username, 'Filter-Id', ':=', userData.mikrotikGroup]
          );
        }

        // Insert additional attributes if provided
        if (userData.attributes && userData.attributes.length > 0) {
          for (const attr of userData.attributes) {
            await connection.execute(
              'INSERT INTO radreply (username, attribute, op, value) VALUES (?, ?, ?, ?)',
              [userData.username, attr.attribute, attr.op || ':=', attr.value]
            );
          }
        }

        // Assign to group if provided
        if (userData.groupname) {
          await connection.execute(
            'INSERT INTO radusergroup (username, groupname, priority) VALUES (?, ?, ?)',
            [userData.username, userData.groupname, userData.priority || 5]
          );
        }

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error creating RADIUS user:', error);
      throw error;
    }
  }

  // Update RADIUS user
  async updateUser(username, userData) {
    try {
      const connection = await this.getConnection();
      
      // Start transaction
      await connection.beginTransaction();
      
      try {
        // Update password if provided
        if (userData.password) {
          await connection.execute(
            'UPDATE radcheck SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ? AND attribute = ?',
            [userData.password, username, 'Cleartext-Password']
          );
        }

        // Update or insert Mikrotik-Group and Filter-Id if provided
        if (userData.mikrotikGroup !== undefined) {
          if (userData.mikrotikGroup === '' || userData.mikrotikGroup === null) {
            // Remove both Mikrotik-Group and Filter-Id if empty
            await connection.execute(
              'DELETE FROM radreply WHERE username = ? AND attribute IN (?, ?)',
              [username, 'Mikrotik-Group', 'Filter-Id']
            );
          } else {
            // Handle Mikrotik-Group VSA
            const [existingMikrotikRows] = await connection.execute(
              'SELECT id FROM radreply WHERE username = ? AND attribute = ?',
              [username, 'Mikrotik-Group']
            );

            if (existingMikrotikRows.length > 0) {
              // Update existing Mikrotik-Group
              await connection.execute(
                'UPDATE radreply SET value = ? WHERE username = ? AND attribute = ?',
                [userData.mikrotikGroup, username, 'Mikrotik-Group']
              );
            } else {
              // Insert new Mikrotik-Group
              await connection.execute(
                'INSERT INTO radreply (username, attribute, op, value) VALUES (?, ?, ?, ?)',
                [username, 'Mikrotik-Group', ':=', userData.mikrotikGroup]
              );
            }

            // Handle Filter-Id for backward compatibility
            const [existingFilterRows] = await connection.execute(
              'SELECT id FROM radreply WHERE username = ? AND attribute = ?',
              [username, 'Filter-Id']
            );

            if (existingFilterRows.length > 0) {
              // Update existing Filter-Id
              await connection.execute(
                'UPDATE radreply SET value = ? WHERE username = ? AND attribute = ?',
                [userData.mikrotikGroup, username, 'Filter-Id']
              );
            } else {
              // Insert new Filter-Id
              await connection.execute(
                'INSERT INTO radreply (username, attribute, op, value) VALUES (?, ?, ?, ?)',
                [username, 'Filter-Id', ':=', userData.mikrotikGroup]
              );
            }
          }
        }

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error updating RADIUS user:', error);
      throw error;
    }
  }

  // Delete RADIUS user
  async deleteUser(username) {
    try {
      const connection = await this.getConnection();
      
      // Start transaction
      await connection.beginTransaction();
      
      try {
        // Delete from radcheck
        await connection.execute('DELETE FROM radcheck WHERE username = ?', [username]);
        
        // Delete from radreply
        await connection.execute('DELETE FROM radreply WHERE username = ?', [username]);
        
        // Delete from radusergroup
        await connection.execute('DELETE FROM radusergroup WHERE username = ?', [username]);
        
        // Delete from radacct (accounting records)
        await connection.execute('DELETE FROM radacct WHERE username = ?', [username]);

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error deleting RADIUS user:', error);
      throw error;
    }
  }

  // Check if username exists
  async userExists(username) {
    try {
      const connection = await this.getConnection();
      const [rows] = await connection.execute(
        'SELECT COUNT(*) as count FROM radcheck WHERE username = ? AND attribute = ?',
        [username, 'Cleartext-Password']
      );
      return rows[0].count > 0;
    } catch (error) {
      console.error('Error checking if RADIUS user exists:', error);
      throw error;
    }
  }

  // Get user groups
  async getUserGroups() {
    try {
      const connection = await this.getConnection();
      const [rows] = await connection.execute('SELECT DISTINCT groupname FROM radgroupcheck');
      return rows;
    } catch (error) {
      console.error('Error getting user groups:', error);
      throw error;
    }
  }

  // Search users
  async searchUsers(query, page = 1, limit = 10) {
    try {
      const connection = await this.getConnection();
      // Ensure parameters are integers
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;
      const searchPattern = `%${query}%`;
      
      console.log('searchUsers params:', { query, pageNum, limitNum, offset, searchPattern });
      
      const [users] = await connection.query(
        `SELECT DISTINCT username, 
               MAX(CASE WHEN attribute = 'Cleartext-Password' THEN value END) as password,
               MIN(created_at) as created_at,
               MAX(updated_at) as updated_at
        FROM radcheck 
        WHERE username LIKE '${searchPattern}' AND attribute = 'Cleartext-Password'
        GROUP BY username 
        ORDER BY created_at DESC 
        LIMIT ${limitNum} OFFSET ${offset}`
      );

      // Get total count
      const [countResult] = await connection.query(
        `SELECT COUNT(DISTINCT username) as total 
        FROM radcheck 
        WHERE username LIKE '${searchPattern}' AND attribute = 'Cleartext-Password'`
      );

      return {
        users,
        total: countResult[0].total,
        page: pageNum,
        totalPages: Math.ceil(countResult[0].total / limitNum)
      };
    } catch (error) {
      console.error('Error searching RADIUS users:', error);
      throw error;
    }
  }
}

module.exports = new RadiusUserModel();
