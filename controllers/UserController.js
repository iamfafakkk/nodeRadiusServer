const RadiusModel = require('../models/RadiusModel');
const { serverLogger } = require('../config/logger');

class UserController {
  
  // Get all users
  static async getAllUsers(req, res) {
    try {
      const users = await RadiusModel.getAllUsers();
      res.json({
        success: true,
        data: users,
        count: users.length
      });
    } catch (error) {
      serverLogger.error('Error getting users:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get user by username
  static async getUserByUsername(req, res) {
    try {
      const { username } = req.params;
      const user = await RadiusModel.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      serverLogger.error('Error getting user:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create new user
  static async createUser(req, res) {
    try {
      const { username, password, groupname } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: 'Username and password are required'
        });
      }

      // Check if user already exists
      const existingUser = await RadiusModel.getUserByUsername(username);
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User already exists'
        });
      }

      const result = await RadiusModel.createUser(username, password, groupname);
      
      serverLogger.info('User created:', { username, groupname });
      
      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { username, groupname }
      });
    } catch (error) {
      serverLogger.error('Error creating user:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update user
  static async updateUser(req, res) {
    try {
      const { username } = req.params;
      const { password, groupname } = req.body;

      // Check if user exists
      const existingUser = await RadiusModel.getUserByUsername(username);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const result = await RadiusModel.updateUser(username, password, groupname);
      
      serverLogger.info('User updated:', { username, hasNewPassword: !!password, groupname });
      
      res.json({
        success: true,
        message: 'User updated successfully'
      });
    } catch (error) {
      serverLogger.error('Error updating user:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Delete user
  static async deleteUser(req, res) {
    try {
      const { username } = req.params;

      // Check if user exists
      const existingUser = await RadiusModel.getUserByUsername(username);
      if (!existingUser) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const result = await RadiusModel.deleteUser(username);
      
      serverLogger.info('User deleted:', { username });
      
      res.json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      serverLogger.error('Error deleting user:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Bulk create users
  static async bulkCreateUsers(req, res) {
    try {
      const { users } = req.body;

      if (!Array.isArray(users) || users.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Users array is required'
        });
      }

      const results = [];
      const errors = [];

      for (const userData of users) {
        try {
          const { username, password, groupname } = userData;
          
          if (!username || !password) {
            errors.push({ username, error: 'Username and password are required' });
            continue;
          }

          // Check if user already exists
          const existingUser = await RadiusModel.getUserByUsername(username);
          if (existingUser) {
            errors.push({ username, error: 'User already exists' });
            continue;
          }

          await RadiusModel.createUser(username, password, groupname);
          results.push({ username, status: 'created' });
        } catch (error) {
          errors.push({ username: userData.username, error: error.message });
        }
      }

      serverLogger.info('Bulk user creation completed:', { 
        created: results.length, 
        errors: errors.length 
      });

      res.json({
        success: true,
        message: 'Bulk user creation completed',
        data: {
          created: results,
          errors: errors,
          summary: {
            total: users.length,
            created: results.length,
            failed: errors.length
          }
        }
      });
    } catch (error) {
      serverLogger.error('Error in bulk user creation:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = UserController;
