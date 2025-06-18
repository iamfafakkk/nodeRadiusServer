const WebSocket = require('ws');
const { authLogger } = require('../config/logger');

class WebSocketService {
  constructor(server) {
    this.wss = new WebSocket.Server({ 
      server,
      path: '/ws'
    });
    
    this.clients = new Set();
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, req) => {
      authLogger.info('WebSocket client connected');
      this.clients.add(ws);

      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connection',
        message: 'Connected to RADIUS monitoring service',
        timestamp: new Date()
      }));

      // Handle client messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (error) {
          authLogger.error('Invalid WebSocket message:', error);
        }
      });

      // Handle client disconnect
      ws.on('close', () => {
        authLogger.info('WebSocket client disconnected');
        this.clients.delete(ws);
      });

      // Handle errors
      ws.on('error', (error) => {
        authLogger.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  handleClientMessage(ws, data) {
    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date()
        }));
        break;
        
      case 'subscribe':
        // Handle subscription to specific events
        ws.subscriptions = data.events || [];
        break;
        
      default:
        authLogger.warn('Unknown WebSocket message type:', data.type);
    }
  }

  // Broadcast to all connected clients
  broadcast(data) {
    const message = JSON.stringify({
      ...data,
      timestamp: new Date()
    });

    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(message);
        } catch (error) {
          authLogger.error('Error sending WebSocket message:', error);
          this.clients.delete(client);
        }
      } else {
        this.clients.delete(client);
      }
    });
  }

  // Send user connection event
  broadcastUserConnected(connectionInfo) {
    this.broadcast({
      type: 'user_connected',
      data: connectionInfo
    });
  }

  // Send user disconnection event
  broadcastUserDisconnected(disconnectionInfo) {
    this.broadcast({
      type: 'user_disconnected',
      data: disconnectionInfo
    });
  }

  // Send authentication failure event
  broadcastAuthFailure(failureInfo) {
    this.broadcast({
      type: 'auth_failure',
      data: failureInfo
    });
  }

  // Send statistics update
  broadcastStatistics(stats) {
    this.broadcast({
      type: 'statistics_update',
      data: stats
    });
  }

  // Send alert
  broadcastAlert(alert) {
    this.broadcast({
      type: 'alert',
      data: alert
    });
  }

  // Get number of connected clients
  getClientCount() {
    return this.clients.size;
  }
}

module.exports = WebSocketService;
