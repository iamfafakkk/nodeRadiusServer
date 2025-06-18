const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'radius',
  password: process.env.DB_PASSWORD || 'radiusradius',
  database: process.env.DB_NAME || 'radius',
};

class AdminModel {
  constructor() {
    this.db = null;
  }

  async getConnection() {
    if (!this.db) {
      this.db = await mysql.createConnection(dbConfig);
    }
    return this.db;
  }

  async findByUsername(username) {
    try {
      const connection = await this.getConnection();
      const [rows] = await connection.query(
        `SELECT * FROM admin_users WHERE username = ${mysql.escape(username)}`
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by username:', error);
      throw error;
    }
  }

  async findByEmail(email) {
    try {
      const connection = await this.getConnection();
      const [rows] = await connection.query(
        `SELECT * FROM admin_users WHERE email = ${mysql.escape(email)}`
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  async findById(id) {
    try {
      const connection = await this.getConnection();
      const [rows] = await connection.query(
        `SELECT * FROM admin_users WHERE id = ${mysql.escape(id)}`
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by id:', error);
      throw error;
    }
  }

  async createUser(userData) {
    try {
      const connection = await this.getConnection();
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      
      const [result] = await connection.query(
        `INSERT INTO admin_users (username, email, password, is_super_admin) VALUES (${mysql.escape(userData.username)}, ${mysql.escape(userData.email)}, ${mysql.escape(hashedPassword)}, ${mysql.escape(userData.is_super_admin || 0)})`
      );
      
      return result.insertId;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async validatePassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async countUsers() {
    try {
      const connection = await this.getConnection();
      const [rows] = await connection.query('SELECT COUNT(*) as count FROM admin_users');
      return rows[0].count;
    } catch (error) {
      console.error('Error counting users:', error);
      throw error;
    }
  }

  async getAllUsers() {
    try {
      const connection = await this.getConnection();
      const [rows] = await connection.query(
        'SELECT id, username, email, api_key, is_super_admin, created_at FROM admin_users ORDER BY created_at DESC'
      );
      return rows;
    } catch (error) {
      console.error('Error getting all users:', error);
      throw error;
    }
  }

  async findByApiKey(apiKey) {
    try {
      const connection = await this.getConnection();
      const [rows] = await connection.query(
        `SELECT * FROM admin_users WHERE api_key = ${mysql.escape(apiKey)}`
      );
      return rows[0] || null;
    } catch (error) {
      console.error('Error finding user by API key:', error);
      throw error;
    }
  }

  async generateApiKey(userId) {
    try {
      const crypto = require('crypto');
      const apiKey = crypto.randomBytes(32).toString('hex');
      
      const connection = await this.getConnection();
      const [result] = await connection.query(
        `UPDATE admin_users SET api_key = ${mysql.escape(apiKey)} WHERE id = ${mysql.escape(userId)}`
      );
      
      if (result.affectedRows > 0) {
        return apiKey;
      }
      return null;
    } catch (error) {
      console.error('Error generating API key:', error);
      throw error;
    }
  }

  async revokeApiKey(userId) {
    try {
      const connection = await this.getConnection();
      const [result] = await connection.query(
        `UPDATE admin_users SET api_key = NULL WHERE id = ${mysql.escape(userId)}`
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error revoking API key:', error);
      throw error;
    }
  }

  async updateUser(id, userData) {
    try {
      const connection = await this.getConnection();
      let queryParts = [];
      
      if (userData.username) queryParts.push(`username = ${mysql.escape(userData.username)}`);
      if (userData.email) queryParts.push(`email = ${mysql.escape(userData.email)}`);
      if (userData.fullname !== undefined) queryParts.push(`fullname = ${mysql.escape(userData.fullname)}`);
      if (userData.role) queryParts.push(`role = ${mysql.escape(userData.role)}`);
      if (userData.is_active !== undefined) queryParts.push(`is_active = ${mysql.escape(userData.is_active)}`);
      if (userData.description !== undefined) queryParts.push(`description = ${mysql.escape(userData.description)}`);

      if (userData.password) {
        const hashedPassword = await bcrypt.hash(userData.password, 12);
        queryParts.push(`password = ${mysql.escape(hashedPassword)}`);
      }

      const query = `UPDATE admin_users SET ${queryParts.join(', ')} WHERE id = ${mysql.escape(id)}`;

      const [result] = await connection.query(query);
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  async deleteUser(id) {
    try {
      const connection = await this.getConnection();
      const [result] = await connection.query(
        `DELETE FROM admin_users WHERE id = ${mysql.escape(id)}`
      );
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}

module.exports = new AdminModel();
