const ActiveUserModel = require('../models/ActiveUserModel');

class ActiveUserController {
  // Halaman monitoring active users
  async activeUsersPage(req, res) {
    try {
      const page = parseInt(req.query.page) || 1;
      const search = req.query.search || '';
      const filter = req.query.filter || 'all'; // all, online, offline
      const view = req.query.view || 'active'; // active, comparison
      
      let result;
      let comparisonData = null;

      if (view === 'comparison') {
        // Get comparison between radcheck users and their online status
        comparisonData = await ActiveUserModel.getUserStatusComparison(page, 20, search, filter);
        result = {
          users: comparisonData.users,
          total: comparisonData.total,
          page: comparisonData.page,
          totalPages: comparisonData.totalPages
        };
      } else {
        // Original active users view
        if (search) {
          result = await ActiveUserModel.searchActiveUsers(search, page, 20);
        } else {
          result = await ActiveUserModel.getActiveUsers(page, 20);
        }

        // Filter by status if needed
        if (filter === 'online') {
          result.users = result.users.filter(user => user.status === 'Online');
        } else if (filter === 'offline') {
          result.users = result.users.filter(user => user.status === 'Offline');
        }
      }

      // Get statistics and recent events
      const stats = await ActiveUserModel.getStatistics();
      const recentEvents = await ActiveUserModel.getConnectionEvents(2, 10);
      const alerts = await ActiveUserModel.getUnusualActivity();
      
      res.render('active-users', {
        title: 'Active Users',
        user: req.session.user,
        users: result.users,
        stats,
        recentEvents,
        alerts,
        pagination: {
          current: result.page,
          total: result.totalPages,
          hasNext: result.page < result.totalPages,
          hasPrev: result.page > 1
        },
        search,
        filter,
        view,
        comparisonData,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'active-users'
      });
    } catch (error) {
      console.error('Error rendering active users page:', error);
      req.flash('error', 'Terjadi kesalahan saat memuat data active users');
      res.redirect('/dashboard');
    }
  }

  // Halaman detail user sessions
  async userSessionsPage(req, res) {
    try {
      const username = req.params.username;
      const page = parseInt(req.query.page) || 1;
      
      console.log('Getting sessions for username:', username);
      console.log('Page:', page);
      
      // Get filter parameters from query
      const filter = {
        dateRange: req.query.dateRange || 'all',
        status: req.query.status || 'all',
        startDate: req.query.startDate || '',
        endDate: req.query.endDate || ''
      };
        
        // Get user sessions with error handling
        let result;
        let activityPattern;
      
      try {
        console.log('Calling getUserSessions...');
        result = await ActiveUserModel.getUserSessions(username, page, 10);
        console.log('getUserSessions result:', JSON.stringify(result, null, 2));
      } catch (error) {
        console.error('Error getting user sessions:', error);
        result = {
          sessions: [],
          page: 1,
          totalPages: 1,
          totalSessions: 0,
          hasNext: false,
          hasPrev: false
        };
      }
      
      try {
        console.log('Calling getUserActivityPattern...');
        activityPattern = await ActiveUserModel.getUserActivityPattern(username);
        console.log('getUserActivityPattern result:', JSON.stringify(activityPattern, null, 2));
      } catch (error) {
        console.error('Error getting activity pattern:', error);
        activityPattern = {
          stats: {
            totalSessions: 0,
            activeSessions: 0,
            totalTimeFormatted: '0h 0m',
            totalDataFormatted: '0 MB',
            avgSessionTimeFormatted: '0h 0m',
            lastSession: 'Never'
          },
          hourlyPattern: [],
          dailyPattern: [],
          nasPattern: []
        };
      }
      
      // Ensure activityPattern has proper structure
      if (!activityPattern.stats) {
        activityPattern.stats = {
          totalSessions: 0,
          activeSessions: 0,
          totalTimeFormatted: '0h 0m',
          totalDataFormatted: '0 MB',
          avgSessionTimeFormatted: '0h 0m',
          lastSession: 'Never'
        };
      }
      
      console.log('Final activityPattern:', JSON.stringify(activityPattern, null, 2));
      
      res.render('user-sessions', {
        title: `Sessions - ${username}`,
        user: req.session.user,
        username,
        sessions: result.sessions || [],
        activityPattern: activityPattern,
        filter: filter,
        pagination: {
          current: result.page || 1,
          total: result.totalPages || 1,
          hasNext: result.hasNext || false,
          hasPrev: result.hasPrev || false
        },
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'active-users'
      });
    } catch (error) {
      console.error('Error rendering user sessions page:', error);
      req.flash('error', 'Terjadi kesalahan saat memuat data sessions');
      res.redirect('/active-users');
    }
  }

  // Disconnect user
  async disconnectUser(req, res) {
    try {
      const radacctid = req.params.radacctid;
      
      const disconnected = await ActiveUserModel.disconnectUser(radacctid);
      if (disconnected) {
        req.flash('success', 'User berhasil didisconnect');
      } else {
        req.flash('error', 'Session tidak ditemukan atau sudah disconnect');
      }
      
      res.redirect('/active-users');
    } catch (error) {
      console.error('Error disconnecting user:', error);
      req.flash('error', 'Terjadi kesalahan saat disconnect user');
      res.redirect('/active-users');
    }
  }

  // API endpoint untuk real-time data
  async getOnlineUsersApi(req, res) {
    try {
      const onlineUsers = await ActiveUserModel.getOnlineUsers();
      const stats = await ActiveUserModel.getStatistics();
      
      res.json({
        success: true,
        data: {
          users: onlineUsers,
          stats,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error getting online users API:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil data online users'
      });
    }
  }

  // API endpoint untuk statistics
  async getStatisticsApi(req, res) {
    try {
      const stats = await ActiveUserModel.getStatistics();
      
      res.json({
        success: true,
        data: stats,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting statistics API:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil statistik'
      });
    }
  }

  // API endpoint untuk dashboard data
  async getDashboardDataApi(req, res) {
    try {
      const dashboardData = await ActiveUserModel.getDashboardData();
      
      res.json({
        success: true,
        data: dashboardData,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting dashboard data API:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil data dashboard'
      });
    }
  }

  // API endpoint untuk connection events
  async getConnectionEventsApi(req, res) {
    try {
      const hours = parseInt(req.query.hours) || 24;
      const limit = parseInt(req.query.limit) || 50;
      
      const events = await ActiveUserModel.getConnectionEvents(hours, limit);
      
      res.json({
        success: true,
        data: events,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting connection events API:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil data events'
      });
    }
  }

  // API endpoint untuk alerts
  async getAlertsApi(req, res) {
    try {
      const alerts = await ActiveUserModel.getUnusualActivity();
      
      res.json({
        success: true,
        data: alerts,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting alerts API:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil alerts'
      });
    }
  }

  // API endpoint untuk user activity pattern
  async getUserActivityPatternApi(req, res) {
    try {
      const username = req.params.username;
      const days = parseInt(req.query.days) || 7;
      
      const pattern = await ActiveUserModel.getUserActivityPattern(username, days);
      
      res.json({
        success: true,
        data: pattern,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting user activity pattern API:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil activity pattern'
      });
    }
  }

  // Real-time monitoring page
  async realTimeMonitoringPage(req, res) {
    try {
      const dashboardData = await ActiveUserModel.getDashboardData();
      const alerts = await ActiveUserModel.getUnusualActivity();
      
      res.render('real-time-monitoring', {
        title: 'Real-Time Monitoring',
        user: req.session.user,
        onlineUsers: dashboardData.onlineUsers,
        recentEvents: dashboardData.recentEvents,
        statistics: dashboardData.statistics,
        alerts: alerts,
        error: req.flash('error'),
        success: req.flash('success'),
        currentPage: 'monitoring'
      });
    } catch (error) {
      console.error('Error rendering real-time monitoring page:', error);
      req.flash('error', 'Terjadi kesalahan saat memuat halaman monitoring');
      res.redirect('/dashboard');
    }
  }

  // Enhanced real-time monitoring API with comprehensive radacct data
  async getEnhancedMonitoringApi(req, res) {
    try {
      const realTimeData = await ActiveUserModel.getRealTimeSessionData();
      const networkMetrics = await ActiveUserModel.getNetworkPerformanceMetrics();
      const recentEvents = await ActiveUserModel.getConnectionEventsRealTime(2, 20);
      const advancedAlerts = await ActiveUserModel.getUnusualActivityAdvanced();
      
      res.json({
        success: true,
        data: {
          realTimeSessions: realTimeData,
          networkPerformance: networkMetrics,
          recentEvents: recentEvents,
          alerts: advancedAlerts,
          timestamp: new Date()
        }
      });
    } catch (error) {
      console.error('Error getting enhanced monitoring data:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil data monitoring'
      });
    }
  }

  // Real-time session monitoring API
  async getRealTimeSessionsApi(req, res) {
    try {
      const sessions = await ActiveUserModel.getRealTimeSessionData();
      
      res.json({
        success: true,
        data: sessions,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting real-time sessions:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil data session real-time'
      });
    }
  }

  // Network performance metrics API
  async getNetworkPerformanceApi(req, res) {
    try {
      const metrics = await ActiveUserModel.getNetworkPerformanceMetrics();
      
      res.json({
        success: true,
        data: metrics,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting network performance metrics:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil metrics performance'
      });
    }
  }

  // Enhanced connection events API
  async getConnectionEventsAdvancedApi(req, res) {
    try {
      const hours = parseInt(req.query.hours) || 2;
      const limit = parseInt(req.query.limit) || 50;
      
      const events = await ActiveUserModel.getConnectionEventsRealTime(hours, limit);
      
      res.json({
        success: true,
        data: events,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting advanced connection events:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil connection events'
      });
    }
  }

  // Advanced alerts API
  async getAdvancedAlertsApi(req, res) {
    try {
      const alerts = await ActiveUserModel.getUnusualActivityAdvanced();
      
      res.json({
        success: true,
        data: alerts,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error getting advanced alerts:', error);
      res.status(500).json({
        success: false,
        message: 'Terjadi kesalahan saat mengambil advanced alerts'
      });
    }
  }
}

module.exports = new ActiveUserController();
