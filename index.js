const express = require('express');
const cors = require('cors');
const session = require('express-session');
const flash = require('connect-flash');
const http = require('http');
require('dotenv').config();

const { testConnection } = require('./config/database');
const { serverLogger } = require('./config/logger');
const RadiusService = require('./services/RadiusService');
const WebSocketService = require('./services/WebSocketService');
const apiRoutes = require('./routes/api');
const adminRoutes = require('./routes/admin');

// Create directories for logs if they don't exist
const fs = require('fs');
const path = require('path');
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

class RadiusServer {
  constructor() {
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.radiusService = null;
    this.webSocketService = null;
    this.httpPort = process.env.HTTP_PORT || 3000;
    this.radiusPort = process.env.RADIUS_PORT || 1812;
    
    this.setupExpress();
  }

  setupExpress() {
    // View engine setup
    this.app.set('view engine', 'ejs');
    this.app.set('views', path.join(__dirname, 'views'));
    
    // Static files
    this.app.use(express.static(path.join(__dirname, 'public')));
    
    // Session configuration
    this.app.use(session({
      secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      }
    }));
    
    // Flash messages
    this.app.use(flash());
    
    // Middleware
    this.app.use(cors());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging middleware
    this.app.use((req, res, next) => {
      serverLogger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
      next();
    });

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          http: 'running',
          radius: this.radiusService ? 'running' : 'stopped',
          database: 'connected' // We'll assume it's connected if the server is running
        }
      });
    });

    // Routes
    this.app.use('/api', apiRoutes);
    this.app.use('/', adminRoutes);

    // Error handling middleware
    this.app.use((err, req, res, next) => {
      serverLogger.error('Express error:', err);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    });

    // 404 handler - only for API routes
    this.app.use('/api/*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'API endpoint not found'
      });
    });
    
    // 404 handler for web routes
    this.app.use('*', (req, res) => {
      res.status(404).render('404', { 
        title: '404 - Halaman Tidak Ditemukan',
        error: '',
        success: ''
      });
    });
  }

  setupRadiusEventListeners() {
    if (!this.radiusService || !this.webSocketService) return;

    // Listen for authentication success events
    this.radiusService.on('auth-success', (authInfo) => {
      serverLogger.info('User authenticated successfully:', {
        username: authInfo.username,
        nasIp: authInfo.nasIp,
        timestamp: authInfo.timestamp
      });
      
      // Broadcast to WebSocket clients
      this.webSocketService.broadcast({
        type: 'auth_success',
        data: authInfo
      });
    });

    // Listen for authentication failures
    this.radiusService.on('auth-failure', (failureInfo) => {
      serverLogger.warn('Authentication failed:', {
        username: failureInfo.username,
        nasIp: failureInfo.nasIp,
        timestamp: failureInfo.timestamp
      });
      
      // Broadcast to WebSocket clients
      this.webSocketService.broadcastAuthFailure(failureInfo);
    });

    // Listen for session start events
    this.radiusService.on('session-start', (sessionInfo) => {
      serverLogger.info('User session started:', {
        username: sessionInfo.username,
        sessionId: sessionInfo.sessionId,
        nasIp: sessionInfo.nasIp,
        nasPort: sessionInfo.nasPort,
        framedIpAddress: sessionInfo.framedIpAddress,
        startTime: sessionInfo.startTime
      });
      
      // Broadcast to WebSocket clients
      this.webSocketService.broadcastUserConnected({
        username: sessionInfo.username,
        sessionId: sessionInfo.sessionId,
        nasIp: sessionInfo.nasIp,
        nasPort: sessionInfo.nasPort,
        framedIp: sessionInfo.framedIpAddress,
        startTime: sessionInfo.startTime
      });
    });

    // Listen for session stop events
    this.radiusService.on('session-stop', (sessionInfo) => {
      serverLogger.info('User session stopped:', {
        username: sessionInfo.username,
        sessionId: sessionInfo.sessionId,
        nasIp: sessionInfo.nasIp,
        sessionTime: sessionInfo.sessionTime,
        inputOctets: sessionInfo.inputOctets,
        outputOctets: sessionInfo.outputOctets,
        terminateCause: sessionInfo.terminateCause,
        stopTime: sessionInfo.stopTime
      });
      
      // Broadcast to WebSocket clients
      this.webSocketService.broadcastUserDisconnected({
        username: sessionInfo.username,
        sessionId: sessionInfo.sessionId,
        nasIp: sessionInfo.nasIp,
        sessionTime: sessionInfo.sessionTime,
        dataUsage: {
          inputOctets: sessionInfo.inputOctets,
          outputOctets: sessionInfo.outputOctets,
          totalBytes: sessionInfo.inputOctets + sessionInfo.outputOctets
        },
        terminateCause: sessionInfo.terminateCause,
        stopTime: sessionInfo.stopTime
      });
    });

    // Listen for session update events
    this.radiusService.on('session-update', (updateInfo) => {
      serverLogger.debug('User session updated:', {
        username: updateInfo.username,
        sessionId: updateInfo.sessionId,
        sessionTime: updateInfo.sessionTime,
        dataUsage: (updateInfo.inputOctets + updateInfo.outputOctets) / 1024 / 1024,
        updateTime: updateInfo.updateTime
      });
      
      // Broadcast to WebSocket clients (throttled to avoid spam)
      this.webSocketService.broadcast({
        type: 'session_update',
        data: updateInfo
      });
    });

    // Listen for RADIUS service events
    this.radiusService.on('started', () => {
      serverLogger.info('RADIUS service started successfully');
    });

    this.radiusService.on('stopped', () => {
      serverLogger.info('RADIUS service stopped');
    });

    this.radiusService.on('error', (error) => {
      serverLogger.error('RADIUS service error:', error);
    });
  }

  async start() {
    try {
      // Test database connection
      serverLogger.info('Testing database connection...');
      const dbConnected = await testConnection();
      
      if (!dbConnected) {
        throw new Error('Database connection failed');
      }

      // Start RADIUS service
      serverLogger.info('Starting RADIUS service...');
      this.radiusService = new RadiusService();
      
      // Set up WebSocket service
      this.webSocketService = new WebSocketService(this.httpServer);
      
      // Set up event listeners for real-time monitoring
      this.setupRadiusEventListeners();
      
      this.radiusService.start(this.radiusPort);

      // Start HTTP server
      this.httpServer.listen(this.httpPort, () => {
        serverLogger.info(`HTTP API server listening on port ${this.httpPort}`);
        serverLogger.info(`RADIUS server listening on port ${this.radiusPort}`);
        serverLogger.info(`WebSocket server enabled at ws://localhost:${this.httpPort}/ws`);
        serverLogger.info('✅ RADIUS Server started successfully');
        
        console.log('\n🚀 RADIUS Server Started!');
        console.log('================================');
        console.log(`📡 RADIUS Auth/Acct: Port ${this.radiusPort}`);
        console.log(`🌐 HTTP API: http://localhost:${this.httpPort}`);
        console.log(`🔌 WebSocket: ws://localhost:${this.httpPort}/ws`);
        console.log(`📚 API Docs: http://localhost:${this.httpPort}/api`);
        console.log(`❤️  Health Check: http://localhost:${this.httpPort}/health`);
        console.log('================================\n');
      });

    } catch (error) {
      serverLogger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async stop() {
    try {
      if (this.radiusService) {
        this.radiusService.stop();
        serverLogger.info('RADIUS service stopped');
      }
      
      serverLogger.info('Server stopped gracefully');
      process.exit(0);
    } catch (error) {
      serverLogger.error('Error stopping server:', error);
      process.exit(1);
    }
  }
}

// Handle graceful shutdown
const server = new RadiusServer();

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down gracefully...');
  server.stop();
});

process.on('SIGINT', () => {
  console.log('\nReceived SIGINT, shutting down gracefully...');
  server.stop();
});

process.on('uncaughtException', (error) => {
  serverLogger.error('Uncaught Exception:', error);
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  serverLogger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// Start the server
if (require.main === module) {
  server.start();
}

module.exports = RadiusServer;
