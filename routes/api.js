const express = require('express');
const UserController = require('../controllers/UserController');
const NasController = require('../controllers/NasController');
const apiAuth = require('../middleware/apiAuth');

const router = express.Router();

// API Documentation endpoint (no auth required)
router.get('/', (req, res) => {
  res.json({
    message: 'RADIUS Server API',
    version: '1.0.0',
    authentication: 'API Key required. Send X-API-Key header with valid API key.',
    endpoints: {
      // User endpoints
      'GET /api/users': 'Get all users',
      'GET /api/users/:username': 'Get user by username',
      'POST /api/users': 'Create new user',
      'PUT /api/users/:username': 'Update user',
      'DELETE /api/users/:username': 'Delete user',
      'POST /api/users/bulk': 'Bulk create users',
      
      // NAS endpoints
      'GET /api/nas': 'Get all NAS clients',
      'GET /api/nas/:nasip': 'Get NAS by IP',
      'POST /api/nas': 'Create new NAS',
      'PUT /api/nas/:nasip': 'Update NAS',
      'DELETE /api/nas/:nasip': 'Delete NAS',
      'GET /api/nas/:nasip/test': 'Test NAS connectivity'
    }
  });
});

// Apply API authentication to all routes below this point
router.use(apiAuth);

// User routes (protected)
router.get('/users', UserController.getAllUsers);
router.get('/users/:username', UserController.getUserByUsername);
router.post('/users', UserController.createUser);
router.put('/users/:username', UserController.updateUser);
router.delete('/users/:username', UserController.deleteUser);
router.post('/users/bulk', UserController.bulkCreateUsers);

// NAS routes (protected)
router.get('/nas', NasController.getAllNas);
router.get('/nas/:nasip', NasController.getNasByIp);
router.post('/nas', NasController.createNas);
router.put('/nas/:nasip', NasController.updateNas);
router.delete('/nas/:nasip', NasController.deleteNas);
router.get('/nas/:nasip/test', NasController.testNas);

module.exports = router;
