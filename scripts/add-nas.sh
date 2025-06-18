#!/bin/bash

# Script untuk menambahkan NAS ke RADIUS Server
# Usage: ./add-nas.sh [IP_MIKROTIK] [SECRET] [DESCRIPTION]

# Warna output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

API_BASE="http://localhost:3000/api"

# Function untuk menampilkan usage
show_usage() {
    echo -e "${YELLOW}Usage:${NC}"
    echo "./add-nas.sh [IP_MIKROTIK] [SECRET] [DESCRIPTION]"
    echo ""
    echo -e "${YELLOW}Examples:${NC}"
    echo "./add-nas.sh 192.168.1.1 mikrotik123 'MikroTik Router Utama'"
    echo "./add-nas.sh 10.10.10.1 secret456 'Hotspot Branch A'"
    echo ""
    echo -e "${YELLOW}Interactive mode:${NC}"
    echo "./add-nas.sh"
    exit 1
}

# Function untuk validasi IP
validate_ip() {
    local ip=$1
    if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function untuk menambah NAS via API
add_nas() {
    local nasip=$1
    local secret=$2
    local description=$3
    local shortname=$4

    echo -e "${YELLOW}Adding NAS to RADIUS Server...${NC}"
    
    response=$(curl -s -X POST "$API_BASE/nas" \
        -H "Content-Type: application/json" \
        -d "{
            \"nasname\": \"$nasip\",
            \"shortname\": \"$shortname\",
            \"secret\": \"$secret\",
            \"description\": \"$description\",
            \"type\": \"mikrotik\",
            \"ports\": 1700
        }")

    if echo "$response" | grep -q '"success":true'; then
        echo -e "${GREEN}✅ NAS added successfully!${NC}"
        echo -e "${GREEN}NAS IP: $nasip${NC}"
        echo -e "${GREEN}Secret: $secret${NC}"
        echo -e "${GREEN}Description: $description${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed to add NAS${NC}"
        echo "$response" | jq '.' 2>/dev/null || echo "$response"
        return 1
    fi
}

# Function untuk list NAS yang ada
list_nas() {
    echo -e "\n${YELLOW}Current NAS clients:${NC}"
    curl -s "$API_BASE/nas" | jq '.data[] | {nasname, shortname, description, secret}' 2>/dev/null || echo "Failed to get NAS list"
}

# Function untuk test connectivity
test_nas_connectivity() {
    local nasip=$1
    echo -e "\n${YELLOW}Testing connectivity to $nasip...${NC}"
    
    if ping -c 3 "$nasip" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ $nasip is reachable${NC}"
        return 0
    else
        echo -e "${RED}❌ $nasip is not reachable${NC}"
        return 1
    fi
}

# Interactive mode
interactive_mode() {
    echo -e "${YELLOW}=== RADIUS NAS Configuration Tool ===${NC}"
    echo ""
    
    # Get NAS IP
    while true; do
        read -p "Enter MikroTik IP Address: " nasip
        if validate_ip "$nasip"; then
            break
        else
            echo -e "${RED}Invalid IP address format${NC}"
        fi
    done
    
    # Get secret
    read -p "Enter RADIUS secret: " secret
    if [ -z "$secret" ]; then
        secret="testing123"
        echo -e "${YELLOW}Using default secret: testing123${NC}"
    fi
    
    # Get description
    read -p "Enter description (optional): " description
    if [ -z "$description" ]; then
        description="MikroTik Router $nasip"
    fi
    
    # Generate shortname
    shortname="mikrotik-$(echo $nasip | tr '.' '-')"
    
    # Confirm
    echo ""
    echo -e "${YELLOW}Configuration Summary:${NC}"
    echo "NAS IP: $nasip"
    echo "Secret: $secret"
    echo "Shortname: $shortname"
    echo "Description: $description"
    echo ""
    
    read -p "Continue? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        # Test connectivity first
        test_nas_connectivity "$nasip"
        
        # Add NAS
        if add_nas "$nasip" "$secret" "$description" "$shortname"; then
            echo ""
            echo -e "${GREEN}🎉 NAS configuration completed!${NC}"
            echo ""
            echo -e "${YELLOW}Next steps for MikroTik:${NC}"
            echo "1. Login to MikroTik ($nasip)"
            echo "2. Run this command:"
            echo "   /radius add address=$RADIUS_SERVER_IP secret=$secret service=ppp"
            echo "3. Configure PPPoE server to use RADIUS"
            echo ""
            list_nas
        fi
    else
        echo "Cancelled."
    fi
}

# Main script
main() {
    # Check if server is running
    if ! curl -s "$API_BASE/nas" >/dev/null; then
        echo -e "${RED}❌ RADIUS Server API is not accessible${NC}"
        echo "Make sure the server is running: npm start"
        exit 1
    fi

    # Check arguments
    if [ $# -eq 0 ]; then
        # Interactive mode
        interactive_mode
    elif [ $# -eq 3 ]; then
        # Command line mode
        nasip=$1
        secret=$2
        description=$3
        shortname="mikrotik-$(echo $nasip | tr '.' '-')"
        
        if validate_ip "$nasip"; then
            test_nas_connectivity "$nasip"
            add_nas "$nasip" "$secret" "$description" "$shortname"
            echo ""
            list_nas
        else
            echo -e "${RED}Invalid IP address: $nasip${NC}"
            exit 1
        fi
    else
        show_usage
    fi
}

# Run main function
main "$@"
