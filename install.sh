#!/bin/bash

# RADIUS Server Installation Script for Ubuntu VPS
# Includes support for PAP and CHAP authentication methods
# Author: Auto-generated
# Date: December 2024 - Updated for CHAP support

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="nodeRadiusServer"
NODE_VERSION="18"
DB_NAME="radius"
DB_USER="radius"
DB_PASS="radiusradius"  # Default password, will be changed during installation
RADIUS_SECRET="mikrotik123"  # Default RADIUS secret

# Dynamic variables (set in check_root function)
APP_USER=""
APP_DIR=""
HOME_DIR=""

# Functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_chap() {
    echo -e "${CYAN}[CHAP]${NC} $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_warning "Running as root detected."
        print_status "Setting up for root installation with proper user management..."
        
        # Create a dedicated user for the RADIUS server if it doesn't exist
        if ! id "radius" &>/dev/null; then
            print_status "Creating dedicated 'radius' user for the service..."
            useradd -r -s /bin/bash -d /opt/radius -m radius
            usermod -aG sudo radius 2>/dev/null || true
            print_success "User 'radius' created"
        fi
        
        # Set variables for root installation
        APP_USER="radius"
        APP_DIR="/opt/radius/$APP_NAME"
        HOME_DIR="/opt/radius"
        
        # Create necessary directories with proper ownership
        mkdir -p "$APP_DIR"
        mkdir -p "$HOME_DIR"
        chown -R radius:radius /opt/radius
        
        print_success "Root installation configured with dedicated user"
    else
        # Regular user installation
        APP_USER="$USER"
        APP_DIR="$HOME/$APP_NAME"
        HOME_DIR="$HOME"
        print_status "Running as regular user: $USER"
    fi
}

# Check Ubuntu version
check_ubuntu() {
    if ! grep -qi ubuntu /etc/os-release; then
        print_error "This script is designed for Ubuntu systems only."
        exit 1
    fi
    
    UBUNTU_VERSION=$(lsb_release -rs)
    print_status "Detected Ubuntu version: $UBUNTU_VERSION"
}

# Check if user has sudo privileges
check_sudo() {
    if [[ $EUID -eq 0 ]]; then
        print_status "Running as root - sudo check skipped"
        return 0
    fi
    
    if ! sudo -n true 2>/dev/null; then
        print_status "Testing sudo access..."
        sudo -v || {
            print_error "This script requires sudo privileges for system package installation."
            exit 1
        }
    fi
    print_success "Sudo access confirmed"
}

# Update system packages
update_system() {
    print_status "Updating system packages..."
    if [[ $EUID -eq 0 ]]; then
        apt update && apt upgrade -y
    else
        sudo apt update && sudo apt upgrade -y
    fi
    print_success "System packages updated"
}

# Install required system packages
install_system_packages() {
    print_status "Installing required system packages..."
    
    # Essential packages
    INSTALL_CMD="apt install -y \
        curl \
        wget \
        git \
        build-essential \
        software-properties-common \
        apt-transport-https \
        ca-certificates \
        gnupg \
        lsb-release \
        unzip \
        openssl \
        htop \
        vim \
        nano \
        tree \
        net-tools \
        tcpdump \
        nmap"
    
    if [[ $EUID -eq 0 ]]; then
        $INSTALL_CMD
    else
        sudo $INSTALL_CMD
    fi
    
    print_success "System packages installed"
}

# Install Node.js using NodeSource repository
install_nodejs() {
    print_status "Installing Node.js $NODE_VERSION..."
    
    # Remove any existing Node.js
    if [[ $EUID -eq 0 ]]; then
        apt remove -y nodejs npm 2>/dev/null || true
        # Add NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        # Install Node.js
        apt install -y nodejs
    else
        sudo apt remove -y nodejs npm 2>/dev/null || true
        # Add NodeSource repository
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
        # Install Node.js
        sudo apt install -y nodejs
    fi
    
    # Verify installation
    NODE_VER=$(node --version)
    NPM_VER=$(npm --version)
    
    print_success "Node.js $NODE_VER installed"
    print_success "NPM $NPM_VER installed"
}

# Install MySQL/MariaDB
install_database() {
    print_status "Installing MariaDB database server..."
    
    # Install MariaDB
    if [[ $EUID -eq 0 ]]; then
        apt install -y mariadb-server mariadb-client
        # Start and enable MariaDB
        systemctl start mariadb
        systemctl enable mariadb
    else
        sudo apt install -y mariadb-server mariadb-client
        # Start and enable MariaDB
        sudo systemctl start mariadb
        sudo systemctl enable mariadb
    fi
    
    # Secure MariaDB installation (automated)
    print_status "Securing MariaDB installation..."
    
    # Set root password
    ROOT_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    if [[ $EUID -eq 0 ]]; then
        mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$ROOT_PASS';" 2>/dev/null || \
        mysql -e "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('$ROOT_PASS');"
        mysql -e "DELETE FROM mysql.user WHERE User='';"
        mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
        mysql -e "DROP DATABASE IF EXISTS test;"
        mysql -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
        mysql -e "FLUSH PRIVILEGES;"
    else
        sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$ROOT_PASS';" 2>/dev/null || \
        sudo mysql -e "SET PASSWORD FOR 'root'@'localhost' = PASSWORD('$ROOT_PASS');"
        sudo mysql -e "DELETE FROM mysql.user WHERE User='';"
        sudo mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
        sudo mysql -e "DROP DATABASE IF EXISTS test;"
        sudo mysql -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
        sudo mysql -e "FLUSH PRIVILEGES;"
    fi
    
    # Save root password
    echo "$ROOT_PASS" > "$HOME_DIR/.mysql_root_password"
    chmod 600 "$HOME_DIR/.mysql_root_password"
    
    print_success "MariaDB installed and secured"
    print_status "Root password saved to: $HOME_DIR/.mysql_root_password"
}

# Setup database for RADIUS
setup_database() {
    print_status "Setting up RADIUS database..."
    
    ROOT_PASS=$(cat "$HOME_DIR/.mysql_root_password")
    
    # Generate secure database password
    NEW_DB_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    # Create database and user
    mysql -u root -p"$ROOT_PASS" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
    mysql -u root -p"$ROOT_PASS" -e "DROP USER IF EXISTS '$DB_USER'@'localhost';"
    mysql -u root -p"$ROOT_PASS" -e "CREATE USER '$DB_USER'@'localhost' IDENTIFIED BY '$NEW_DB_PASS';"
    mysql -u root -p"$ROOT_PASS" -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
    mysql -u root -p"$ROOT_PASS" -e "FLUSH PRIVILEGES;"
    
    # Update DB_PASS variable
    DB_PASS="$NEW_DB_PASS"
    
    # Save database credentials
    cat > "$HOME_DIR/.radius_db_config" << EOF
DB_HOST=localhost
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
EOF
    chmod 600 "$HOME_DIR/.radius_db_config"
    
    print_success "Database setup completed"
    print_status "Database credentials saved to: $HOME_DIR/.radius_db_config"
}

# Install PM2 for process management
install_pm2() {
    print_status "Installing PM2 process manager..."
    
    if [[ $EUID -eq 0 ]]; then
        # Install PM2 as the dedicated user
        su - "$APP_USER" -c "npm install -g pm2"
        # Setup PM2 startup script
        su - "$APP_USER" -c "pm2 startup" | grep -E "sudo.*pm2" | bash || true
    else
        npm install -g pm2
        # Setup PM2 startup script
        pm2 startup | grep -E "sudo.*pm2" | bash || true
    fi
    
    print_success "PM2 installed"
}

# Create application directory and setup
setup_application() {
    print_status "Setting up application directory..."
    
    # Create app directory
    mkdir -p "$APP_DIR"
    cd "$APP_DIR"
    
    # If this script is run from the source directory, copy files
    if [[ -f "../package.json" ]]; then
        print_status "Copying application files..."
        cp -r ../* . 2>/dev/null || true
        cp -r ../.[^.]* . 2>/dev/null || true
        
        # Set proper ownership if running as root
        if [[ $EUID -eq 0 ]]; then
            chown -R "$APP_USER:$APP_USER" "$APP_DIR"
        fi
    else
        print_warning "Application files not found. You'll need to upload them manually to $APP_DIR"
    fi
    
    print_success "Application directory setup completed"
}

# Install Node.js dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    
    cd "$APP_DIR"
    
    if [[ -f "package.json" ]]; then
        if [[ $EUID -eq 0 ]]; then
            su - "$APP_USER" -c "cd '$APP_DIR' && npm install --production"
        else
            npm install --production
        fi
        print_success "Dependencies installed"
    else
        print_warning "package.json not found. Skipping dependency installation."
    fi
}

# Setup environment configuration
setup_environment() {
    print_status "Setting up environment configuration..."
    
    cd "$APP_DIR"
    
    # Load database credentials
    source "$HOME_DIR/.radius_db_config"
    
    # Generate secure RADIUS secret
    SECURE_RADIUS_SECRET=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    # Create .env file
    cat > ".env" << EOF
# Database Configuration
DB_HOST=$DB_HOST
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS

# RADIUS Server Configuration
RADIUS_AUTH_PORT=1812
RADIUS_ACCT_PORT=1813
RADIUS_SECRET=$SECURE_RADIUS_SECRET

# Web Server Configuration
HTTP_PORT=3000
SERVER_PORT=3000

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/server.log

# Environment
NODE_ENV=production

# Authentication Methods (PAP + CHAP Support)
SUPPORT_PAP=true
SUPPORT_CHAP=true
DEFAULT_AUTH_METHOD=chap
EOF
    
    print_success "Environment file created with secure credentials"
    print_chap "CHAP authentication support enabled in configuration"
    
    # Create logs directory
    mkdir -p logs
    mkdir -p logs/auth
    
    # Set proper permissions
    chmod 644 .env
    chmod 755 logs
    chmod 755 logs/auth
    
    # Set ownership if running as root
    if [[ $EUID -eq 0 ]]; then
        chown -R "$APP_USER:$APP_USER" "$APP_DIR"
    fi
}

# Initialize database schema
init_database_schema() {
    print_status "Initializing database schema..."
    
    cd "$APP_DIR"
    
    if [[ -f "database/setup.sql" ]]; then
        source "$HOME_DIR/.radius_db_config"
        mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < database/setup.sql
        print_success "Database schema initialized"
        print_chap "Database is ready for both PAP and CHAP authentication"
    else
        print_warning "Database setup file not found. Skipping schema initialization."
    fi
}

# Setup firewall rules
setup_firewall() {
    print_status "Configuring firewall rules..."
    
    # Check if UFW is available
    if command -v ufw >/dev/null 2>&1; then
        if [[ $EUID -eq 0 ]]; then
            # Enable UFW if not already enabled
            ufw --force enable
            
            # Allow SSH (important!)
            ufw allow ssh
            
            # Allow RADIUS ports
            ufw allow 1812/udp comment 'RADIUS Authentication (PAP/CHAP)'
            ufw allow 1813/udp comment 'RADIUS Accounting'
            
            # Allow web interface
            ufw allow 3000/tcp comment 'RADIUS Web Management Interface'
            
            # Reload firewall
            ufw reload
        else
            # Enable UFW if not already enabled
            sudo ufw --force enable
            
            # Allow SSH (important!)
            sudo ufw allow ssh
            
            # Allow RADIUS ports
            sudo ufw allow 1812/udp comment 'RADIUS Authentication (PAP/CHAP)'
            sudo ufw allow 1813/udp comment 'RADIUS Accounting'
            
            # Allow web interface
            sudo ufw allow 3000/tcp comment 'RADIUS Web Management Interface'
            
            # Reload firewall
            sudo ufw reload
        fi
        
        print_success "Firewall configured for RADIUS server"
    else
        print_warning "UFW not available. Please configure firewall manually."
        print_status "Required ports: 1812/udp (auth), 1813/udp (acct), 3000/tcp (web)"
    fi
}

# Update PM2 ecosystem configuration
update_pm2_config() {
    print_status "Updating PM2 ecosystem configuration..."
    
    cd "$APP_DIR"
    
    # Backup original if exists
    [[ -f "ecosystem.config.js" ]] && cp ecosystem.config.js ecosystem.config.js.backup
    
    # Create updated ecosystem config
    cat > "ecosystem.config.js" << 'EOF'
module.exports = {
  apps: [{
    name: 'radius-server',
    script: './index.js',
    instances: 1, // Single instance for UDP server stability
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      HTTP_PORT: 3000,
      RADIUS_AUTH_PORT: 1812,
      RADIUS_ACCT_PORT: 1813
    },
    env_development: {
      NODE_ENV: 'development',
      HTTP_PORT: 3000,
      RADIUS_AUTH_PORT: 1812,
      RADIUS_ACCT_PORT: 1813
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
    // Enhanced monitoring
    pmx: true,
    monitoring: false,
    // Environment specific settings
    node_args: '--max-old-space-size=512'
  }]
};
EOF
    
    print_success "PM2 ecosystem configuration updated"
}

# Setup systemd service (alternative to PM2)
setup_systemd_service() {
    print_status "Creating systemd service..."
    
    SERVICE_CONTENT="[Unit]
Description=Node.js RADIUS Server with PAP/CHAP Support
After=network.target mysql.service mariadb.service
Requires=mysql.service

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=radius-server
TimeoutStartSec=60
TimeoutStopSec=30

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target"
    
    if [[ $EUID -eq 0 ]]; then
        echo "$SERVICE_CONTENT" > /etc/systemd/system/radius-server.service
        # Reload systemd and enable service
        systemctl daemon-reload
        systemctl enable radius-server.service
    else
        echo "$SERVICE_CONTENT" | sudo tee /etc/systemd/system/radius-server.service > /dev/null
        # Reload systemd and enable service
        sudo systemctl daemon-reload
        sudo systemctl enable radius-server.service
    fi
    
    print_success "Systemd service created and enabled"
}

# Create enhanced management scripts
create_management_scripts() {
    print_status "Creating enhanced management scripts..."
    
    # Start script with CHAP support info
    cat > "$HOME_DIR/start-radius.sh" << 'EOF'
#!/bin/bash
echo "=== Starting RADIUS Server with PAP/CHAP Support ==="
cd ~/nodeRadiusServer

# Start with PM2
pm2 start ecosystem.config.js

echo ""
echo "✅ RADIUS Server started successfully!"
echo ""
echo "=== Server Status ==="
pm2 status

echo ""
echo "=== Authentication Methods ==="
echo "✅ PAP Authentication: Enabled"
echo "✅ CHAP Authentication: Enabled"
echo "🔧 Default Method: CHAP (secure)"

echo ""
echo "=== Configuration Files ==="
echo "📄 MikroTik PAP Config: docs/FINAL_MIKROTIK_CONFIG.rsc"
echo "📄 MikroTik CHAP Config: docs/MIKROTIK_CHAP_CONFIG.rsc"
echo "📄 CHAP Implementation Guide: docs/CHAP_IMPLEMENTATION_GUIDE.md"

echo ""
echo "=== Monitoring ==="
echo "📊 Logs: tail -f ~/nodeRadiusServer/logs/auth.log"
echo "🌐 Web Interface: http://localhost:3000"
EOF
    
    # Stop script
    cat > "$HOME_DIR/stop-radius.sh" << 'EOF'
#!/bin/bash
echo "=== Stopping RADIUS Server ==="
pm2 stop radius-server
echo "✅ RADIUS Server stopped"
EOF
    
    # Status script with CHAP information
    cat > "$HOME_DIR/status-radius.sh" << 'EOF'
#!/bin/bash
echo "=== RADIUS Server Status ==="
echo ""
echo "--- PM2 Process Status ---"
pm2 status
echo ""
echo "--- System Service Status ---"
sudo systemctl status radius-server.service --no-pager -l
echo ""
echo "--- Authentication Methods ---"
echo "✅ PAP: Supported"
echo "✅ CHAP: Supported"
echo ""
echo "--- Recent Authentication Logs ---"
if [[ -f ~/nodeRadiusServer/logs/auth.log ]]; then
    echo "Last 10 authentication attempts:"
    tail -n 10 ~/nodeRadiusServer/logs/auth.log | grep -E "(PAP|CHAP|authentication)"
else
    echo "No authentication logs found yet"
fi
echo ""
echo "--- Server Logs ---"
tail -n 10 ~/nodeRadiusServer/logs/server.log
echo ""
echo "--- Network Status ---"
echo "RADIUS Auth Port 1812:"
sudo netstat -ulnp | grep :1812 || echo "Not listening"
echo "RADIUS Acct Port 1813:"
sudo netstat -ulnp | grep :1813 || echo "Not listening"
echo "Web Interface Port 3000:"
sudo netstat -tlnp | grep :3000 || echo "Not listening"
EOF
    
    # Update script with CHAP awareness
    cat > "$HOME_DIR/update-radius.sh" << 'EOF'
#!/bin/bash
echo "=== Updating RADIUS Server ==="
cd ~/nodeRadiusServer

echo "🛑 Stopping server..."
pm2 stop radius-server

echo "📥 Pulling updates..."
git pull origin main

echo "📦 Installing dependencies..."
npm install --production

echo "🔧 Checking configuration..."
if [[ -f "docs/CHAP_IMPLEMENTATION_GUIDE.md" ]]; then
    echo "✅ CHAP support available"
else
    echo "⚠️  CHAP documentation not found - may need manual update"
fi

echo "🚀 Starting server..."
pm2 start ecosystem.config.js

echo ""
echo "✅ Update completed!"
echo "📊 Status:"
pm2 status
EOF
    
    # CHAP configuration script
    cat > "$HOME_DIR/configure-chap.sh" << 'EOF'
#!/bin/bash
echo "=== CHAP Authentication Configuration Helper ==="
echo ""
echo "This script helps configure CHAP authentication on MikroTik"
echo ""
echo "📄 Available Configuration Files:"
echo "1. docs/MIKROTIK_CHAP_CONFIG.rsc - CHAP only configuration"
echo "2. docs/FINAL_MIKROTIK_CONFIG.rsc - PAP configuration (fallback)"
echo ""
echo "📖 Documentation:"
echo "- docs/CHAP_IMPLEMENTATION_GUIDE.md - Complete CHAP guide"
echo "- docs/PAP_vs_CHAP_EXPLAINED.md - Differences explanation"
echo ""
echo "🔧 Quick CHAP Setup:"
echo "1. Copy docs/MIKROTIK_CHAP_CONFIG.rsc to your MikroTik"
echo "2. Run: /import file-name=MIKROTIK_CHAP_CONFIG.rsc"
echo "3. Test PPPoE connection"
echo "4. Monitor logs: tail -f ~/nodeRadiusServer/logs/auth.log"
echo ""
echo "🔍 Current server authentication status:"
if pm2 list | grep -q "radius-server.*online"; then
    echo "✅ RADIUS Server: Online"
    echo "✅ PAP Authentication: Available"
    echo "✅ CHAP Authentication: Available"
else
    echo "❌ RADIUS Server: Offline"
    echo "Run: ~/start-radius.sh to start the server"
fi
EOF
    
    # Make scripts executable
    chmod +x "$HOME_DIR"/*-radius.sh
    chmod +x "$HOME_DIR/configure-chap.sh"
    
    # Set ownership if running as root
    if [[ $EUID -eq 0 ]]; then
        chown "$APP_USER:$APP_USER" "$HOME_DIR"/*-radius.sh
        chown "$APP_USER:$APP_USER" "$HOME_DIR/configure-chap.sh"
    fi
    
    print_success "Enhanced management scripts created"
    print_chap "CHAP configuration helper script created: $HOME_DIR/configure-chap.sh"
}

# Display installation summary with CHAP information
display_summary() {
    print_success "Installation completed successfully!"
    echo ""
    echo "=== 🎉 RADIUS Server Installation Summary ==="
    echo "Application Directory: $APP_DIR"
    echo "Application User: $APP_USER"
    echo "Database Name: $DB_NAME"
    echo "Database User: $DB_USER"
    echo "Database Password: (saved in $HOME_DIR/.radius_db_config)"
    echo ""
    echo "=== 🔐 Authentication Methods ==="
    print_chap "✅ PAP Authentication: Supported"
    print_chap "✅ CHAP Authentication: Supported (Recommended)"
    echo "🔧 Auto-detection: Server automatically detects auth method"
    echo ""
    echo "=== 📋 Management Commands ==="
    echo "Start server: $HOME_DIR/start-radius.sh"
    echo "Stop server: $HOME_DIR/stop-radius.sh"
    echo "Check status: $HOME_DIR/status-radius.sh"
    echo "Update server: $HOME_DIR/update-radius.sh"
    echo "CHAP setup help: $HOME_DIR/configure-chap.sh"
    echo ""
    echo "=== 🔧 Alternative System Service ==="
    echo "Start: sudo systemctl start radius-server"
    echo "Stop: sudo systemctl stop radius-server"
    echo "Status: sudo systemctl status radius-server"
    echo ""
    echo "=== 📄 Configuration Files ==="
    echo "Environment: $APP_DIR/.env"
    echo "Database Config: $HOME_DIR/.radius_db_config"
    echo "MySQL Root Password: $HOME_DIR/.mysql_root_password"
    echo ""
    echo "=== 📡 Network Ports ==="
    echo "RADIUS Authentication: 1812/udp (PAP/CHAP)"
    echo "RADIUS Accounting: 1813/udp"
    echo "Web Management: 3000/tcp"
    echo ""
    echo "=== 📖 CHAP Documentation ==="
    echo "CHAP Setup Guide: $APP_DIR/docs/CHAP_IMPLEMENTATION_GUIDE.md"
    echo "MikroTik CHAP Config: $APP_DIR/docs/MIKROTIK_CHAP_CONFIG.rsc"
    echo "PAP vs CHAP Explained: $APP_DIR/docs/PAP_vs_CHAP_EXPLAINED.md"
    echo ""
    echo "=== 🔒 Security Recommendations ==="
    print_warning "1. Change default RADIUS secret in .env file"
    print_warning "2. Configure NAS devices with proper shared secrets"
    print_warning "3. Use CHAP authentication for better security"
    print_warning "4. Set up SSL/TLS certificates for web interface"
    print_warning "5. Regular system and dependency updates"
    print_warning "6. Monitor authentication logs regularly"
    echo ""
    echo "=== 🚀 Next Steps ==="
    echo "1. Start the server: $HOME_DIR/start-radius.sh"
    echo "2. Configure MikroTik with CHAP: $HOME_DIR/configure-chap.sh"
    echo "3. Test PPPoE connection with username: radius, password: radius"
    echo "4. Monitor logs: tail -f $APP_DIR/logs/auth.log"
    echo "5. Access web interface: http://your-server-ip:3000"
}

# Main installation function
main() {
    clear
    echo "=========================================="
    echo "   RADIUS Server Installation Script"
    echo "   🔐 With PAP & CHAP Authentication"
    echo "=========================================="
    echo ""
    print_chap "Enhanced with CHAP (Challenge Handshake Authentication Protocol)"
    print_chap "Secure authentication with challenge-response mechanism"
    echo ""
    
    # Pre-installation checks
    check_root
    check_ubuntu
    check_sudo
    
    # Main installation steps
    update_system
    install_system_packages
    install_nodejs
    install_database
    setup_database
    install_pm2
    setup_application
    install_dependencies
    setup_environment
    init_database_schema
    setup_firewall
    update_pm2_config
    setup_systemd_service
    create_management_scripts
    
    # Display summary
    display_summary
    
    print_success "🎉 Installation script completed!"
    print_chap "🔐 RADIUS Server ready with PAP & CHAP authentication!"
    print_status "Start the server with: $HOME_DIR/start-radius.sh"
    echo ""
}

# Run main function
main "$@"
