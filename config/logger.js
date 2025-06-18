const winston = require('winston');
const path = require('path');

// Konfigurasi format log
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Membuat logger untuk authentication
const authLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  defaultMeta: { service: 'radius-auth' },
  transports: [
    // Log error ke file terpisah
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/error.log'), 
      level: 'error' 
    }),
    // Log semua aktivitas autentikasi
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/auth.log') 
    }),
    // Log ke console untuk development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Logger untuk aktivitas server
const serverLogger = winston.createLogger({
  level: 'debug',
  format: logFormat,
  defaultMeta: { service: 'radius-server' },
  transports: [
    new winston.transports.File({ 
      filename: path.join(__dirname, '../logs/server.log') 
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

module.exports = {
  authLogger,
  serverLogger
};
