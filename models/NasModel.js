const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'radius',
  password: process.env.DB_PASSWORD || 'radiusradius',
  database: process.env.DB_NAME || 'radius',
};

class NasModel {
  constructor() {
    this.db = null;
  }

  async getConnection() {
    if (!this.db) {
      this.db = await mysql.createConnection(dbConfig);
    }
    return this.db;
  }

  // Get all NAS clients with pagination
  async getAllNas(page = 1, limit = 10) {
    try {
      const connection = await this.getConnection();
      // Ensure parameters are integers
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;
      
      const [nas] = await connection.query(`
        SELECT * FROM nas 
        ORDER BY id DESC 
        LIMIT ${limitNum} OFFSET ${offset}
      `);

      // Get total count
      const [countResult] = await connection.query('SELECT COUNT(*) as total FROM nas');

      return {
        nas,
        total: countResult[0].total,
        page: pageNum,
        totalPages: Math.ceil(countResult[0].total / limitNum)
      };
    } catch (error) {
      console.error('Error getting all NAS:', error);
      throw error;
    }
  }

  // Get NAS by ID
  async getNasById(id) {
    try {
      const connection = await this.getConnection();
      const [rows] = await connection.query('SELECT * FROM nas WHERE id = ?', [id]);
      return rows[0] || null;
    } catch (error) {
      console.error('Error getting NAS by ID:', error);
      throw error;
    }
  }

  // Create new NAS
  async createNas(nasData) {
    try {
      const connection = await this.getConnection();
      
      const [result] = await connection.query(`
        INSERT INTO nas (nasname, shortname, type, ports, secret, server, community, description) 
        VALUES (${mysql.escape(nasData.nasname)}, ${mysql.escape(nasData.shortname)}, ${mysql.escape(nasData.type || 'other')}, ${mysql.escape(nasData.ports)}, ${mysql.escape(nasData.secret)}, ${mysql.escape(nasData.server)}, ${mysql.escape(nasData.community)}, ${mysql.escape(nasData.description || 'RADIUS Client')})
      `);
      
      return result.insertId;
    } catch (error) {
      console.error('Error creating NAS:', error);
      throw error;
    }
  }

  // Update NAS
  async updateNas(id, nasData) {
    try {
      const connection = await this.getConnection();
      
      const [result] = await connection.query(`
        UPDATE nas 
        SET nasname = ${mysql.escape(nasData.nasname)}, shortname = ${mysql.escape(nasData.shortname)}, type = ${mysql.escape(nasData.type)}, ports = ${mysql.escape(nasData.ports)}, secret = ${mysql.escape(nasData.secret)}, 
            server = ${mysql.escape(nasData.server)}, community = ${mysql.escape(nasData.community)}, description = ${mysql.escape(nasData.description)}
        WHERE id = ${mysql.escape(id)}
      `);
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating NAS:', error);
      throw error;
    }
  }

  // Delete NAS
  async deleteNas(id) {
    try {
      const connection = await this.getConnection();
      
      const [result] = await connection.query(`DELETE FROM nas WHERE id = ${mysql.escape(id)}`);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting NAS:', error);
      throw error;
    }
  }

  // Check if NAS name exists
  async nasNameExists(nasname, excludeId = null) {
    try {
      const connection = await this.getConnection();
      let query = 'SELECT COUNT(*) as count FROM nas WHERE nasname = ?';
      let params = [nasname];
      
      if (excludeId) {
        query += ' AND id != ?';
        params.push(excludeId);
      }
      
      const [rows] = await connection.query(query, params);
      return rows[0].count > 0;
    } catch (error) {
      console.error('Error checking if NAS name exists:', error);
      throw error;
    }
  }

  // Search NAS
  async searchNas(query, page = 1, limit = 10) {
    try {
      const connection = await this.getConnection();
      // Ensure parameters are integers
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;
      const searchPattern = `%${query}%`;
      
      const [nas] = await connection.query(`
        SELECT * FROM nas 
        WHERE nasname LIKE ${mysql.escape(searchPattern)} OR shortname LIKE ${mysql.escape(searchPattern)} OR description LIKE ${mysql.escape(searchPattern)}
        ORDER BY id DESC 
        LIMIT ${limitNum} OFFSET ${offset}
      `);

      // Get total count
      const [countResult] = await connection.query(`
        SELECT COUNT(*) as total FROM nas 
        WHERE nasname LIKE ${mysql.escape(searchPattern)} OR shortname LIKE ${mysql.escape(searchPattern)} OR description LIKE ${mysql.escape(searchPattern)}
      `);

      return {
        nas,
        total: countResult[0].total,
        page: pageNum,
        totalPages: Math.ceil(countResult[0].total / limitNum)
      };
    } catch (error) {
      console.error('Error searching NAS:', error);
      throw error;
    }
  }

  // Get NAS types
  getNasTypes() {
    return [
      'other',
      'cisco',
      'computone',
      'livingston',
      'juniper',
      'max40xx',
      'multitech',
      'netserver',
      'pathras',
      'patton',
      'portslave',
      'tc',
      'usrhiper',
      'mikrotik'
    ];
  }

  // Get NAS statistics
  async getNasStatistics() {
    try {
      const connection = await this.getConnection();
      
      // Total NAS count
      const [totalCount] = await connection.query('SELECT COUNT(*) as count FROM nas');
      
      // NAS by type
      const [typeStats] = await connection.query(`
        SELECT type, COUNT(*) as count 
        FROM nas 
        GROUP BY type 
        ORDER BY count DESC
      `);
      
      // Recent activity by NAS
      const [activityStats] = await connection.query(`
        SELECT n.nasname, n.shortname, COUNT(r.radacctid) as sessions
        FROM nas n
        LEFT JOIN radacct r ON n.nasname = r.nasipaddress 
          AND r.acctstarttime > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        GROUP BY n.id, n.nasname, n.shortname
        ORDER BY sessions DESC
        LIMIT 10
      `);

      return {
        total: totalCount[0].count,
        byType: typeStats,
        recentActivity: activityStats
      };
    } catch (error) {
      console.error('Error getting NAS statistics:', error);
      throw error;
    }
  }
}

module.exports = new NasModel();
