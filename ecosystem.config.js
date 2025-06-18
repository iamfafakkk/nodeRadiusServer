module.exports = {
  apps: [{
    name: 'noderadiusserver',
    script: './index.js',
    instances: 1, // Jangan gunakan cluster mode untuk UDP server
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      HTTP_PORT: 3000,
      RADIUS_PORT: 1812
    },
    env_development: {
      NODE_ENV: 'development',
      HTTP_PORT: 3000,
      RADIUS_PORT: 1812
    },
    log_file: './logs/pm2-combined.log',
    out_file: './logs/pm2-out.log',
    error_file: './logs/pm2-error.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    kill_timeout: 5000,
    listen_timeout: 8000,
    // Restart policy
    min_uptime: '10s',
    max_restarts: 10,
    // Monitoring
    pmx: true,
    monitoring: false
  }]
};
