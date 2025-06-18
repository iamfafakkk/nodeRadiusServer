#!/bin/bash

# RADIUS Server Installation Script for Ubuntu VPS
# This script can be run without root access
# Author: Auto-generated
# Date: June 18, 2025

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="nodeRadiusServer"
APP_DIR="$HOME/$APP_NAME"
NODE_VERSION="18"
DB_NAME="radius_db"
DB_USER="radius_user"
DB_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

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

# Check if running as root
check_root() {
    if [[ $EUID -eq 0 ]]; then
        print_error "This script should NOT be run as root for security reasons."
        print_status "Please run as a regular user with sudo privileges."
        exit 1
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
    sudo apt update && sudo apt upgrade -y
    print_success "System packages updated"
}

# Install required system packages
install_system_packages() {
    print_status "Installing required system packages..."
    
    # Essential packages
    sudo apt install -y \
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
        tree
    
    print_success "System packages installed"
}

# Install Node.js using NodeSource repository
install_nodejs() {
    print_status "Installing Node.js $NODE_VERSION..."
    
    # Remove any existing Node.js
    sudo apt remove -y nodejs npm 2>/dev/null || true
    
    # Add NodeSource repository
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | sudo -E bash -
    
    # Install Node.js
    sudo apt install -y nodejs
    
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
    sudo apt install -y mariadb-server mariadb-client
    
    # Start and enable MariaDB
    sudo systemctl start mariadb
    sudo systemctl enable mariadb
    
    # Secure MariaDB installation (automated)
    print_status "Securing MariaDB installation..."
    
    # Set root password
    ROOT_PASS=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)
    
    sudo mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED BY '$ROOT_PASS';"
    sudo mysql -e "DELETE FROM mysql.user WHERE User='';"
    sudo mysql -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');"
    sudo mysql -e "DROP DATABASE IF EXISTS test;"
    sudo mysql -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';"
    sudo mysql -e "FLUSH PRIVILEGES;"
    
    # Save root password
    echo "$ROOT_PASS" > "$HOME/.mysql_root_password"
    chmod 600 "$HOME/.mysql_root_password"
    
    print_success "MariaDB installed and secured"
    print_status "Root password saved to: $HOME/.mysql_root_password"
}

# Setup database for RADIUS
setup_database() {
    print_status "Setting up RADIUS database..."
    
    ROOT_PASS=$(cat "$HOME/.mysql_root_password")
    
    # Create database and user
    mysql -u root -p"$ROOT_PASS" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"
    mysql -u root -p"$ROOT_PASS" -e "CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASS';"
    mysql -u root -p"$ROOT_PASS" -e "GRANT ALL PRIVILEGES ON $DB_NAME.* TO '$DB_USER'@'localhost';"
    mysql -u root -p"$ROOT_PASS" -e "FLUSH PRIVILEGES;"
    
    # Save database credentials
    cat > "$HOME/.radius_db_config" << EOF
DB_HOST=localhost
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
EOF
    chmod 600 "$HOME/.radius_db_config"
    
    print_success "Database setup completed"
    print_status "Database credentials saved to: $HOME/.radius_db_config"
}

# Install PM2 for process management
install_pm2() {
    print_status "Installing PM2 process manager..."
    
    npm install -g pm2
    
    # Setup PM2 startup script
    pm2 startup | grep -E "sudo.*pm2" | bash || true
    
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
        npm install --production
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
    source "$HOME/.radius_db_config"
    
    # Create .env file if it doesn't exist
    if [[ ! -f ".env" ]]; then
        cat > ".env" << EOF
# Database Configuration
DB_HOST=$DB_HOST
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS

# Server Configuration
RADIUS_PORT=1812
RADIUS_SECRET=your-radius-secret-here
SERVER_PORT=3000

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/server.log

# Environment
NODE_ENV=production
EOF
        print_success "Environment file created"
    else
        print_status "Environment file already exists"
    fi
    
    # Create logs directory
    mkdir -p logs
    
    # Set proper permissions
    chmod 644 .env
    chmod 755 logs
}

# Initialize database schema
init_database_schema() {
    print_status "Initializing database schema..."
    
    cd "$APP_DIR"
    
    if [[ -f "database/setup.sql" ]]; then
        source "$HOME/.radius_db_config"
        mysql -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < database/setup.sql
        print_success "Database schema initialized"
    else
        print_warning "Database setup file not found. Skipping schema initialization."
    fi
}

# Setup firewall rules
setup_firewall() {
    print_status "Configuring firewall rules..."
    
    # Check if UFW is available
    if command -v ufw >/dev/null 2>&1; then
        # Enable UFW if not already enabled
        sudo ufw --force enable
        
        # Allow SSH (important!)
        sudo ufw allow ssh
        
        # Allow RADIUS ports
        sudo ufw allow 1812/udp comment 'RADIUS Authentication'
        sudo ufw allow 1813/udp comment 'RADIUS Accounting'
        
        # Allow web interface (if applicable)
        sudo ufw allow 3000/tcp comment 'RADIUS Web Interface'
        
        # Reload firewall
        sudo ufw reload
        
        print_success "Firewall configured"
    else
        print_warning "UFW not available. Please configure firewall manually."
    fi
}

# Setup systemd service (alternative to PM2)
setup_systemd_service() {
    print_status "Creating systemd service..."
    
    sudo tee /etc/systemd/system/radius-server.service > /dev/null << EOF
[Unit]
Description=Node.js RADIUS Server
After=network.target mysql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=radius-server

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    sudo systemctl daemon-reload
    sudo systemctl enable radius-server.service
    
    print_success "Systemd service created and enabled"
}

# Create management scripts
create_management_scripts() {
    print_status "Creating management scripts..."
    
    # Start script
    cat > "$HOME/start-radius.sh" << 'EOF'
#!/bin/bash
cd ~/nodeRadiusServer
pm2 start ecosystem.config.js
echo "RADIUS Server started with PM2"
pm2 status
EOF
    
    # Stop script
    cat > "$HOME/stop-radius.sh" << 'EOF'
#!/bin/bash
pm2 stop all
echo "RADIUS Server stopped"
EOF
    
    # Status script
    cat > "$HOME/status-radius.sh" << 'EOF'
#!/bin/bash
echo "=== PM2 Status ==="
pm2 status
echo ""
echo "=== System Service Status ==="
sudo systemctl status radius-server.service --no-pager
echo ""
echo "=== Recent Logs ==="
tail -n 20 ~/nodeRadiusServer/logs/server.log
EOF
    
    # Update script
    cat > "$HOME/update-radius.sh" << 'EOF'
#!/bin/bash
cd ~/nodeRadiusServer
echo "Stopping server..."
pm2 stop all
echo "Pulling updates..."
git pull origin main
echo "Installing dependencies..."
npm install --production
echo "Starting server..."
pm2 start ecosystem.config.js
echo "Update completed!"
EOF
    
    # Make scripts executable
    chmod +x "$HOME"/*-radius.sh
    
    print_success "Management scripts created in home directory"
}

# Display installation summary
display_summary() {
    print_success "Installation completed successfully!"
    echo ""
    echo "=== Installation Summary ==="
    echo "Application Directory: $APP_DIR"
    echo "Database Name: $DB_NAME"
    echo "Database User: $DB_USER"
    echo "Database Password: (saved in $HOME/.radius_db_config)"
    echo ""
    echo "=== Management Commands ==="
    echo "Start server: ~/start-radius.sh"
    echo "Stop server: ~/stop-radius.sh"
    echo "Check status: ~/status-radius.sh"
    echo "Update server: ~/update-radius.sh"
    echo ""
    echo "=== Alternative System Service ==="
    echo "Start: sudo systemctl start radius-server"
    echo "Stop: sudo systemctl stop radius-server"
    echo "Status: sudo systemctl status radius-server"
    echo ""
    echo "=== Configuration Files ==="
    echo "Environment: $APP_DIR/.env"
    echo "Database Config: $HOME/.radius_db_config"
    echo "MySQL Root Password: $HOME/.mysql_root_password"
    echo ""
    echo "=== Important Notes ==="
    echo "1. Update the RADIUS_SECRET in .env file"
    echo "2. Configure your NAS devices to point to this server"
    echo "3. Default ports: 1812 (auth), 1813 (accounting), 3000 (web)"
    echo "4. Logs are stored in: $APP_DIR/logs/"
    echo ""
    print_warning "Please secure your server by:"
    print_warning "1. Changing default passwords"
    print_warning "2. Configuring proper firewall rules"
    print_warning "3. Setting up SSL/TLS certificates"
    print_warning "4. Regular system updates"
}

# Main installation function
main() {
    clear
    echo "=========================================="
    echo "   RADIUS Server Installation Script"
    echo "=========================================="
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
    setup_systemd_service
    create_management_scripts
    
    # Display summary
    display_summary
    
    print_success "Installation script completed!"
    print_status "You can now start the RADIUS server using: ~/start-radius.sh"
}

# Run main function
main "$@"
