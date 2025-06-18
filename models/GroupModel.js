const mysql = require('mysql2/promise');
require('dotenv').config();

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'radius',
  password: process.env.DB_PASSWORD || 'radiusradius',
  database: process.env.DB_NAME || 'radius',
};

class GroupModel {
  constructor() {
    this.db = null;
  }

  async getConnection() {
    if (!this.db) {
      this.db = await mysql.createConnection(dbConfig);
    }
    return this.db;
  }

  // Get all groups with their attributes
  async getAllGroups(page = 1, limit = 10) {
    try {
      const connection = await this.getConnection();
      // Ensure parameters are integers
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;
      
      // Get distinct groups from radgroupcheck
      const [groups] = await connection.query(`
        SELECT DISTINCT groupname 
        FROM radgroupcheck 
        ORDER BY groupname 
        LIMIT ${limitNum} OFFSET ${offset}
      `);

      // Get total count
      const [countResult] = await connection.query(`
        SELECT COUNT(DISTINCT groupname) as total FROM radgroupcheck
      `);

      // Get attributes for each group
      for (let group of groups) {
        // Get check attributes
        const [checkAttrs] = await connection.query(`
          SELECT attribute, op, value 
          FROM radgroupcheck 
          WHERE groupname = ${mysql.escape(group.groupname)}
        `);

        // Get reply attributes
        const [replyAttrs] = await connection.query(`
          SELECT attribute, op, value 
          FROM radgroupreply 
          WHERE groupname = ${mysql.escape(group.groupname)}
        `);

        // Count users in this group
        const [userCount] = await connection.query(`
          SELECT COUNT(*) as count 
          FROM radusergroup 
          WHERE groupname = ${mysql.escape(group.groupname)}
        `);

        group.checkAttributes = checkAttrs;
        group.replyAttributes = replyAttrs;
        group.userCount = userCount[0].count;
      }

      return {
        groups,
        total: countResult[0].total,
        page: pageNum,
        totalPages: Math.ceil(countResult[0].total / limitNum)
      };
    } catch (error) {
      console.error('Error getting all groups:', error);
      throw error;
    }
  }

  // Get group details by name
  async getGroupByName(groupname) {
    try {
      const connection = await this.getConnection();
      
      // Get check attributes
      const [checkAttrs] = await connection.query(`
        SELECT id, attribute, op, value 
        FROM radgroupcheck 
        WHERE groupname = ${mysql.escape(groupname)}
      `);

      // Get reply attributes
      const [replyAttrs] = await connection.query(`
        SELECT id, attribute, op, value 
        FROM radgroupreply 
        WHERE groupname = ${mysql.escape(groupname)}
      `);

      // Get users in this group
      const [users] = await connection.query(`
        SELECT username, priority 
        FROM radusergroup 
        WHERE groupname = ${mysql.escape(groupname)}
        ORDER BY priority
      `);

      if (checkAttrs.length === 0 && replyAttrs.length === 0) {
        return null;
      }

      return {
        groupname,
        checkAttributes: checkAttrs,
        replyAttributes: replyAttrs,
        users
      };
    } catch (error) {
      console.error('Error getting group by name:', error);
      throw error;
    }
  }

  // Create new group with attributes
  async createGroup(groupData) {
    try {
      const connection = await this.getConnection();
      
      // Start transaction
      await connection.beginTransaction();
      
      try {
        // Insert check attributes
        if (groupData.checkAttributes && groupData.checkAttributes.length > 0) {
          for (const attr of groupData.checkAttributes) {
            await connection.query(`
              INSERT INTO radgroupcheck (groupname, attribute, op, value) 
              VALUES (${mysql.escape(groupData.groupname)}, ${mysql.escape(attr.attribute)}, ${mysql.escape(attr.op)}, ${mysql.escape(attr.value)})
            `);
          }
        }

        // Insert reply attributes
        if (groupData.replyAttributes && groupData.replyAttributes.length > 0) {
          for (const attr of groupData.replyAttributes) {
            await connection.query(`
              INSERT INTO radgroupreply (groupname, attribute, op, value) 
              VALUES (${mysql.escape(groupData.groupname)}, ${mysql.escape(attr.attribute)}, ${mysql.escape(attr.op)}, ${mysql.escape(attr.value)})
            `);
          }
        }

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error creating group:', error);
      throw error;
    }
  }

  // Update group attributes
  async updateGroup(groupname, groupData) {
    try {
      const connection = await this.getConnection();
      
      // Start transaction
      await connection.beginTransaction();
      
      try {
        // Delete existing attributes if we're replacing them
        if (groupData.checkAttributes) {
          await connection.query(`DELETE FROM radgroupcheck WHERE groupname = ${mysql.escape(groupname)}`);
          
          // Insert new check attributes
          for (const attr of groupData.checkAttributes) {
            await connection.query(`
              INSERT INTO radgroupcheck (groupname, attribute, op, value) 
              VALUES (${mysql.escape(groupname)}, ${mysql.escape(attr.attribute)}, ${mysql.escape(attr.op)}, ${mysql.escape(attr.value)})
            `);
          }
        }

        if (groupData.replyAttributes) {
          await connection.query(`DELETE FROM radgroupreply WHERE groupname = ${mysql.escape(groupname)}`);
          
          // Insert new reply attributes
          for (const attr of groupData.replyAttributes) {
            await connection.query(`
              INSERT INTO radgroupreply (groupname, attribute, op, value) 
              VALUES (${mysql.escape(groupname)}, ${mysql.escape(attr.attribute)}, ${mysql.escape(attr.op)}, ${mysql.escape(attr.value)})
            `);
          }
        }

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error updating group:', error);
      throw error;
    }
  }

  // Delete group
  async deleteGroup(groupname) {
    try {
      const connection = await this.getConnection();
      
      // Start transaction
      await connection.beginTransaction();
      
      try {
        // Delete from radgroupcheck
        await connection.query(`DELETE FROM radgroupcheck WHERE groupname = ${mysql.escape(groupname)}`);
        
        // Delete from radgroupreply
        await connection.query(`DELETE FROM radgroupreply WHERE groupname = ${mysql.escape(groupname)}`);
        
        // Delete user group associations
        await connection.query(`DELETE FROM radusergroup WHERE groupname = ${mysql.escape(groupname)}`);

        await connection.commit();
        return true;
      } catch (error) {
        await connection.rollback();
        throw error;
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      throw error;
    }
  }

  // Check if group exists
  async groupExists(groupname) {
    try {
      const connection = await this.getConnection();
      const [rows] = await connection.query(`
        SELECT COUNT(*) as count 
        FROM radgroupcheck 
        WHERE groupname = ${mysql.escape(groupname)}
      `);
      return rows[0].count > 0;
    } catch (error) {
      console.error('Error checking if group exists:', error);
      throw error;
    }
  }

  // Get available RADIUS attributes
  getAvailableAttributes() {
    return {
      check: [
        'Auth-Type',
        'User-Password',
        'Cleartext-Password',
        'Crypt-Password',
        'MD5-Password',
        'SHA1-Password',
        'NT-Password',
        'LM-Password',
        'SMB-Account-CTRL',
        'SMB-Account-CTRL-TEXT',
        'Group',
        'Expiration',
        'Login-Time'
      ],
      reply: [
        'Service-Type',
        'Framed-Protocol',
        'Framed-IP-Address',
        'Framed-IP-Netmask',
        'Framed-Routing',
        'Filter-Id',
        'Framed-MTU',
        'Framed-Compression',
        'Login-IP-Host',
        'Login-Service',
        'Login-TCP-Port',
        'Reply-Message',
        'Callback-Number',
        'Callback-Id',
        'Framed-Route',
        'Framed-IPX-Network',
        'Class',
        'Idle-Timeout',
        'Session-Timeout',
        'Termination-Action',
        'Called-Station-Id',
        'Calling-Station-Id',
        'NAS-Identifier',
        'Proxy-State',
        'Login-LAT-Service',
        'Login-LAT-Node',
        'Login-LAT-Group',
        'Framed-AppleTalk-Link',
        'Framed-AppleTalk-Network',
        'Framed-AppleTalk-Zone',
        'Port-Limit',
        'Login-LAT-Port'
      ]
    };
  }

  // Search groups
  async searchGroups(query, page = 1, limit = 10) {
    try {
      const connection = await this.getConnection();
      // Ensure parameters are integers
      const pageNum = parseInt(page) || 1;
      const limitNum = parseInt(limit) || 10;
      const offset = (pageNum - 1) * limitNum;
      const searchPattern = `%${query}%`;
      
      const [groups] = await connection.query(`
        SELECT DISTINCT groupname 
        FROM radgroupcheck 
        WHERE groupname LIKE ${mysql.escape(searchPattern)}
        ORDER BY groupname 
        LIMIT ${limitNum} OFFSET ${offset}
      `);

      // Get total count
      const [countResult] = await connection.query(`
        SELECT COUNT(DISTINCT groupname) as total 
        FROM radgroupcheck 
        WHERE groupname LIKE ${mysql.escape(searchPattern)}
      `);

      // Get attributes for each group
      for (let group of groups) {
        const [checkAttrs] = await connection.query(`
          SELECT attribute, op, value 
          FROM radgroupcheck 
          WHERE groupname = ${mysql.escape(group.groupname)}
        `);

        const [replyAttrs] = await connection.query(`
          SELECT attribute, op, value 
          FROM radgroupreply 
          WHERE groupname = ${mysql.escape(group.groupname)}
        `);

        const [userCount] = await connection.query(`
          SELECT COUNT(*) as count 
          FROM radusergroup 
          WHERE groupname = ${mysql.escape(group.groupname)}
        `);

        group.checkAttributes = checkAttrs;
        group.replyAttributes = replyAttrs;
        group.userCount = userCount[0].count;
      }

      return {
        groups,
        total: countResult[0].total,
        page: pageNum,
        totalPages: Math.ceil(countResult[0].total / limitNum)
      };
    } catch (error) {
      console.error('Error searching groups:', error);
      throw error;
    }
  }

  // Get predefined group templates
  getGroupTemplates() {
    return {
      'default': {
        name: 'Default Users',
        description: 'Basic internet access with no restrictions',
        checkAttributes: [],
        replyAttributes: [
          { attribute: 'Service-Type', op: ':=', value: 'Framed-User' },
          { attribute: 'Framed-Protocol', op: ':=', value: 'PPP' }
        ]
      },
      'limited': {
        name: 'Limited Users',
        description: 'Internet access with 1 hour session timeout',
        checkAttributes: [],
        replyAttributes: [
          { attribute: 'Service-Type', op: ':=', value: 'Framed-User' },
          { attribute: 'Framed-Protocol', op: ':=', value: 'PPP' },
          { attribute: 'Session-Timeout', op: ':=', value: '3600' }
        ]
      },
      'premium': {
        name: 'Premium Users',
        description: 'Full access with high bandwidth',
        checkAttributes: [],
        replyAttributes: [
          { attribute: 'Service-Type', op: ':=', value: 'Framed-User' },
          { attribute: 'Framed-Protocol', op: ':=', value: 'PPP' },
          { attribute: 'Filter-Id', op: ':=', value: 'premium' }
        ]
      }
    };
  }
}

module.exports = new GroupModel();
