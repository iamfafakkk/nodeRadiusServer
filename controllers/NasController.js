const RadiusModel = require('../models/RadiusModel');
const { serverLogger } = require('../config/logger');

class NasController {
  
  // Get all NAS clients
  static async getAllNas(req, res) {
    try {
      const nasClients = await RadiusModel.getNasClients();
      res.json({
        success: true,
        data: nasClients,
        count: nasClients.length
      });
    } catch (error) {
      serverLogger.error('Error getting NAS clients:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get NAS by IP
  static async getNasByIp(req, res) {
    try {
      const { nasip } = req.params;
      const nas = await RadiusModel.getNasByIp(nasip);
      
      if (!nas) {
        return res.status(404).json({
          success: false,
          message: 'NAS not found'
        });
      }

      res.json({
        success: true,
        data: nas
      });
    } catch (error) {
      serverLogger.error('Error getting NAS:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create new NAS
  static async createNas(req, res) {
    try {
      const { nasname, shortname, secret, description, type = 'mikrotik', ports = 1700 } = req.body;

      // Validation
      if (!nasname || !secret) {
        return res.status(400).json({
          success: false,
          message: 'NAS name and secret are required'
        });
      }

      // Check if NAS already exists
      const existingNas = await RadiusModel.getNasByIp(nasname);
      if (existingNas) {
        return res.status(409).json({
          success: false,
          message: 'NAS already exists'
        });
      }

      const result = await RadiusModel.createNas({
        nasname,
        shortname: shortname || nasname,
        type,
        ports,
        secret,
        description: description || `NAS ${nasname}`
      });
      
      serverLogger.info('NAS created:', { nasname, shortname });
      
      res.status(201).json({
        success: true,
        message: 'NAS created successfully',
        data: { nasname, shortname, type, ports }
      });
    } catch (error) {
      serverLogger.error('Error creating NAS:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update NAS
  static async updateNas(req, res) {
    try {
      const { nasip } = req.params;
      const { shortname, secret, description, type, ports } = req.body;

      // Check if NAS exists
      const existingNas = await RadiusModel.getNasByIp(nasip);
      if (!existingNas) {
        return res.status(404).json({
          success: false,
          message: 'NAS not found'
        });
      }

      const result = await RadiusModel.updateNas(nasip, {
        shortname,
        secret,
        description,
        type,
        ports
      });
      
      serverLogger.info('NAS updated:', { nasip, hasNewSecret: !!secret });
      
      res.json({
        success: true,
        message: 'NAS updated successfully'
      });
    } catch (error) {
      serverLogger.error('Error updating NAS:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Delete NAS
  static async deleteNas(req, res) {
    try {
      const { nasip } = req.params;

      // Check if NAS exists
      const existingNas = await RadiusModel.getNasByIp(nasip);
      if (!existingNas) {
        return res.status(404).json({
          success: false,
          message: 'NAS not found'
        });
      }

      const result = await RadiusModel.deleteNas(nasip);
      
      serverLogger.info('NAS deleted:', { nasip });
      
      res.json({
        success: true,
        message: 'NAS deleted successfully'
      });
    } catch (error) {
      serverLogger.error('Error deleting NAS:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Test NAS connectivity
  static async testNas(req, res) {
    try {
      const { nasip } = req.params;
      
      // Basic connectivity test
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);

      try {
        const { stdout } = await execPromise(`ping -c 3 ${nasip}`);
        
        res.json({
          success: true,
          message: 'NAS connectivity test successful',
          data: {
            nasip,
            status: 'reachable',
            ping_result: stdout.split('\n').slice(-3, -1)
          }
        });
      } catch (pingError) {
        res.json({
          success: false,
          message: 'NAS connectivity test failed',
          data: {
            nasip,
            status: 'unreachable',
            error: pingError.message
          }
        });
      }

    } catch (error) {
      serverLogger.error('Error testing NAS:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }
}

module.exports = NasController;
