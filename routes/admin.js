const express = require('express');
const router = express.Router();
const AdminController = require('../controllers/AdminController');
const RadiusUserController = require('../controllers/RadiusUserController');
const ActiveUserController = require('../controllers/ActiveUserController');
const NasManagementController = require('../controllers/NasManagementController');
const GroupController = require('../controllers/GroupController');
const { 
  requireAuth, 
  redirectIfAuth, 
  checkAdminExists, 
  redirectIfAdminExists,
  requireSuperAdmin 
} = require('../middleware/auth');

// Route untuk setup admin pertama
router.get('/setup', redirectIfAdminExists, AdminController.setupPage);
router.post('/setup', redirectIfAdminExists, AdminController.setupAdmin);

// Route untuk login
router.get('/login', checkAdminExists, redirectIfAuth, AdminController.loginPage);
router.post('/login', checkAdminExists, redirectIfAuth, AdminController.login);

// Route untuk logout
router.get('/logout', AdminController.logout);

// Route yang memerlukan autentikasi
router.get('/dashboard', requireAuth, AdminController.dashboard);
router.get('/users', requireAuth, requireSuperAdmin, AdminController.usersPage);
router.get('/users/add', requireAuth, requireSuperAdmin, AdminController.addUserPage);
router.post('/users/add', requireAuth, requireSuperAdmin, AdminController.addUser);
router.get('/users/:id/edit', requireAuth, requireSuperAdmin, AdminController.editUserPage);
router.post('/users/:id/edit', requireAuth, requireSuperAdmin, AdminController.editUser);
router.post('/users/:id/delete', requireAuth, requireSuperAdmin, AdminController.deleteUser);

// API Key management routes
router.post('/users/:id/generate-api-key', requireAuth, requireSuperAdmin, AdminController.generateApiKey);
router.post('/users/:id/revoke-api-key', requireAuth, requireSuperAdmin, AdminController.revokeApiKey);

// Routes untuk RADIUS users management
router.get('/radius-users', requireAuth, RadiusUserController.radiusUsersPage);
router.get('/radius-users/add', requireAuth, RadiusUserController.addRadiusUserPage);
router.post('/radius-users/add', requireAuth, RadiusUserController.addRadiusUser);
router.get('/radius-users/:username/edit', requireAuth, RadiusUserController.editRadiusUserPage);
router.post('/radius-users/:username/edit', requireAuth, RadiusUserController.editRadiusUser);
router.post('/radius-users/:username/delete', requireAuth, RadiusUserController.deleteRadiusUser);

// Routes untuk Active Users monitoring
router.get('/active-users', requireAuth, ActiveUserController.activeUsersPage);
router.get('/active-users/:username/sessions', requireAuth, ActiveUserController.userSessionsPage);
router.post('/active-users/:radacctid/disconnect', requireAuth, ActiveUserController.disconnectUser);
router.get('/monitoring', requireAuth, ActiveUserController.realTimeMonitoringPage);

// Routes untuk NAS management
router.get('/nas', requireAuth, NasManagementController.nasPage);
router.get('/nas/add', requireAuth, requireSuperAdmin, NasManagementController.addNasPage);
router.post('/nas/add', requireAuth, requireSuperAdmin, NasManagementController.addNas);
router.get('/nas/:id/edit', requireAuth, requireSuperAdmin, NasManagementController.editNasPage);
router.post('/nas/:id/edit', requireAuth, requireSuperAdmin, NasManagementController.editNas);
router.post('/nas/:id/delete', requireAuth, requireSuperAdmin, NasManagementController.deleteNas);

// Routes untuk Group management
router.get('/groups', requireAuth, GroupController.groupsPage);
router.get('/groups/add', requireAuth, requireSuperAdmin, GroupController.addGroupPage);
router.post('/groups/add', requireAuth, requireSuperAdmin, GroupController.addGroup);
router.get('/groups/:groupname', requireAuth, GroupController.groupDetailPage);
router.get('/groups/:groupname/edit', requireAuth, requireSuperAdmin, GroupController.editGroupPage);
router.post('/groups/:groupname/edit', requireAuth, requireSuperAdmin, GroupController.editGroup);
router.post('/groups/:groupname/delete', requireAuth, requireSuperAdmin, GroupController.deleteGroup);

// Internal API endpoints (menggunakan session auth, bukan API key)
// Menggunakan prefix /internal-api untuk menghindari konflik dengan /api
router.get('/internal-api/active-users/online', requireAuth, ActiveUserController.getOnlineUsersApi);
router.get('/internal-api/active-users/statistics', requireAuth, ActiveUserController.getStatisticsApi);
router.get('/internal-api/active-users/dashboard', requireAuth, ActiveUserController.getDashboardDataApi);
router.get('/internal-api/active-users/events', requireAuth, ActiveUserController.getConnectionEventsApi);
router.get('/internal-api/active-users/alerts', requireAuth, ActiveUserController.getAlertsApi);
router.get('/internal-api/active-users/:username/pattern', requireAuth, ActiveUserController.getUserActivityPatternApi);

// Enhanced monitoring APIs (internal)
router.get('/internal-api/monitoring/enhanced', requireAuth, ActiveUserController.getEnhancedMonitoringApi);
router.get('/internal-api/monitoring/sessions', requireAuth, ActiveUserController.getRealTimeSessionsApi);
router.get('/internal-api/monitoring/performance', requireAuth, ActiveUserController.getNetworkPerformanceApi);
router.get('/internal-api/monitoring/events', requireAuth, ActiveUserController.getConnectionEventsAdvancedApi);
router.get('/internal-api/monitoring/alerts', requireAuth, ActiveUserController.getAdvancedAlertsApi);

router.get('/internal-api/nas/statistics', requireAuth, NasManagementController.getNasStatisticsApi);
router.get('/internal-api/groups/template/:template', requireAuth, GroupController.getTemplateApi);

// Redirect root ke dashboard atau login
router.get('/', async (req, res) => {
  try {
    const AdminModel = require('../models/AdminModel');
    const userCount = await AdminModel.countUsers();
    
    if (userCount === 0) {
      return res.redirect('/setup');
    }
    
    if (req.session && req.session.user) {
      return res.redirect('/dashboard');
    } else {
      return res.redirect('/login');
    }
  } catch (error) {
    console.error('Error in root route:', error);
    res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
