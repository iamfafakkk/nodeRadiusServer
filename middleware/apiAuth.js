const AdminModel = require('../models/AdminModel');

const apiAuth = async (req, res, next) => {
  try {
    // Get API key from header
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    
    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: 'API key is required. Please provide X-API-Key header.'
      });
    }

    // Validate API key
    const adminModel = new AdminModel();
    const user = await adminModel.findByApiKey(apiKey);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    // Add user info to request object
    req.apiUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      is_super_admin: user.is_super_admin
    };

    next();
  } catch (error) {
    console.error('API authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error during authentication'
    });
  }
};

module.exports = apiAuth;
