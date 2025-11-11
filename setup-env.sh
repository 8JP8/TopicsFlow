#!/bin/bash

# ===============================================
# Environment Variable Setup for ChatHub (TaskFlow)
# ===============================================
#
# This script sets environment variables for the ChatHub application
# on Linux/Mac systems.
#
# Usage:
#   chmod +x setup-env.sh
#   ./setup-env.sh
#
#   Or source it to set variables in current shell:
#   source setup-env.sh
#

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}===============================================${NC}"
echo -e "${CYAN}  ChatHub Environment Setup${NC}"
echo -e "${CYAN}  Domain: taskflow.pt${NC}"
echo -e "${CYAN}===============================================${NC}"
echo ""

# Configuration
RESEND_API_KEY="re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da"
FROM_EMAIL="chat@taskflow.pt"
APP_NAME="ChatHub"
FRONTEND_URL="http://localhost:3000"
DATABASE_URL="mongodb://localhost:27017/chatapp"
CORS_ALLOW_ALL="true"

# Set environment variables for current session
echo -e "${YELLOW}[INFO] Setting environment variables for current session...${NC}"
echo ""

export RESEND_API_KEY="$RESEND_API_KEY"
export FROM_EMAIL="$FROM_EMAIL"
export APP_NAME="$APP_NAME"
export FRONTEND_URL="$FRONTEND_URL"
export DATABASE_URL="$DATABASE_URL"
export CORS_ALLOW_ALL="$CORS_ALLOW_ALL"

echo -e "${GREEN}  ✓ RESEND_API_KEY: ****...g7Da (hidden for security)${NC}"
echo -e "${GREEN}  ✓ FROM_EMAIL: $FROM_EMAIL${NC}"
echo -e "${GREEN}  ✓ APP_NAME: $APP_NAME${NC}"
echo -e "${GREEN}  ✓ FRONTEND_URL: $FRONTEND_URL${NC}"
echo -e "${GREEN}  ✓ DATABASE_URL: $DATABASE_URL${NC}"
echo -e "${GREEN}  ✓ CORS_ALLOW_ALL: $CORS_ALLOW_ALL${NC}"
echo ""

# Determine shell configuration file
SHELL_CONFIG=""
if [ -n "$BASH_VERSION" ]; then
    if [ -f "$HOME/.bashrc" ]; then
        SHELL_CONFIG="$HOME/.bashrc"
    elif [ -f "$HOME/.bash_profile" ]; then
        SHELL_CONFIG="$HOME/.bash_profile"
    fi
elif [ -n "$ZSH_VERSION" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
fi

# Ask user if they want to set permanently
echo -e "${YELLOW}Do you want to set these variables PERMANENTLY?${NC}"
echo -e "${YELLOW}This will add them to your shell configuration file ($SHELL_CONFIG)${NC}"
echo -e "${YELLOW}and make them available in all future terminal sessions.${NC}"
echo ""
read -p "Set permanently? (y/N): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -z "$SHELL_CONFIG" ]; then
        echo -e "${RED}[ERROR] Could not determine shell configuration file.${NC}"
        echo -e "${YELLOW}Please add the following lines manually to your ~/.bashrc or ~/.zshrc:${NC}"
        echo ""
        echo "export RESEND_API_KEY=\"$RESEND_API_KEY\""
        echo "export FROM_EMAIL=\"$FROM_EMAIL\""
        echo "export APP_NAME=\"$APP_NAME\""
        echo "export FRONTEND_URL=\"$FRONTEND_URL\""
        echo "export DATABASE_URL=\"$DATABASE_URL\""
        echo "export CORS_ALLOW_ALL=\"$CORS_ALLOW_ALL\""
        echo ""
    else
        echo ""
        echo -e "${YELLOW}[INFO] Adding environment variables to $SHELL_CONFIG...${NC}"

        # Backup existing config
        cp "$SHELL_CONFIG" "${SHELL_CONFIG}.backup.$(date +%Y%m%d_%H%M%S)"
        echo -e "${GREEN}[INFO] Created backup: ${SHELL_CONFIG}.backup${NC}"

        # Add environment variables
        echo "" >> "$SHELL_CONFIG"
        echo "# ChatHub Environment Variables (added by setup-env.sh on $(date))" >> "$SHELL_CONFIG"
        echo "export RESEND_API_KEY=\"$RESEND_API_KEY\"" >> "$SHELL_CONFIG"
        echo "export FROM_EMAIL=\"$FROM_EMAIL\"" >> "$SHELL_CONFIG"
        echo "export APP_NAME=\"$APP_NAME\"" >> "$SHELL_CONFIG"
        echo "export FRONTEND_URL=\"$FRONTEND_URL\"" >> "$SHELL_CONFIG"
        echo "export DATABASE_URL=\"$DATABASE_URL\"" >> "$SHELL_CONFIG"
        echo "export CORS_ALLOW_ALL=\"$CORS_ALLOW_ALL\"" >> "$SHELL_CONFIG"

        echo -e "${GREEN}[SUCCESS] Environment variables have been added to $SHELL_CONFIG${NC}"
        echo ""
        echo -e "${CYAN}NOTE: You need to restart your terminal or run:${NC}"
        echo -e "${CYAN}      source $SHELL_CONFIG${NC}"
        echo -e "${CYAN}      for the permanent variables to take effect in new sessions.${NC}"
        echo -e "${CYAN}      The variables are already active in THIS session.${NC}"
    fi
else
    echo ""
    echo -e "${YELLOW}[INFO] Variables are set for this session only.${NC}"
    echo -e "${YELLOW}      They will be lost when you close this terminal.${NC}"
    echo ""
    echo -e "${YELLOW}To use them in future sessions, run:${NC}"
    echo -e "${YELLOW}      source setup-env.sh${NC}"
fi

# Create .env file
echo ""
echo -e "${CYAN}===============================================${NC}"
echo -e "${CYAN}  Creating .env file in backend directory${NC}"
echo -e "${CYAN}===============================================${NC}"
echo ""

if [ ! -d "backend" ]; then
    echo -e "${YELLOW}[WARNING] backend directory not found. Skipping .env file creation.${NC}"
else
    echo -e "${YELLOW}Creating backend/.env file...${NC}"

    cat > backend/.env << 'EOF'
# Flask Configuration
SECRET_KEY=your-secret-key-change-in-production
ENVIRONMENT=development

# Database Configuration
DATABASE_URL=mongodb://localhost:27017/chatapp
DB_NAME=chatapp

# Frontend Configuration
FRONTEND_URL=http://localhost:3000

# CORS Configuration
CORS_ALLOW_ALL=true

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Session Configuration
SESSION_TYPE=filesystem

# TOTP/2FA Configuration
TOTP_ISSUER=ChatHub
TOTP_VALIDITY_WINDOW=1

# Email Service (Resend)
RESEND_API_KEY=re_cW2EbAUf_KWz56Tr6eTuwN3PHBH29g7Da
FROM_EMAIL=chat@taskflow.pt
APP_NAME=ChatHub

# Rate Limiting
LOGIN_RATE_LIMIT=5/minute
MESSAGE_RATE_LIMIT=30/minute

# Logging
LOG_LEVEL=INFO
EOF

    echo -e "${GREEN}[SUCCESS] Created backend/.env file${NC}"
fi

# Display next steps
echo ""
echo -e "${CYAN}===============================================${NC}"
echo -e "${CYAN}  Setup Complete!${NC}"
echo -e "${CYAN}===============================================${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo -e "  ${GREEN}1.${NC} Verify your domain (taskflow.pt) in Resend dashboard:"
echo -e "     ${CYAN}https://resend.com/domains${NC}"
echo ""
echo -e "  ${GREEN}2.${NC} Add DNS records for taskflow.pt as shown in Resend"
echo ""
echo -e "  ${GREEN}3.${NC} Wait for domain verification (usually a few minutes)"
echo ""
echo -e "  ${GREEN}4.${NC} Start your backend:"
echo -e "     ${CYAN}cd backend${NC}"
echo -e "     ${CYAN}python app.py${NC}"
echo ""
echo -e "  ${GREEN}5.${NC} Test email sending with Postman collection"
echo ""
echo -e "${YELLOW}For more information, see: PASSWORDLESS_AUTH_SETUP.md${NC}"
echo ""
