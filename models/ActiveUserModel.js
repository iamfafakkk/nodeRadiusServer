const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'radius',
  password: process.env.DB_PASSWORD || 'radiusradius',
  database: process.env.DB_NAME || 'radius',
};

class ActiveUserModel {
  constructor() {
    this.db = null;
  }

  async getConnection() {
    if (!this.db) {
      this.db = await mysql.createConnection(dbConfig);
    }
    return this.db;
  }

  // Get all active users from radacct with comprehensive monitoring data
  async getActiveUsers(page = 1, limit = 20) {
    try {
      const connection = await this.getConnection();
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;
      
      const [users] = await connection.query(`
        SELECT 
          r.radacctid,
          r.username,
          r.nasipaddress,
          r.nasportid,
          r.nasporttype,
          r.acctsessionid,
          r.acctstarttime,
          r.acctstoptime,
          r.acctupdatetime,
          r.acctsessiontime,
          r.acctinputoctets,
          r.acctoutputoctets,
          r.calledstationid,
          r.callingstationid,
          r.framedipaddress,
          r.acctterminatecause,
          
          -- Enhanced status calculation
          CASE 
            WHEN r.acctstoptime IS NULL THEN 'Online'
            WHEN r.acctstoptime > DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 'Recently Offline'
            ELSE 'Offline'
          END as status,
          
          -- Real-time session duration
          CASE 
            WHEN r.acctstoptime IS NULL THEN TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW())
            ELSE r.acctsessiontime
          END as current_session_duration,
          
          -- Data usage calculations
          ROUND((r.acctinputoctets + r.acctoutputoctets) / 1024 / 1024, 3) as total_data_mb,
          ROUND(r.acctinputoctets / 1024 / 1024, 3) as download_mb,
          ROUND(r.acctoutputoctets / 1024 / 1024, 3) as upload_mb,
          
          -- Connection analysis
          CASE 
            WHEN r.acctstoptime IS NULL AND TIMESTAMPDIFF(MINUTE, r.acctstarttime, NOW()) < 5 THEN 'New Connection'
            WHEN r.acctstoptime IS NULL AND TIMESTAMPDIFF(HOUR, r.acctstarttime, NOW()) > 12 THEN 'Long Session'
            WHEN r.acctstoptime IS NULL THEN 'Active'
            WHEN r.acctterminatecause = 'User-Request' THEN 'User Logout'
            WHEN r.acctterminatecause = 'Admin-Reset' THEN 'Admin Disconnect'
            WHEN r.acctterminatecause = 'Session-Timeout' THEN 'Timeout'
            WHEN r.acctterminatecause = 'Idle-Timeout' THEN 'Idle'
            ELSE 'Disconnected'
          END as connection_status,
          
          -- Data usage rate (MB per hour)
          CASE 
            WHEN r.acctstoptime IS NULL AND TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW()) > 0 
            THEN ROUND(((r.acctinputoctets + r.acctoutputoctets) / 1024 / 1024) / 
                 (TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW()) / 3600), 2)
            WHEN r.acctsessiontime > 0 
            THEN ROUND(((r.acctinputoctets + r.acctoutputoctets) / 1024 / 1024) / 
                 (r.acctsessiontime / 3600), 2)
            ELSE 0
          END as data_rate_mb_per_hour,
          
          -- Last activity timestamp
          COALESCE(r.acctupdatetime, r.acctstarttime) as last_activity,
          
          -- Connection quality indicator
          CASE 
            WHEN r.acctstoptime IS NULL AND 
                 TIMESTAMPDIFF(MINUTE, COALESCE(r.acctupdatetime, r.acctstarttime), NOW()) > 10 
            THEN 'Stale'
            WHEN r.acctstoptime IS NULL THEN 'Active'
            ELSE 'Inactive'
          END as connection_quality
          
        FROM radacct r
        INNER JOIN (
          SELECT 
            username,
            MAX(CASE WHEN acctstoptime IS NULL THEN acctstarttime ELSE '1970-01-01' END) as latest_active_start,
            MAX(CASE WHEN acctstoptime IS NOT NULL THEN acctstoptime ELSE '1970-01-01' END) as latest_stop
          FROM radacct 
          WHERE acctstoptime IS NULL OR acctstoptime > DATE_SUB(NOW(), INTERVAL 1 DAY)
          GROUP BY username
        ) latest ON r.username = latest.username 
        AND (
          (r.acctstoptime IS NULL AND r.acctstarttime = latest.latest_active_start) OR
          (r.acctstoptime IS NOT NULL AND r.acctstoptime = latest.latest_stop)
        )
        WHERE r.acctstoptime IS NULL OR r.acctstoptime > DATE_SUB(NOW(), INTERVAL 1 DAY)
        ORDER BY 
          CASE WHEN r.acctstoptime IS NULL THEN 0 ELSE 1 END,
          r.acctstarttime DESC 
        LIMIT ${limitNum} OFFSET ${offset}
      `);

      // Get total count - count unique users instead of total records
      const [countResult] = await connection.query(`
        SELECT COUNT(DISTINCT username) as total 
        FROM radacct 
        WHERE acctstoptime IS NULL OR acctstoptime > DATE_SUB(NOW(), INTERVAL 1 DAY)
      `);

      return {
        users,
        total: countResult[0].total,
        page: pageNum,
        totalPages: Math.ceil(countResult[0].total / limitNum)
      };
    } catch (error) {
      console.error('Error getting active users:', error);
      throw error;
    }
  }

  // Get currently online users with comprehensive real-time data from radacct
  async getOnlineUsers() {
    try {
      const connection = await this.getConnection();
      
      const [users] = await connection.query(`
        SELECT 
          r.radacctid,
          r.username,
          r.acctsessionid,
          r.nasipaddress,
          r.framedipaddress,
          r.nasportid,
          r.nasporttype,
          r.acctstarttime,
          r.acctupdatetime,
          r.calledstationid,
          r.callingstationid,
          
          -- Real-time session calculations
          TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW()) as session_duration_seconds,
          TIMESTAMPDIFF(MINUTE, r.acctstarttime, NOW()) as session_duration_minutes,
          TIME_FORMAT(SEC_TO_TIME(TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW())), '%H:%i:%s') as session_duration_formatted,
          
          -- Data usage metrics
          r.acctinputoctets,
          r.acctoutputoctets,
          ROUND(r.acctinputoctets / 1024 / 1024, 3) as download_mb,
          ROUND(r.acctoutputoctets / 1024 / 1024, 3) as upload_mb,
          ROUND((r.acctinputoctets + r.acctoutputoctets) / 1024 / 1024, 3) as total_data_mb,
          ROUND((r.acctinputoctets + r.acctoutputoctets) / 1024 / 1024 / 1024, 3) as total_data_gb,
          
          -- Data rate calculations (per hour)
          CASE 
            WHEN TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW()) > 0 
            THEN ROUND(((r.acctinputoctets + r.acctoutputoctets) / 1024 / 1024) / 
                 (TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW()) / 3600), 2)
            ELSE 0
          END as data_rate_mb_per_hour,
          
          -- Connection age classification
          CASE 
            WHEN TIMESTAMPDIFF(MINUTE, r.acctstarttime, NOW()) < 5 THEN 'new'
            WHEN TIMESTAMPDIFF(MINUTE, r.acctstarttime, NOW()) < 30 THEN 'recent'
            WHEN TIMESTAMPDIFF(HOUR, r.acctstarttime, NOW()) < 2 THEN 'active'
            WHEN TIMESTAMPDIFF(HOUR, r.acctstarttime, NOW()) < 12 THEN 'established'
            ELSE 'long_session'
          END as connection_age,
          
          -- Activity status based on last update
          CASE 
            WHEN r.acctupdatetime IS NULL THEN 'no_updates'
            WHEN TIMESTAMPDIFF(MINUTE, r.acctupdatetime, NOW()) < 5 THEN 'active'
            WHEN TIMESTAMPDIFF(MINUTE, r.acctupdatetime, NOW()) < 15 THEN 'idle'
            ELSE 'stale'
          END as activity_status,
          
          -- Session quality indicator
          CASE 
            WHEN (r.acctinputoctets + r.acctoutputoctets) = 0 THEN 'no_data'
            WHEN (r.acctinputoctets + r.acctoutputoctets) > 1073741824 THEN 'high_usage'  -- >1GB
            WHEN (r.acctinputoctets + r.acctoutputoctets) > 104857600 THEN 'moderate_usage'  -- >100MB
            ELSE 'low_usage'
          END as usage_category,
          
          -- Time since last activity
          COALESCE(
            TIMESTAMPDIFF(MINUTE, r.acctupdatetime, NOW()),
            TIMESTAMPDIFF(MINUTE, r.acctstarttime, NOW())
          ) as minutes_since_last_activity,
          
          -- Calculate average speed (Kbps)
          CASE 
            WHEN TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW()) > 0 
            THEN ROUND(((r.acctinputoctets + r.acctoutputoctets) * 8) / 
                 TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW()) / 1024, 2)
            ELSE 0
          END as avg_speed_kbps
          
        FROM radacct r
        INNER JOIN (
          SELECT 
            username,
            MAX(acctstarttime) as latest_start
          FROM radacct 
          WHERE acctstoptime IS NULL
          GROUP BY username
        ) latest ON r.username = latest.username AND r.acctstarttime = latest.latest_start
        WHERE r.acctstoptime IS NULL
        ORDER BY 
          CASE 
            WHEN TIMESTAMPDIFF(MINUTE, r.acctstarttime, NOW()) < 5 THEN 1  -- New connections first
            ELSE 2
          END,
          r.acctstarttime DESC
      `);

      return users;
    } catch (error) {
      console.error('Error getting online users:', error);
      throw error;
    }
  }

  // Get connection events (new connections, disconnections, etc.)
  async getConnectionEvents(hours = 24, limit = 100) {
    try {
      const connection = await this.getConnection();
      
      // Get recent connections (Start events)
      const [connections] = await connection.query(`
        SELECT 
          'connection' as event_type,
          username,
          nasipaddress,
          framedipaddress,
          acctstarttime as event_time,
          acctsessiontime,
          ROUND((acctinputoctets + acctoutputoctets) / 1024 / 1024, 2) as data_mb,
          'User connected' as description
        FROM radacct 
        WHERE acctstarttime >= DATE_SUB(NOW(), INTERVAL ${hours} HOUR)
        
        UNION ALL
        
        SELECT 
          'disconnection' as event_type,
          username,
          nasipaddress,
          framedipaddress,
          acctstoptime as event_time,
          acctsessiontime,
          ROUND((acctinputoctets + acctoutputoctets) / 1024 / 1024, 2) as data_mb,
          CONCAT('User disconnected: ', COALESCE(acctterminatecause, 'Unknown reason')) as description
        FROM radacct 
        WHERE acctstoptime >= DATE_SUB(NOW(), INTERVAL ${hours} HOUR)
          AND acctstoptime IS NOT NULL
        
        ORDER BY event_time DESC
        LIMIT ${limit}
      `);

      return connections;
    } catch (error) {
      console.error('Error getting connection events:', error);
      throw error;
    }
  }

  // Enhanced statistics with comprehensive radacct analysis
  async getStatistics() {
    try {
      const connection = await this.getConnection();
      
      // Current online users with detailed breakdown
      const [onlineStats] = await connection.query(`
        SELECT 
          COUNT(*) as total_online,
          COUNT(CASE WHEN TIMESTAMPDIFF(MINUTE, acctstarttime, NOW()) < 5 THEN 1 END) as new_connections,
          COUNT(CASE WHEN TIMESTAMPDIFF(HOUR, acctstarttime, NOW()) > 12 THEN 1 END) as long_sessions,
          COUNT(CASE WHEN (acctinputoctets + acctoutputoctets) > 1073741824 THEN 1 END) as high_usage_users,
          ROUND(AVG(TIMESTAMPDIFF(SECOND, acctstarttime, NOW())) / 60, 2) as avg_session_minutes,
          ROUND(SUM(acctinputoctets + acctoutputoctets) / 1024 / 1024, 2) as total_current_usage_mb
        FROM radacct 
        WHERE acctstoptime IS NULL
      `);

      // Today's comprehensive statistics
      const [todayStats] = await connection.query(`
        SELECT 
          COUNT(*) as total_sessions,
          COUNT(DISTINCT username) as unique_users,
          ROUND(SUM(acctinputoctets + acctoutputoctets) / 1024 / 1024, 2) as total_data_mb,
          ROUND(SUM(acctinputoctets) / 1024 / 1024, 2) as total_download_mb,
          ROUND(SUM(acctoutputoctets) / 1024 / 1024, 2) as total_upload_mb,
          ROUND(AVG(acctsessiontime) / 60, 2) as avg_session_minutes,
          MAX(acctsessiontime) as longest_session_seconds,
          COUNT(CASE WHEN acctsessiontime < 60 THEN 1 END) as short_sessions,
          COUNT(CASE WHEN acctterminatecause = 'User-Request' THEN 1 END) as user_logouts,
          COUNT(CASE WHEN acctterminatecause = 'Admin-Reset' THEN 1 END) as admin_disconnects,
          COUNT(CASE WHEN acctterminatecause LIKE '%Timeout%' THEN 1 END) as timeout_disconnects
        FROM radacct 
        WHERE DATE(acctstarttime) = CURDATE()
      `);

      // Hourly analysis for today
      const [hourlyPeak] = await connection.query(`
        SELECT 
          HOUR(acctstarttime) as peak_hour,
          COUNT(*) as peak_connections,
          ROUND(SUM(acctinputoctets + acctoutputoctets) / 1024 / 1024, 2) as peak_data_mb
        FROM radacct 
        WHERE DATE(acctstarttime) = CURDATE()
        GROUP BY HOUR(acctstarttime)
        ORDER BY peak_connections DESC
        LIMIT 1
      `);

      // Recent connections (last hour)
      const [recentConnections] = await connection.query(`
        SELECT 
          COUNT(*) as connections_last_hour,
          COUNT(CASE WHEN acctstoptime IS NULL THEN 1 END) as still_online,
          ROUND(AVG(TIMESTAMPDIFF(SECOND, acctstarttime, 
            COALESCE(acctstoptime, NOW()))) / 60, 2) as avg_duration_minutes
        FROM radacct 
        WHERE acctstarttime >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `);

      // Authentication failures (estimated from very short sessions)
      const [authFailures] = await connection.query(`
        SELECT 
          COUNT(*) as potential_auth_failures
        FROM radacct 
        WHERE DATE(acctstarttime) = CURDATE()
          AND acctsessiontime < 30
          AND acctterminatecause IS NOT NULL
          AND (acctinputoctets + acctoutputoctets) = 0
      `);

      // Top NAS by activity
      const [topNas] = await connection.query(`
        SELECT 
          nasipaddress,
          COUNT(*) as total_sessions,
          COUNT(CASE WHEN acctstoptime IS NULL THEN 1 END) as current_online,
          ROUND(SUM(acctinputoctets + acctoutputoctets) / 1024 / 1024, 2) as total_data_mb
        FROM radacct 
        WHERE DATE(acctstarttime) = CURDATE()
        GROUP BY nasipaddress
        ORDER BY total_sessions DESC
        LIMIT 1
      `);

      // Data usage trends
      const [dataUsage] = await connection.query(`
        SELECT 
          ROUND(SUM(CASE WHEN DATE(acctstarttime) = CURDATE() 
            THEN acctinputoctets + acctoutputoctets ELSE 0 END) / 1024 / 1024, 2) as today_mb,
          ROUND(SUM(CASE WHEN DATE(acctstarttime) = DATE_SUB(CURDATE(), INTERVAL 1 DAY) 
            THEN acctinputoctets + acctoutputoctets ELSE 0 END) / 1024 / 1024, 2) as yesterday_mb,
          ROUND(SUM(CASE WHEN acctstarttime >= DATE_SUB(NOW(), INTERVAL 7 DAY) 
            THEN acctinputoctets + acctoutputoctets ELSE 0 END) / 1024 / 1024, 2) as week_mb
        FROM radacct
      `);

      return {
        // Current status
        onlineUsers: onlineStats[0].total_online || 0,
        newConnectionsLastHour: recentConnections[0].connections_last_hour || 0,
        newConnectionsLast5Min: onlineStats[0].new_connections || 0,
        longSessions: onlineStats[0].long_sessions || 0,
        highUsageUsers: onlineStats[0].high_usage_users || 0,
        
        // Today's statistics
        todaySessions: todayStats[0].total_sessions || 0,
        todayUniqueUsers: todayStats[0].unique_users || 0,
        todayUsageMB: todayStats[0].total_data_mb || 0,
        todayDownloadMB: todayStats[0].total_download_mb || 0,
        todayUploadMB: todayStats[0].total_upload_mb || 0,
        
        // Session analytics
        avgSessionMinutes: todayStats[0].avg_session_minutes || 0,
        longestSessionMinutes: Math.round((todayStats[0].longest_session_seconds || 0) / 60),
        shortSessionsCount: todayStats[0].short_sessions || 0,
        
        // Disconnect reasons
        userLogouts: todayStats[0].user_logouts || 0,
        adminDisconnects: todayStats[0].admin_disconnects || 0,
        timeoutDisconnects: todayStats[0].timeout_disconnects || 0,
        authFailuresToday: authFailures[0].potential_auth_failures || 0,
        
        // Peak analysis
        peakHour: hourlyPeak[0]?.peak_hour || null,
        peakConnections: hourlyPeak[0]?.peak_connections || 0,
        peakDataMB: hourlyPeak[0]?.peak_data_mb || 0,
        
        // Network activity
        mostActiveNas: topNas[0] || null,
        stillOnlineFromLastHour: recentConnections[0].still_online || 0,
        
        // Data trends
        currentUsageMB: onlineStats[0].total_current_usage_mb || 0,
        yesterdayUsageMB: dataUsage[0].yesterday_mb || 0,
        weekUsageMB: dataUsage[0].week_mb || 0,
        
        // Quality metrics
        avgRecentSessionMinutes: recentConnections[0].avg_duration_minutes || 0,
        avgCurrentSessionMinutes: onlineStats[0].avg_session_minutes || 0
      };
    } catch (error) {
      console.error('Error getting enhanced statistics:', error);
      throw error;
    }
  }

  // Get real-time dashboard data
  async getDashboardData() {
    try {
      const connection = await this.getConnection();
      
      // Get online users with location info
      const [onlineUsers] = await connection.query(`
        SELECT 
          username,
          nasipaddress,
          framedipaddress,
          acctstarttime,
          TIMESTAMPDIFF(SECOND, acctstarttime, NOW()) as session_duration,
          ROUND((acctinputoctets + acctoutputoctets) / 1024 / 1024, 2) as data_mb
        FROM radacct 
        WHERE acctstoptime IS NULL
        ORDER BY acctstarttime DESC
        LIMIT 10
      `);

      // Get recent events
      const events = await this.getConnectionEvents(2, 20);
      
      // Get statistics
      const stats = await this.getStatistics();

      return {
        onlineUsers,
        recentEvents: events,
        statistics: stats
      };
    } catch (error) {
      console.error('Error getting dashboard data:', error);
      throw error;
    }
  }

  // Monitor user activity patterns  
  async getUserActivityPattern(username) {
    try {
      const connection = await this.getConnection();
      
      // Get basic statistics
      const [basicStats] = await connection.query(`
        SELECT 
          COUNT(*) as totalSessions,
          COUNT(CASE WHEN acctstoptime IS NULL THEN 1 END) as activeSessions,
          SUM(CASE WHEN acctstoptime IS NULL THEN TIMESTAMPDIFF(SECOND, acctstarttime, NOW()) ELSE acctsessiontime END) as totalTime,
          SUM(acctinputoctets + acctoutputoctets) as totalBytes,
          AVG(CASE WHEN acctsessiontime > 0 THEN acctsessiontime END) as avgSessionTime,
          MAX(acctstarttime) as lastLogin,
          MIN(acctstarttime) as firstLogin
        FROM radacct 
        WHERE username = ?
      `, [username]);
      
      const stats = basicStats[0];
      
      // Format total time
      const totalSeconds = stats.totalTime || 0;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      stats.totalTimeFormatted = `${hours}h ${minutes}m`;
      
      // Format average session time
      const avgSeconds = stats.avgSessionTime || 0;
      const avgHours = Math.floor(avgSeconds / 3600);
      const avgMinutes = Math.floor((avgSeconds % 3600) / 60);
      stats.avgSessionTimeFormatted = `${avgHours}h ${avgMinutes}m`;
      
      // Format total data
      const totalMB = (stats.totalBytes || 0) / 1024 / 1024;
      stats.totalDataFormatted = totalMB > 1024 ? 
        `${(totalMB / 1024).toFixed(2)} GB` : 
        `${totalMB.toFixed(2)} MB`;
      
      // Get hourly distribution
      const [hourlyPattern] = await connection.query(`
        SELECT 
          HOUR(acctstarttime) as hour,
          COUNT(*) as session_count,
          SUM(CASE WHEN acctstoptime IS NULL THEN TIMESTAMPDIFF(SECOND, acctstarttime, NOW()) ELSE acctsessiontime END) as total_time
        FROM radacct 
        WHERE username = ? 
        GROUP BY HOUR(acctstarttime)
        ORDER BY hour
      `, [username]);
      
      // Get daily pattern (last 30 days)
      const [dailyPattern] = await connection.query(`
        SELECT 
          DATE(acctstarttime) as date,
          COUNT(*) as session_count,
          SUM(CASE WHEN acctstoptime IS NULL THEN TIMESTAMPDIFF(SECOND, acctstarttime, NOW()) ELSE acctsessiontime END) as total_time,
          SUM(acctinputoctets + acctoutputoctets) as total_bytes
        FROM radacct 
        WHERE username = ? AND acctstarttime >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        GROUP BY DATE(acctstarttime)
        ORDER BY date DESC
      `, [username]);
      
      // Get NAS usage pattern
      const [nasPattern] = await connection.query(`
        SELECT 
          nasipaddress,
          COUNT(*) as session_count,
          SUM(CASE WHEN acctstoptime IS NULL THEN TIMESTAMPDIFF(SECOND, acctstarttime, NOW()) ELSE acctsessiontime END) as total_time
        FROM radacct 
        WHERE username = ?
        GROUP BY nasipaddress
        ORDER BY session_count DESC
      `, [username]);

      return {
        stats,
        hourlyPattern,
        dailyPattern,
        nasPattern
      };
    } catch (error) {
      console.error('Error getting user activity pattern:', error);
      throw error;
    }
  }

  // Get user sessions with pagination
  async getUserSessions(username, page = 1, limit = 10) {
    try {
      const connection = await this.getConnection();
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;
      
      // Get total count
      const [countResult] = await connection.query(
        'SELECT COUNT(*) as total FROM radacct WHERE username = ?',
        [username]
      );
      const totalSessions = countResult[0].total;
      const totalPages = Math.ceil(totalSessions / limitNum);
      
      // Get sessions with details
      const [sessions] = await connection.query(`
        SELECT 
          radacctid,
          username,
          nasipaddress,
          nasportid,
          acctsessionid,
          acctstarttime,
          acctstoptime,
          acctsessiontime,
          acctinputoctets,
          acctoutputoctets,
          framedipaddress,
          acctterminatecause,
          calledstationid,
          callingstationid,
          
          -- Calculate data usage
          ROUND((acctinputoctets + acctoutputoctets) / 1024 / 1024, 2) as total_data_mb,
          ROUND(acctinputoctets / 1024 / 1024, 2) as download_mb,
          ROUND(acctoutputoctets / 1024 / 1024, 2) as upload_mb,
          
          -- Session status
          CASE 
            WHEN acctstoptime IS NULL THEN 'Active'
            WHEN acctterminatecause = 'User-Request' THEN 'User Logout'
            WHEN acctterminatecause = 'Admin-Reset' THEN 'Admin Disconnect'
            WHEN acctterminatecause = 'Session-Timeout' THEN 'Session Timeout'
            WHEN acctterminatecause = 'Idle-Timeout' THEN 'Idle Timeout'
            ELSE 'Disconnected'
          END as session_status,
          
          -- Real-time duration for active sessions
          CASE 
            WHEN acctstoptime IS NULL THEN TIMESTAMPDIFF(SECOND, acctstarttime, NOW())
            ELSE acctsessiontime
          END as current_duration,
          
          -- Format duration display
          CASE 
            WHEN acctstoptime IS NULL THEN 
              CONCAT(
                FLOOR(TIMESTAMPDIFF(SECOND, acctstarttime, NOW()) / 3600), 'h ',
                FLOOR((TIMESTAMPDIFF(SECOND, acctstarttime, NOW()) % 3600) / 60), 'm'
              )
            ELSE 
              CONCAT(
                FLOOR(acctsessiontime / 3600), 'h ',
                FLOOR((acctsessiontime % 3600) / 60), 'm'
              )
          END as duration_display
          
        FROM radacct 
        WHERE username = ? 
        ORDER BY acctstarttime DESC 
        LIMIT ? OFFSET ?
      `, [username, limitNum, offset]);
      
      return {
        sessions,
        page: pageNum,
        totalPages,
        totalSessions,
        hasNext: pageNum < totalPages,
        hasPrev: pageNum > 1
      };
    } catch (error) {
      console.error('Error getting user sessions:', error);
      throw error;
    }
  }

  // Disconnect a user session
  async disconnectUser(radacctid) {
    try {
      const connection = await this.getConnection();
      
      // First check if the session exists and is still active
      const [sessions] = await connection.query(`
        SELECT radacctid, username, acctstarttime, acctstoptime
        FROM radacct 
        WHERE radacctid = ? AND acctstoptime IS NULL
      `, [radacctid]);

      if (sessions.length === 0) {
        console.log('Session not found or already disconnected:', radacctid);
        return false;
      }

      const session = sessions[0];
      
      // Update the session to mark it as disconnected
      const [result] = await connection.execute(`
        UPDATE radacct 
        SET 
          acctstoptime = NOW(),
          acctsessiontime = TIMESTAMPDIFF(SECOND, acctstarttime, NOW()),
          acctterminatecause = 'Admin-Reset'
        WHERE radacctid = ? AND acctstoptime IS NULL
      `, [radacctid]);

      if (result.affectedRows > 0) {
        console.log(`Successfully disconnected user ${session.username} (radacctid: ${radacctid})`);
        return true;
      } else {
        console.log('No rows affected during disconnect');
        return false;
      }
    } catch (error) {
      console.error('Error disconnecting user:', error);
      throw error;
    }
  }

  // Alert system for unusual activity
  async getUnusualActivity() {
    try {
      const connection = await this.getConnection();
      
      const alerts = [];

      // Check for users with unusually long sessions (> 12 hours)
      const [longSessions] = await connection.query(`
        SELECT username, acctstarttime, TIMESTAMPDIFF(HOUR, acctstarttime, NOW()) as hours
        FROM radacct 
        WHERE acctstoptime IS NULL 
          AND TIMESTAMPDIFF(HOUR, acctstarttime, NOW()) > 12
      `);

      longSessions.forEach(session => {
        alerts.push({
          type: 'long_session',
          severity: 'warning',
          username: session.username,
          message: `User has been online for ${session.hours} hours`,
          timestamp: new Date()
        });
      });

      // Check for high data usage (> 1GB per session)
      const [highUsage] = await connection.query(`
        SELECT username, ROUND((acctinputoctets + acctoutputoctets) / 1024 / 1024 / 1024, 2) as gb
        FROM radacct 
        WHERE acctstoptime IS NULL 
          AND (acctinputoctets + acctoutputoctets) > 1073741824
      `);

      highUsage.forEach(usage => {
        alerts.push({
          type: 'high_data_usage',
          severity: 'info',
          username: usage.username,
          message: `User has used ${usage.gb} GB in current session`,
          timestamp: new Date()
        });
      });

      // Check for multiple simultaneous sessions
      const [multiSessions] = await connection.query(`
        SELECT username, COUNT(*) as session_count
        FROM radacct 
        WHERE acctstoptime IS NULL
        GROUP BY username
        HAVING COUNT(*) > 1
      `);

      multiSessions.forEach(multi => {
        alerts.push({
          type: 'multiple_sessions',
          severity: 'warning',
          username: multi.username,
          message: `User has ${multi.session_count} simultaneous sessions`,
          timestamp: new Date()
        });
      });

      return alerts;
    } catch (error) {
      console.error('Error getting unusual activity:', error);
      throw error;
    }
  }

  // Real-time session monitoring with radacct optimization
  async getRealTimeSessionData() {
    try {
      const connection = await this.getConnection();
      
      const [sessionData] = await connection.query(`
        SELECT 
          r.username,
          r.acctsessionid,
          r.nasipaddress,
          r.framedipaddress,
          r.acctstarttime,
          
          -- Real-time calculations
          TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW()) as live_duration_seconds,
          ROUND(TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW()) / 60, 1) as live_duration_minutes,
          
          -- Current data usage
          ROUND(r.acctinputoctets / 1024 / 1024, 2) as current_download_mb,
          ROUND(r.acctoutputoctets / 1024 / 1024, 2) as current_upload_mb,
          ROUND((r.acctinputoctets + r.acctoutputoctets) / 1024 / 1024, 2) as current_total_mb,
          
          -- Real-time speed calculations (last update basis)
          CASE 
            WHEN r.acctupdatetime IS NOT NULL AND TIMESTAMPDIFF(SECOND, r.acctupdatetime, NOW()) > 0
            THEN ROUND(((r.acctinputoctets + r.acctoutputoctets) * 8) / 
                 TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW()) / 1024, 2)
            ELSE 0
          END as current_speed_kbps,
          
          -- Session health indicators
          CASE 
            WHEN r.acctupdatetime IS NULL THEN 'No Updates'
            WHEN TIMESTAMPDIFF(MINUTE, r.acctupdatetime, NOW()) > 10 THEN 'Stale'
            WHEN TIMESTAMPDIFF(MINUTE, r.acctupdatetime, NOW()) > 5 THEN 'Idle'
            ELSE 'Active'
          END as session_health,
          
          -- Activity level
          CASE 
            WHEN (r.acctinputoctets + r.acctoutputoctets) = 0 THEN 'No Data'
            WHEN (r.acctinputoctets + r.acctoutputoctets) > 1073741824 THEN 'Heavy User'
            WHEN (r.acctinputoctets + r.acctoutputoctets) > 104857600 THEN 'Active User'
            ELSE 'Light User'
          END as usage_profile,
          
          -- Time-based classifications
          CASE 
            WHEN TIMESTAMPDIFF(HOUR, r.acctstarttime, NOW()) > 24 THEN 'Very Long'
            WHEN TIMESTAMPDIFF(HOUR, r.acctstarttime, NOW()) > 12 THEN 'Long Session'
            WHEN TIMESTAMPDIFF(HOUR, r.acctstarttime, NOW()) > 2 THEN 'Extended'
            WHEN TIMESTAMPDIFF(MINUTE, r.acctstarttime, NOW()) > 30 THEN 'Normal'
            ELSE 'New Session'
          END as session_length_category,
          
          r.acctupdatetime,
          COALESCE(TIMESTAMPDIFF(MINUTE, r.acctupdatetime, NOW()), 0) as minutes_since_update
          
        FROM radacct r
        WHERE r.acctstoptime IS NULL
        ORDER BY r.acctstarttime DESC
        LIMIT 100
      `);

      return sessionData;
    } catch (error) {
      console.error('Error getting real-time session data:', error);
      throw error;
    }
  }

  // Monitor connection events in real-time from radacct
  async getConnectionEventsRealTime(hours = 2, limit = 50) {
    try {
      const connection = await this.getConnection();
      
      const [events] = await connection.query(`
        SELECT 
          'start' as event_type,
          r.username,
          r.nasipaddress,
          r.framedipaddress,
          r.acctstarttime as event_time,
          r.acctsessionid,
          'User connected to network' as description,
          r.calledstationid,
          r.callingstationid,
          NULL as session_duration,
          NULL as data_usage_mb,
          'success' as event_status
        FROM radacct r
        WHERE r.acctstarttime >= DATE_SUB(NOW(), INTERVAL ${hours} HOUR)
        
        UNION ALL
        
        SELECT 
          'stop' as event_type,
          r.username,
          r.nasipaddress,
          r.framedipaddress,
          r.acctstoptime as event_time,
          r.acctsessionid,
          CONCAT('User disconnected - ', COALESCE(r.acctterminatecause, 'Unknown reason')) as description,
          r.calledstationid,
          r.callingstationid,
          r.acctsessiontime as session_duration,
          ROUND((r.acctinputoctets + r.acctoutputoctets) / 1024 / 1024, 2) as data_usage_mb,
          CASE 
            WHEN r.acctterminatecause = 'User-Request' THEN 'normal'
            WHEN r.acctterminatecause = 'Admin-Reset' THEN 'admin_action'
            WHEN r.acctterminatecause LIKE '%Timeout%' THEN 'timeout'
            ELSE 'error'
          END as event_status
        FROM radacct r
        WHERE r.acctstoptime >= DATE_SUB(NOW(), INTERVAL ${hours} HOUR)
          AND r.acctstoptime IS NOT NULL
        
        ORDER BY event_time DESC
        LIMIT ${limit}
      `);

      return events;
    } catch (error) {
      console.error('Error getting real-time connection events:', error);
      throw error;
    }
  }

  // Enhanced unusual activity detection using radacct
  async getUnusualActivityAdvanced() {
    try {
      const connection = await this.getConnection();
      
      const alerts = [];

      // Multiple simultaneous sessions per user
      const [multiSessions] = await connection.query(`
        SELECT 
          username, 
          COUNT(*) as session_count,
          GROUP_CONCAT(DISTINCT nasipaddress) as nas_list,
          GROUP_CONCAT(DISTINCT framedipaddress) as ip_list
        FROM radacct 
        WHERE acctstoptime IS NULL
        GROUP BY username
        HAVING COUNT(*) > 1
      `);

      multiSessions.forEach(session => {
        alerts.push({
          type: 'multiple_sessions',
          severity: 'warning',
          username: session.username,
          message: `User has ${session.session_count} simultaneous sessions across NAS: ${session.nas_list}`,
          details: {
            sessionCount: session.session_count,
            nasList: session.nas_list,
            ipList: session.ip_list
          },
          timestamp: new Date()
        });
      });

      // Extremely long sessions (>24 hours)
      const [longSessions] = await connection.query(`
        SELECT 
          username, 
          acctstarttime,
          nasipaddress,
          TIMESTAMPDIFF(HOUR, acctstarttime, NOW()) as hours_online,
          ROUND((acctinputoctets + acctoutputoctets) / 1024 / 1024, 2) as data_mb
        FROM radacct 
        WHERE acctstoptime IS NULL 
          AND TIMESTAMPDIFF(HOUR, acctstarttime, NOW()) > 24
      `);

      longSessions.forEach(session => {
        alerts.push({
          type: 'very_long_session',
          severity: 'critical',
          username: session.username,
          message: `User has been online for ${session.hours_online} hours (${session.data_mb} MB used)`,
          details: {
            hoursOnline: session.hours_online,
            startTime: session.acctstarttime,
            nasIp: session.nasipaddress,
            dataMB: session.data_mb
          },
          timestamp: new Date()
        });
      });

      // Excessive data usage (>5GB per session)
      const [heavyUsage] = await connection.query(`
        SELECT 
          username, 
          ROUND((acctinputoctets + acctoutputoctets) / 1024 / 1024 / 1024, 2) as gb_used,
          ROUND(acctinputoctets / 1024 / 1024 / 1024, 2) as gb_downloaded,
          ROUND(acctoutputoctets / 1024 / 1024 / 1024, 2) as gb_uploaded,
          TIMESTAMPDIFF(HOUR, acctstarttime, NOW()) as hours_online,
          nasipaddress
        FROM radacct 
        WHERE acctstoptime IS NULL 
          AND (acctinputoctets + acctoutputoctets) > 5368709120  -- >5GB
      `);

      heavyUsage.forEach(usage => {
        alerts.push({
          type: 'excessive_data_usage',
          severity: 'warning',
          username: usage.username,
          message: `User has used ${usage.gb_used} GB in ${usage.hours_online} hours (${usage.gb_downloaded}GB down, ${usage.gb_uploaded}GB up)`,
          details: {
            totalGB: usage.gb_used,
            downloadGB: usage.gb_downloaded,
            uploadGB: usage.gb_uploaded,
            hoursOnline: usage.hours_online,
            nasIp: usage.nasipaddress
          },
          timestamp: new Date()
        });
      });

      // Stale sessions (no updates for >30 minutes)
      const [staleSessions] = await connection.query(`
        SELECT 
          username,
          acctstarttime,
          acctupdatetime,
          TIMESTAMPDIFF(MINUTE, COALESCE(acctupdatetime, acctstarttime), NOW()) as minutes_stale,
          nasipaddress
        FROM radacct 
        WHERE acctstoptime IS NULL 
          AND TIMESTAMPDIFF(MINUTE, COALESCE(acctupdatetime, acctstarttime), NOW()) > 30
      `);

      staleSessions.forEach(session => {
        alerts.push({
          type: 'stale_session',
          severity: 'info',
          username: session.username,
          message: `Session appears stale - no updates for ${session.minutes_stale} minutes`,
          details: {
            minutesStale: session.minutes_stale,
            lastUpdate: session.acctupdatetime,
            startTime: session.acctstarttime,
            nasIp: session.nasipaddress
          },
          timestamp: new Date()
        });
      });

      // Rapid reconnections (same user connecting multiple times in short period)
      const [rapidReconnects] = await connection.query(`
        SELECT 
          username,
          COUNT(*) as connection_count,
          MIN(acctstarttime) as first_connection,
          MAX(acctstarttime) as last_connection,
          COUNT(DISTINCT nasipaddress) as different_nas_count
        FROM radacct 
        WHERE acctstarttime >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
        GROUP BY username
        HAVING COUNT(*) > 3
      `);

      rapidReconnects.forEach(reconnect => {
        alerts.push({
          type: 'rapid_reconnections',
          severity: 'warning',
          username: reconnect.username,
          message: `User has connected ${reconnect.connection_count} times in the last hour`,
          details: {
            connectionCount: reconnect.connection_count,
            firstConnection: reconnect.first_connection,
            lastConnection: reconnect.last_connection,
            differentNasCount: reconnect.different_nas_count
          },
          timestamp: new Date()
        });
      });

      return alerts;
    } catch (error) {
      console.error('Error getting advanced unusual activity:', error);
      throw error;
    }
  }

  // Network performance analysis from radacct data
  async getNetworkPerformanceMetrics() {
    try {
      const connection = await this.getConnection();
      
      const [metrics] = await connection.query(`
        SELECT 
          -- Overall network metrics
          COUNT(CASE WHEN acctstoptime IS NULL THEN 1 END) as current_active_sessions,
          ROUND(AVG(CASE WHEN acctstoptime IS NULL 
            THEN TIMESTAMPDIFF(SECOND, acctstarttime, NOW()) 
            ELSE acctsessiontime END) / 60, 2) as avg_session_duration_minutes,
          
          -- Data throughput metrics
          ROUND(SUM(CASE WHEN acctstoptime IS NULL 
            THEN acctinputoctets + acctoutputoctets ELSE 0 END) / 1024 / 1024, 2) as current_total_data_mb,
          ROUND(AVG(CASE WHEN acctstoptime IS NULL AND TIMESTAMPDIFF(SECOND, acctstarttime, NOW()) > 0
            THEN ((acctinputoctets + acctoutputoctets) * 8) / TIMESTAMPDIFF(SECOND, acctstarttime, NOW()) / 1024
            ELSE 0 END), 2) as avg_current_speed_kbps,
          
          -- Session quality metrics
          COUNT(CASE WHEN acctstoptime IS NULL AND acctupdatetime IS NULL THEN 1 END) as sessions_no_updates,
          COUNT(CASE WHEN acctstoptime IS NULL AND 
            TIMESTAMPDIFF(MINUTE, COALESCE(acctupdatetime, acctstarttime), NOW()) > 10 THEN 1 END) as stale_sessions,
          
          -- Today's performance
          COUNT(CASE WHEN DATE(acctstarttime) = CURDATE() THEN 1 END) as todays_total_sessions,
          ROUND(SUM(CASE WHEN DATE(acctstarttime) = CURDATE() 
            THEN acctinputoctets + acctoutputoctets ELSE 0 END) / 1024 / 1024, 2) as todays_total_data_mb,
          
          -- Disconnect analysis
          COUNT(CASE WHEN DATE(acctstarttime) = CURDATE() AND acctterminatecause = 'User-Request' THEN 1 END) as normal_disconnects,
          COUNT(CASE WHEN DATE(acctstarttime) = CURDATE() AND acctterminatecause LIKE '%Timeout%' THEN 1 END) as timeout_disconnects,
          COUNT(CASE WHEN DATE(acctstarttime) = CURDATE() AND acctsessiontime < 60 THEN 1 END) as very_short_sessions
          
        FROM radacct 
        WHERE acctstarttime >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      // NAS performance breakdown
      const [nasMetrics] = await connection.query(`
        SELECT 
          nasipaddress,
          COUNT(CASE WHEN acctstoptime IS NULL THEN 1 END) as current_users,
          COUNT(*) as total_sessions_today,
          ROUND(SUM(acctinputoctets + acctoutputoctets) / 1024 / 1024, 2) as total_data_mb,
          ROUND(AVG(acctsessiontime) / 60, 2) as avg_session_minutes,
          COUNT(CASE WHEN acctterminatecause LIKE '%Timeout%' THEN 1 END) as timeout_count,
          COUNT(CASE WHEN acctsessiontime < 60 THEN 1 END) as short_session_count
        FROM radacct 
        WHERE DATE(acctstarttime) = CURDATE()
        GROUP BY nasipaddress
        ORDER BY current_users DESC
      `);

      return {
        overall: metrics[0],
        nasList: nasMetrics
      };
    } catch (error) {
      console.error('Error getting network performance metrics:', error);
      throw error;
    }
  }

  // Get comparison between radcheck users and their online status
  async getUserStatusComparison(page = 1, limit = 20, search = '', filter = 'all') {
    try {
      const connection = await this.getConnection();
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;

      // Build search and filter conditions
      let conditions = [];
      let searchParams = [];
      
      if (search) {
        conditions.push('rc.username LIKE ?');
        searchParams.push(`%${search}%`);
      }

      // Add filter conditions
      if (filter === 'online') {
        conditions.push('latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL');
      } else if (filter === 'offline') {
        conditions.push('(latest_session.acctstoptime IS NOT NULL OR latest_session.acctstarttime IS NULL)');
      }

      const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

      // Get all users from radcheck with their online status (latest session only)
      const [users] = await connection.query(`
        SELECT 
          rc.username,
          rc.attribute,
          rc.value as password,
          rc.created_at as user_created,
          
          -- Online status from latest session
          CASE 
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL THEN 'Online'
            ELSE 'Offline'
          END as status,
          
          -- Session details from latest session
          latest_session.radacctid,
          latest_session.acctsessionid,
          latest_session.nasipaddress,
          latest_session.framedipaddress,
          latest_session.acctstarttime,
          latest_session.acctupdatetime,
          latest_session.acctstoptime,
          latest_session.calledstationid,
          latest_session.callingstationid,
          
          -- Session duration
          CASE 
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL THEN 
              TIME_FORMAT(SEC_TO_TIME(TIMESTAMPDIFF(SECOND, latest_session.acctstarttime, NOW())), '%H:%i:%s')
            ELSE NULL
          END as session_duration,
          
          -- Data usage from latest session
          CASE 
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL THEN 
              ROUND((latest_session.acctinputoctets + latest_session.acctoutputoctets) / 1024 / 1024, 3)
            ELSE NULL
          END as total_data_mb,
          
          CASE 
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL THEN 
              ROUND(latest_session.acctinputoctets / 1024 / 1024, 3)
            ELSE NULL
          END as download_mb,
          
          CASE 
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL THEN 
              ROUND(latest_session.acctoutputoctets / 1024 / 1024, 3)
            ELSE NULL
          END as upload_mb,
          
          -- Last seen information (from latest session)
          CASE 
            WHEN latest_session.acctstoptime IS NOT NULL THEN 
              latest_session.acctstoptime
            WHEN latest_session.acctstarttime IS NOT NULL THEN
              latest_session.acctstarttime
            ELSE NULL
          END as last_seen,
          
          -- Connection quality
          CASE 
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL AND
                 TIMESTAMPDIFF(MINUTE, COALESCE(latest_session.acctupdatetime, latest_session.acctstarttime), NOW()) > 10 
            THEN 'Stale'
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL THEN 'Active'
            ELSE 'Disconnected'
          END as connection_quality,
          
          -- Activity status
          CASE 
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL AND latest_session.acctupdatetime IS NULL THEN 'No Updates'
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL AND TIMESTAMPDIFF(MINUTE, latest_session.acctupdatetime, NOW()) < 5 THEN 'Active'
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL AND TIMESTAMPDIFF(MINUTE, latest_session.acctupdatetime, NOW()) < 15 THEN 'Idle'
            WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL THEN 'Stale'
            ELSE 'Offline'
          END as activity_status
          
        FROM radcheck rc
        LEFT JOIN (
          SELECT *
          FROM radacct ra1
          WHERE ra1.acctstarttime = (
            SELECT MAX(ra2.acctstarttime)
            FROM radacct ra2
            WHERE ra2.username = ra1.username
          )
        ) latest_session ON rc.username = latest_session.username
        ${whereClause}
        ORDER BY 
          CASE WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL THEN 0 ELSE 1 END,
          rc.username ASC
        LIMIT ${limitNum} OFFSET ${offset}
      `, searchParams);

      // Get total count for pagination
      const [countResult] = await connection.query(`
        SELECT COUNT(DISTINCT rc.username) as total 
        FROM radcheck rc
        LEFT JOIN (
          SELECT *
          FROM radacct ra1
          WHERE ra1.acctstarttime = (
            SELECT MAX(ra2.acctstarttime)
            FROM radacct ra2
            WHERE ra2.username = ra1.username
          )
        ) latest_session ON rc.username = latest_session.username
        ${whereClause}
      `, searchParams);

      // Get summary statistics
      const [summaryStats] = await connection.query(`
        SELECT 
          COUNT(DISTINCT rc.username) as total_configured_users,
          COUNT(CASE WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL THEN 1 END) as currently_online,
          COUNT(CASE WHEN latest_session.acctstoptime IS NOT NULL OR latest_session.acctstarttime IS NULL THEN 1 END) as currently_offline,
          ROUND(COUNT(CASE WHEN latest_session.acctstoptime IS NULL AND latest_session.acctstarttime IS NOT NULL THEN 1 END) * 100.0 / COUNT(DISTINCT rc.username), 1) as online_percentage
        FROM radcheck rc
        LEFT JOIN (
          SELECT *
          FROM radacct ra1
          WHERE ra1.acctstarttime = (
            SELECT MAX(ra2.acctstarttime)
            FROM radacct ra2
            WHERE ra2.username = ra1.username
          )
        ) latest_session ON rc.username = latest_session.username
        WHERE rc.attribute = 'Cleartext-Password'
      `);

      return {
        users: users,
        total: countResult[0].total,
        page: pageNum,
        totalPages: Math.ceil(countResult[0].total / limitNum),
        summary: summaryStats[0]
      };
    } catch (error) {
      console.error('Error getting user status comparison:', error);
      throw error;
    }
  }

  // Search active users by username, IP, or MAC address
  async searchActiveUsers(search, page = 1, limit = 20) {
    try {
      const connection = await this.getConnection();
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 20;
      const offset = (pageNum - 1) * limitNum;
      
      const searchTerm = `%${search}%`;
      
      const [users] = await connection.query(`
        SELECT 
          r.radacctid,
          r.username,
          r.nasipaddress,
          r.nasportid,
          r.nasporttype,
          r.acctsessionid,
          r.acctstarttime,
          r.acctstoptime,
          r.acctupdatetime,
          r.acctsessiontime,
          r.acctinputoctets,
          r.acctoutputoctets,
          r.calledstationid,
          r.callingstationid,
          r.framedipaddress,
          r.acctterminatecause,
          
          -- Enhanced status calculation
          CASE 
            WHEN r.acctstoptime IS NULL THEN 'Online'
            WHEN r.acctstoptime > DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 'Recently Offline'
            ELSE 'Offline'
          END as status,
          
          -- Real-time session duration
          CASE 
            WHEN r.acctstoptime IS NULL THEN TIMESTAMPDIFF(SECOND, r.acctstarttime, NOW())
            ELSE r.acctsessiontime
          END as current_session_duration,
          
          -- Data usage calculations
          ROUND((r.acctinputoctets + r.acctoutputoctets) / 1024 / 1024, 3) as total_data_mb,
          ROUND(r.acctinputoctets / 1024 / 1024, 3) as download_mb,
          ROUND(r.acctoutputoctets / 1024 / 1024, 3) as upload_mb,
          
          -- Last activity timestamp
          COALESCE(r.acctupdatetime, r.acctstarttime) as last_activity,
          
          -- Connection quality indicator
          CASE 
            WHEN r.acctstoptime IS NULL AND 
                 TIMESTAMPDIFF(MINUTE, COALESCE(r.acctupdatetime, r.acctstarttime), NOW()) > 10 
            THEN 'Stale'
            WHEN r.acctstoptime IS NULL THEN 'Active'
            ELSE 'Inactive'
          END as connection_quality
          
        FROM radacct r
        INNER JOIN (
          SELECT 
            username,
            MAX(CASE WHEN acctstoptime IS NULL THEN acctstarttime ELSE '1970-01-01' END) as latest_active_start,
            MAX(CASE WHEN acctstoptime IS NOT NULL THEN acctstoptime ELSE '1970-01-01' END) as latest_stop
          FROM radacct 
          WHERE (acctstoptime IS NULL OR acctstoptime > DATE_SUB(NOW(), INTERVAL 1 DAY))
          AND (
            username LIKE ? OR
            nasipaddress LIKE ? OR 
            framedipaddress LIKE ? OR
            callingstationid LIKE ?
          )
          GROUP BY username
        ) latest ON r.username = latest.username 
        AND (
          (r.acctstoptime IS NULL AND r.acctstarttime = latest.latest_active_start) OR
          (r.acctstoptime IS NOT NULL AND r.acctstoptime = latest.latest_stop)
        )
        WHERE (r.acctstoptime IS NULL OR r.acctstoptime > DATE_SUB(NOW(), INTERVAL 1 DAY))
        AND (
          r.username LIKE ? OR
          r.nasipaddress LIKE ? OR 
          r.framedipaddress LIKE ? OR
          r.callingstationid LIKE ?
        )
        ORDER BY 
          CASE WHEN r.acctstoptime IS NULL THEN 0 ELSE 1 END,
          r.acctstarttime DESC 
        LIMIT ${limitNum} OFFSET ${offset}
      `, [searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm]);

      // Get total count for search results
      const [countResult] = await connection.query(`
        SELECT COUNT(DISTINCT username) as total 
        FROM radacct 
        WHERE (acctstoptime IS NULL OR acctstoptime > DATE_SUB(NOW(), INTERVAL 1 DAY))
        AND (
          username LIKE ? OR
          nasipaddress LIKE ? OR 
          framedipaddress LIKE ? OR
          callingstationid LIKE ?
        )
      `, [searchTerm, searchTerm, searchTerm, searchTerm]);

      return {
        users,
        total: countResult[0].total,
        page: pageNum,
        totalPages: Math.ceil(countResult[0].total / limitNum)
      };
    } catch (error) {
      console.error('Error searching active users:', error);
      throw error;
    }
  }
}

module.exports = new ActiveUserModel();
