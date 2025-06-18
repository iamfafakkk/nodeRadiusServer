const dgram = require('dgram');
const EventEmitter = require('events');
const crypto = require('crypto');
const { pool: db } = require('../config/database');
const { serverLogger: logger } = require('../config/logger');

class RadiusService extends EventEmitter {
    constructor() {
        super();
        this.authServer = null;
        this.acctServer = null;
        this.sharedSecret = 'testing123'; // Should be configurable
        this.isRunning = false;
    }

    // RADIUS packet types
    static PACKET_TYPES = {
        ACCESS_REQUEST: 1,
        ACCESS_ACCEPT: 2,
        ACCESS_REJECT: 3,
        ACCOUNTING_REQUEST: 4,
        ACCOUNTING_RESPONSE: 5
    };

    // RADIUS attributes
    static ATTRIBUTES = {
        USER_NAME: 1,
        USER_PASSWORD: 2,
        CHAP_PASSWORD: 3,
        NAS_IP_ADDRESS: 4,
        NAS_PORT: 5,
        SERVICE_TYPE: 6,
        FRAMED_PROTOCOL: 7,
        FRAMED_IP_ADDRESS: 8,
        FRAMED_IP_NETMASK: 9,
        FILTER_ID: 11,
        FRAMED_MTU: 12,
        FRAMED_COMPRESSION: 13,
        LOGIN_IP_HOST: 14,
        LOGIN_SERVICE: 15,
        LOGIN_TCP_PORT: 16,
        REPLY_MESSAGE: 18,
        CALLBACK_NUMBER: 19,
        CALLBACK_ID: 20,
        FRAMED_ROUTE: 22,
        FRAMED_IPX_NETWORK: 23,
        STATE: 24,
        CLASS: 25,
        VENDOR_SPECIFIC: 26,
        SESSION_TIMEOUT: 27,
        IDLE_TIMEOUT: 28,
        TERMINATION_ACTION: 29,
        CALLED_STATION_ID: 30,
        CALLING_STATION_ID: 31,
        NAS_IDENTIFIER: 32,
        PROXY_STATE: 33,
        LOGIN_LAT_SERVICE: 34,
        LOGIN_LAT_NODE: 35,
        LOGIN_LAT_GROUP: 36,
        FRAMED_APPLETALK_LINK: 37,
        FRAMED_APPLETALK_NETWORK: 38,
        FRAMED_APPLETALK_ZONE: 39,
        ACCT_STATUS_TYPE: 40,
        ACCT_DELAY_TIME: 41,
        ACCT_INPUT_OCTETS: 42,
        ACCT_OUTPUT_OCTETS: 43,
        ACCT_SESSION_ID: 44,
        ACCT_AUTHENTIC: 45,
        ACCT_SESSION_TIME: 46,
        ACCT_INPUT_PACKETS: 47,
        ACCT_OUTPUT_PACKETS: 48,
        ACCT_TERMINATE_CAUSE: 49,
        ACCT_MULTI_SESSION_ID: 50,
        ACCT_LINK_COUNT: 51,
        ACCT_INPUT_GIGAWORDS: 52,
        ACCT_OUTPUT_GIGAWORDS: 53,
        EVENT_TIMESTAMP: 55,
        NAS_PORT_TYPE: 61,
        PORT_LIMIT: 62,
        LOGIN_LAT_PORT: 63
    };

    // Accounting status types
    static ACCT_STATUS_TYPES = {
        START: 1,
        STOP: 2,
        INTERIM_UPDATE: 3,
        ACCOUNTING_ON: 7,
        ACCOUNTING_OFF: 8
    };

    start(authPort = 1812, acctPort = 1813) {
        if (this.isRunning) {
            logger.warn('RADIUS service is already running');
            return;
        }

        try {
            // Start Authentication Server
            this.authServer = dgram.createSocket('udp4');
            this.authServer.bind(authPort, () => {
                logger.info(`RADIUS Authentication server listening on port ${authPort}`);
            });

            this.authServer.on('message', (msg, rinfo) => {
                this.handleAuthRequest(msg, rinfo);
            });

            this.authServer.on('error', (err) => {
                logger.error('RADIUS Auth server error:', err);
                this.emit('error', err);
            });

            // Start Accounting Server
            this.acctServer = dgram.createSocket('udp4');
            this.acctServer.bind(acctPort, () => {
                logger.info(`RADIUS Accounting server listening on port ${acctPort}`);
            });

            this.acctServer.on('message', (msg, rinfo) => {
                this.handleAcctRequest(msg, rinfo);
            });

            this.acctServer.on('error', (err) => {
                logger.error('RADIUS Acct server error:', err);
                this.emit('error', err);
            });

            this.isRunning = true;
            logger.info('RADIUS service started successfully');
            this.emit('started');

        } catch (error) {
            logger.error('Failed to start RADIUS service:', error);
            this.emit('error', error);
        }
    }

    stop() {
        if (!this.isRunning) {
            return;
        }

        try {
            if (this.authServer) {
                this.authServer.close();
                this.authServer = null;
            }

            if (this.acctServer) {
                this.acctServer.close();
                this.acctServer = null;
            }

            this.isRunning = false;
            logger.info('RADIUS service stopped');
            this.emit('stopped');

        } catch (error) {
            logger.error('Error stopping RADIUS service:', error);
            this.emit('error', error);
        }
    }

    async handleAuthRequest(packet, rinfo) {
        try {
            const parsed = this.parsePacket(packet);
            logger.info(`Authentication request from ${rinfo.address}:${rinfo.port}`);
            logger.debug('Parsed packet:', parsed);

            if (parsed.code !== RadiusService.PACKET_TYPES.ACCESS_REQUEST) {
                logger.warn(`Unexpected packet type: ${parsed.code}`);
                return;
            }

            // Get shared secret for this NAS
            const sharedSecret = await this.getSharedSecret(rinfo.address);
            if (!sharedSecret) {
                logger.warn(`No shared secret found for NAS: ${rinfo.address}`);
                const rejectPacket = this.createAccessReject(parsed.identifier, parsed.authenticator, this.sharedSecret);
                this.authServer.send(rejectPacket, rinfo.port, rinfo.address);
                return;
            }

            const username = parsed.attributes[RadiusService.ATTRIBUTES.USER_NAME];
            const encryptedPassword = parsed.attributes[RadiusService.ATTRIBUTES.USER_PASSWORD];
            const chapPassword = parsed.attributes[RadiusService.ATTRIBUTES.CHAP_PASSWORD];
            const vendorSpecific = parsed.attributes[RadiusService.ATTRIBUTES.VENDOR_SPECIFIC];

            logger.debug(`Received username: ${username}, encrypted password length: ${encryptedPassword ? encryptedPassword.length : 0}`);
            if (chapPassword) {
                logger.debug(`CHAP password present, length: ${chapPassword.length}`);
            }
            if (vendorSpecific) {
                logger.debug(`Vendor-specific attribute present, length: ${vendorSpecific.length}`);
                logger.debug(`Vendor-specific hex: ${vendorSpecific.toString('hex')}`);
            }

            if (!username || (!encryptedPassword && !chapPassword && !vendorSpecific)) {
                logger.warn('Missing username or password in authentication request');
                const rejectPacket = this.createAccessReject(parsed.identifier, parsed.authenticator, sharedSecret);
                this.authServer.send(rejectPacket, rinfo.port, rinfo.address);
                return;
            }

            // Decrypt password using the correct shared secret
            const password = this.decryptPassword(encryptedPassword, parsed.authenticator, sharedSecret);
            logger.debug(`Decrypted password: ${password}`);

            if (!password) {
                logger.warn('Failed to decrypt password');
                const rejectPacket = this.createAccessReject(parsed.identifier, parsed.authenticator, sharedSecret);
                this.authServer.send(rejectPacket, rinfo.port, rinfo.address);
                return;
            }

            // Authenticate user
            const isValid = await this.authenticateUser(username, password);
            
            if (isValid) {
                logger.info(`Authentication successful for user: ${username}`);
                const acceptPacket = this.createAccessAccept(parsed.identifier, parsed.authenticator, sharedSecret);
                this.authServer.send(acceptPacket, rinfo.port, rinfo.address);
                
                // Emit authentication event
                this.emit('auth-success', {
                    username,
                    nasIp: rinfo.address,
                    timestamp: new Date()
                });
            } else {
                logger.warn(`Authentication failed for user: ${username}`);
                const rejectPacket = this.createAccessReject(parsed.identifier, parsed.authenticator, sharedSecret);
                this.authServer.send(rejectPacket, rinfo.port, rinfo.address);
                
                // Emit authentication failure event
                this.emit('auth-failure', {
                    username,
                    nasIp: rinfo.address,
                    timestamp: new Date()
                });
            }

        } catch (error) {
            logger.error('Error handling authentication request:', error);
            
            // Send reject packet on error
            try {
                const parsed = this.parsePacket(packet);
                const sharedSecret = await this.getSharedSecret(rinfo.address) || this.sharedSecret;
                const rejectPacket = this.createAccessReject(parsed.identifier, parsed.authenticator, sharedSecret);
                this.authServer.send(rejectPacket, rinfo.port, rinfo.address);
            } catch (parseError) {
                logger.error('Error parsing packet for reject response:', parseError);
            }
        }
    }

    async handleAcctRequest(packet, rinfo) {
        try {
            const parsed = this.parsePacket(packet);
            logger.info(`Accounting request from ${rinfo.address}:${rinfo.port}`);
            logger.debug('Parsed accounting packet:', parsed);

            if (parsed.code !== RadiusService.PACKET_TYPES.ACCOUNTING_REQUEST) {
                logger.warn(`Unexpected accounting packet type: ${parsed.code}`);
                return;
            }

            // Extract accounting attributes
            const acctData = {
                username: parsed.attributes[RadiusService.ATTRIBUTES.USER_NAME],
                acctSessionId: parsed.attributes[RadiusService.ATTRIBUTES.ACCT_SESSION_ID],
                acctStatusType: parsed.attributes[RadiusService.ATTRIBUTES.ACCT_STATUS_TYPE],
                nasIpAddress: parsed.attributes[RadiusService.ATTRIBUTES.NAS_IP_ADDRESS] || rinfo.address,
                nasPort: parsed.attributes[RadiusService.ATTRIBUTES.NAS_PORT],
                nasIdentifier: parsed.attributes[RadiusService.ATTRIBUTES.NAS_IDENTIFIER],
                calledStationId: parsed.attributes[RadiusService.ATTRIBUTES.CALLED_STATION_ID],
                callingStationId: parsed.attributes[RadiusService.ATTRIBUTES.CALLING_STATION_ID],
                acctDelayTime: parsed.attributes[RadiusService.ATTRIBUTES.ACCT_DELAY_TIME] || 0,
                acctSessionTime: parsed.attributes[RadiusService.ATTRIBUTES.ACCT_SESSION_TIME],
                acctInputOctets: parsed.attributes[RadiusService.ATTRIBUTES.ACCT_INPUT_OCTETS],
                acctOutputOctets: parsed.attributes[RadiusService.ATTRIBUTES.ACCT_OUTPUT_OCTETS],
                acctInputPackets: parsed.attributes[RadiusService.ATTRIBUTES.ACCT_INPUT_PACKETS],
                acctOutputPackets: parsed.attributes[RadiusService.ATTRIBUTES.ACCT_OUTPUT_PACKETS],
                acctTerminateCause: parsed.attributes[RadiusService.ATTRIBUTES.ACCT_TERMINATE_CAUSE],
                framedIpAddress: parsed.attributes[RadiusService.ATTRIBUTES.FRAMED_IP_ADDRESS]
            };

            logger.info(`Processing accounting data for user ${acctData.username}, status: ${acctData.acctStatusType}`);
            logger.debug('Full accounting data:', acctData);

            // Process accounting record
            await this.processAccountingRecord(acctData);

            // Send accounting response
            const responsePacket = this.createAccountingResponse(parsed.identifier, parsed.authenticator);
            this.acctServer.send(responsePacket, rinfo.port, rinfo.address);

            logger.info(`Accounting response sent for session: ${acctData.acctSessionId}`);

        } catch (error) {
            logger.error('Error handling accounting request:', error);
            
            // Send accounting response even on error
            try {
                const parsed = this.parsePacket(packet);
                const responsePacket = this.createAccountingResponse(parsed.identifier, parsed.authenticator);
                this.acctServer.send(responsePacket, rinfo.port, rinfo.address);
            } catch (parseError) {
                logger.error('Error parsing packet for accounting response:', parseError);
            }
        }
    }

    async processAccountingRecord(acctData) {
        try {
            const now = new Date();
            
            switch (acctData.acctStatusType) {
                case RadiusService.ACCT_STATUS_TYPES.START:
                    await this.handleAccountingStart(acctData, now);
                    break;
                    
                case RadiusService.ACCT_STATUS_TYPES.STOP:
                    await this.handleAccountingStop(acctData, now);
                    break;
                    
                case RadiusService.ACCT_STATUS_TYPES.INTERIM_UPDATE:
                    await this.handleAccountingInterimUpdate(acctData, now);
                    break;
                    
                default:
                    logger.warn(`Unknown accounting status type: ${acctData.acctStatusType}`);
            }
            
        } catch (error) {
            logger.error('Error processing accounting record:', error);
            throw error;
        }
    }

    async handleAccountingStart(acctData, timestamp) {
        try {
            logger.info(`Accounting START for user: ${acctData.username}, session: ${acctData.acctSessionId}`);

            // Insert new accounting record
            const query = `
                INSERT INTO radacct (
                    acctsessionid, acctuniqueid, username, groupname, realm, nasipaddress,
                    nasportid, nasporttype, acctstarttime, acctupdatetime, acctstoptime,
                    acctsessiontime, acctauthentic, connectinfo_start, connectinfo_stop,
                    acctinputoctets, acctoutputoctets, calledstationid, callingstationid,
                    acctterminatecause, servicetype, framedprotocol, framedipaddress
                ) VALUES (?, ?, ?, '', '', ?, ?, 0, ?, ?, NULL, 0, '', '', '', 0, 0, ?, ?, '', '', '', ?)
            `;

            const values = [
                acctData.acctSessionId,
                `${acctData.acctSessionId}-${timestamp.getTime()}`, // unique ID
                acctData.username,
                acctData.nasIpAddress,
                acctData.nasPort || 0,
                timestamp,
                timestamp,
                acctData.calledStationId || '',
                acctData.callingStationId || '',
                acctData.framedIpAddress || ''
            ];

            await db.execute(query, values);
            
            logger.info(`Accounting START record inserted for user: ${acctData.username}`);

            // Emit real-time event
            this.emit('session-start', {
                username: acctData.username,
                sessionId: acctData.acctSessionId,
                nasIp: acctData.nasIpAddress,
                nasPort: acctData.nasPort,
                calledStationId: acctData.calledStationId,
                callingStationId: acctData.callingStationId,
                framedIpAddress: acctData.framedIpAddress,
                startTime: timestamp
            });

        } catch (error) {
            logger.error('Error handling accounting START:', error);
            throw error;
        }
    }

    async handleAccountingStop(acctData, timestamp) {
        try {
            logger.info(`Accounting STOP for user: ${acctData.username}, session: ${acctData.acctSessionId}`);

            // Update existing accounting record
            const query = `
                UPDATE radacct SET
                    acctstoptime = ?,
                    acctsessiontime = ?,
                    acctinputoctets = ?,
                    acctoutputoctets = ?,
                    acctterminatecause = ?,
                    acctupdatetime = ?
                WHERE acctsessionid = ? AND username = ? AND acctstoptime IS NULL
            `;

            const values = [
                timestamp,
                acctData.acctSessionTime || 0,
                acctData.acctInputOctets || 0,
                acctData.acctOutputOctets || 0,
                acctData.acctTerminateCause || '',
                timestamp,
                acctData.acctSessionId,
                acctData.username
            ];

            const [result] = await db.execute(query, values);
            
            if (result.affectedRows === 0) {
                logger.warn(`No active session found to stop for user: ${acctData.username}, session: ${acctData.acctSessionId}`);
                
                // Insert a stop record if no start record exists
                await this.insertStopRecord(acctData, timestamp);
            } else {
                logger.info(`Accounting STOP record updated for user: ${acctData.username}`);
            }

            // Emit real-time event
            this.emit('session-stop', {
                username: acctData.username,
                sessionId: acctData.acctSessionId,
                nasIp: acctData.nasIpAddress,
                nasPort: acctData.nasPort,
                sessionTime: acctData.acctSessionTime || 0,
                inputOctets: acctData.acctInputOctets || 0,
                outputOctets: acctData.acctOutputOctets || 0,
                terminateCause: acctData.acctTerminateCause || '',
                stopTime: timestamp
            });

        } catch (error) {
            logger.error('Error handling accounting STOP:', error);
            throw error;
        }
    }

    async handleAccountingInterimUpdate(acctData, timestamp) {
        try {
            logger.info(`Accounting INTERIM-UPDATE for user: ${acctData.username}, session: ${acctData.acctSessionId}`);

            // Update existing accounting record with interim data
            const query = `
                UPDATE radacct SET
                    acctupdatetime = ?,
                    acctsessiontime = ?,
                    acctinputoctets = ?,
                    acctoutputoctets = ?
                WHERE acctsessionid = ? AND username = ? AND acctstoptime IS NULL
            `;

            const values = [
                timestamp,
                acctData.acctSessionTime || 0,
                acctData.acctInputOctets || 0,
                acctData.acctOutputOctets || 0,
                acctData.acctSessionId,
                acctData.username
            ];

            const [result] = await db.execute(query, values);
            
            if (result.affectedRows === 0) {
                logger.warn(`No active session found to update for user: ${acctData.username}, session: ${acctData.acctSessionId}`);
            } else {
                logger.info(`Accounting INTERIM-UPDATE record updated for user: ${acctData.username}`);
            }

            // Emit real-time event
            this.emit('session-update', {
                username: acctData.username,
                sessionId: acctData.acctSessionId,
                nasIp: acctData.nasIpAddress,
                nasPort: acctData.nasPort,
                sessionTime: acctData.acctSessionTime || 0,
                inputOctets: acctData.acctInputOctets || 0,
                outputOctets: acctData.acctOutputOctets || 0,
                updateTime: timestamp
            });

        } catch (error) {
            logger.error('Error handling accounting INTERIM-UPDATE:', error);
            throw error;
        }
    }

    async insertStopRecord(acctData, timestamp) {
        try {
            // Insert a stop-only record
            const query = `
                INSERT INTO radacct (
                    acctsessionid, acctuniqueid, username, groupname, realm, nasipaddress,
                    nasportid, nasporttype, acctstarttime, acctupdatetime, acctstoptime,
                    acctsessiontime, acctauthentic, connectinfo_start, connectinfo_stop,
                    acctinputoctets, acctoutputoctets, calledstationid, callingstationid,
                    acctterminatecause, servicetype, framedprotocol, framedipaddress
                ) VALUES (?, ?, ?, '', '', ?, ?, 0, ?, ?, ?, ?, '', '', '', ?, ?, ?, ?, ?, '', '', ?)
            `;

            const startTime = new Date(timestamp.getTime() - (acctData.acctSessionTime || 0) * 1000);
            
            const values = [
                acctData.acctSessionId,
                `${acctData.acctSessionId}-${timestamp.getTime()}`, // unique ID
                acctData.username,
                acctData.nasIpAddress,
                acctData.nasPort || 0,
                startTime,
                timestamp,
                timestamp,
                acctData.acctSessionTime || 0,
                acctData.acctInputOctets || 0,
                acctData.acctOutputOctets || 0,
                acctData.calledStationId || '',
                acctData.callingStationId || '',
                acctData.acctTerminateCause || '',
                acctData.framedIpAddress || ''
            ];

            await db.execute(query, values);
            logger.info(`Stop-only record inserted for user: ${acctData.username}`);

        } catch (error) {
            logger.error('Error inserting stop record:', error);
            throw error;
        }
    }

    async authenticateUser(username, password) {
        try {
            const query = 'SELECT * FROM radcheck WHERE username = ? AND attribute = ? AND value = ?';
            logger.debug(`Authenticating user: ${username} with password: ${password}`);
            
            const [rows] = await db.execute(query, [username, 'Cleartext-Password', password]);
            logger.debug(`Query result: ${rows.length} rows found`);
            
            if (rows.length > 0) {
                logger.debug('User found in database:', rows[0]);
                return true;
            } else {
                logger.debug('User not found or password mismatch');
                return false;
            }
            
        } catch (error) {
            logger.error('Error authenticating user:', error);
            return false;
        }
    }

    // Method untuk decrypt password RADIUS (PAP authentication)
    decryptPassword(encryptedPassword, requestAuthenticator, sharedSecret) {
        try {
            logger.debug(`Using shared secret: "${sharedSecret}"`);
            logger.debug(`Encrypted password hex: ${encryptedPassword.toString('hex')}`);
            logger.debug(`Request authenticator hex: ${requestAuthenticator.toString('hex')}`);
            
            if (!Buffer.isBuffer(encryptedPassword)) {
                return null;
            }

            // Password harus berupa kelipatan 16 bytes
            if (encryptedPassword.length % 16 !== 0) {
                logger.warn('Invalid encrypted password length');
                return null;
            }

            let password = '';
            const sharedSecretBuffer = Buffer.from(sharedSecret, 'utf8');
            
            // Decrypt setiap blok 16 bytes
            for (let i = 0; i < encryptedPassword.length; i += 16) {
                const block = encryptedPassword.slice(i, i + 16);
                
                // Buat hash untuk blok ini
                const hash = crypto.createHash('md5');
                hash.update(sharedSecretBuffer);
                
                if (i === 0) {
                    // Untuk blok pertama, gunakan request authenticator
                    hash.update(requestAuthenticator);
                } else {
                    // Untuk blok selanjutnya, gunakan blok encrypted sebelumnya
                    hash.update(encryptedPassword.slice(i - 16, i));
                }
                
                const hashResult = hash.digest();
                
                // XOR blok encrypted dengan hash
                for (let j = 0; j < 16; j++) {
                    const decryptedByte = block[j] ^ hashResult[j];
                    if (decryptedByte !== 0) { // Ignore null padding
                        password += String.fromCharCode(decryptedByte);
                    }
                }
            }
            
            return password.trim();
            
        } catch (error) {
            logger.error('Error decrypting password:', error);
            return null;
        }
    }

    parsePacket(buffer) {
        if (buffer.length < 20) {
            throw new Error('Packet too short');
        }

        const packet = {
            code: buffer.readUInt8(0),
            identifier: buffer.readUInt8(1),
            length: buffer.readUInt16BE(2),
            authenticator: buffer.slice(4, 20),
            attributes: {}
        };

        // Parse attributes
        let offset = 20;
        while (offset < packet.length) {
            if (offset + 2 > buffer.length) break;
            
            const type = buffer.readUInt8(offset);
            const length = buffer.readUInt8(offset + 1);
            
            if (length < 2 || offset + length > buffer.length) break;
            
            const value = buffer.slice(offset + 2, offset + length);
            
            // Convert value based on attribute type
            switch (type) {
                case RadiusService.ATTRIBUTES.USER_NAME:
                case RadiusService.ATTRIBUTES.NAS_IDENTIFIER:
                case RadiusService.ATTRIBUTES.CALLED_STATION_ID:
                case RadiusService.ATTRIBUTES.CALLING_STATION_ID:
                case RadiusService.ATTRIBUTES.ACCT_SESSION_ID:
                case RadiusService.ATTRIBUTES.REPLY_MESSAGE:
                    packet.attributes[type] = value.toString('utf8');
                    break;
                    
                case RadiusService.ATTRIBUTES.NAS_PORT:
                case RadiusService.ATTRIBUTES.SERVICE_TYPE:
                case RadiusService.ATTRIBUTES.ACCT_STATUS_TYPE:
                case RadiusService.ATTRIBUTES.ACCT_DELAY_TIME:
                case RadiusService.ATTRIBUTES.ACCT_SESSION_TIME:
                case RadiusService.ATTRIBUTES.ACCT_INPUT_OCTETS:
                case RadiusService.ATTRIBUTES.ACCT_OUTPUT_OCTETS:
                case RadiusService.ATTRIBUTES.ACCT_INPUT_PACKETS:
                case RadiusService.ATTRIBUTES.ACCT_OUTPUT_PACKETS:
                case RadiusService.ATTRIBUTES.ACCT_TERMINATE_CAUSE:
                    if (value.length >= 4) {
                        packet.attributes[type] = value.readUInt32BE(0);
                    }
                    break;
                    
                case RadiusService.ATTRIBUTES.NAS_IP_ADDRESS:
                case RadiusService.ATTRIBUTES.FRAMED_IP_ADDRESS:
                    if (value.length >= 4) {
                        packet.attributes[type] = `${value[0]}.${value[1]}.${value[2]}.${value[3]}`;
                    }
                    break;
                    
                default:
                    packet.attributes[type] = value;
            }
            
            offset += length;
        }

        return packet;
    }

    createAccessAccept(identifier, requestAuthenticator, sharedSecret) {
        const packet = Buffer.alloc(20);
        packet.writeUInt8(RadiusService.PACKET_TYPES.ACCESS_ACCEPT, 0);
        packet.writeUInt8(identifier, 1);
        packet.writeUInt16BE(20, 2);
        
        // Response authenticator = MD5(Code + ID + Length + Request Authenticator + Response Attributes + Secret)
        const hash = crypto.createHash('md5');
        hash.update(packet.slice(0, 4));
        hash.update(requestAuthenticator);
        hash.update(sharedSecret);
        const responseAuth = hash.digest();
        responseAuth.copy(packet, 4);
        
        return packet;
    }

    createAccessReject(identifier, requestAuthenticator, sharedSecret) {
        const packet = Buffer.alloc(20);
        packet.writeUInt8(RadiusService.PACKET_TYPES.ACCESS_REJECT, 0);
        packet.writeUInt8(identifier, 1);
        packet.writeUInt16BE(20, 2);
        
        // Response authenticator
        const hash = crypto.createHash('md5');
        hash.update(packet.slice(0, 4));
        hash.update(requestAuthenticator);
        hash.update(sharedSecret);
        const responseAuth = hash.digest();
        responseAuth.copy(packet, 4);
        
        return packet;
    }

    createAccountingResponse(identifier, requestAuthenticator) {
        const packet = Buffer.alloc(20);
        packet.writeUInt8(RadiusService.PACKET_TYPES.ACCOUNTING_RESPONSE, 0);
        packet.writeUInt8(identifier, 1);
        packet.writeUInt16BE(20, 2);
        
        // Response authenticator
        const hash = crypto.createHash('md5');
        hash.update(packet.slice(0, 4));
        hash.update(requestAuthenticator);
        hash.update(this.sharedSecret);
        const responseAuth = hash.digest();
        responseAuth.copy(packet, 4);
        
        return packet;
    }

    async getSharedSecret(nasIp) {
        try {
            const query = 'SELECT secret FROM nas WHERE nasname = ?';
            const [rows] = await db.execute(query, [nasIp]);
            
            if (rows.length > 0) {
                logger.debug(`Found shared secret for NAS ${nasIp}: ${rows[0].secret}`);
                return rows[0].secret;
            } else {
                logger.warn(`No NAS configuration found for IP: ${nasIp}`);
                return null;
            }
            
        } catch (error) {
            logger.error('Error getting shared secret:', error);
            return null;
        }
    }

    getStatus() {
        return {
            isRunning: this.isRunning,
            authServerActive: !!this.authServer,
            acctServerActive: !!this.acctServer
        };
    }
}

module.exports = RadiusService;
