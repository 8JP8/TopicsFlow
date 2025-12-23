#!/bin/bash

# Prompt-based environment setup (safe to commit; does not contain secrets).

set -euo pipefail

CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}===============================================${NC}"
echo -e "${CYAN}  TopicsFlow Prompt Env Setup${NC}"
echo -e "${CYAN}===============================================${NC}"
echo ""

read -p "FROM_EMAIL (e.g. noreply@topicsflow.me): " FROM_EMAIL
read -p "FRONTEND_URL (default http://localhost:3000): " FRONTEND_URL || true
FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"

read -p "DATABASE_URL (default mongodb://localhost:27017/TopicsFlow): " DATABASE_URL || true
DATABASE_URL="${DATABASE_URL:-mongodb://localhost:27017/TopicsFlow}"

echo ""
read -s -p "RESEND_API_KEY: " RESEND_API_KEY
echo ""
read -s -p "TENOR_API_KEY (optional): " TENOR_API_KEY
echo ""

read -p "Enable ImgBB? (y/N): " USE_IMGBB_INPUT || true
USE_IMGBB="false"
IMGBB_API_KEY=""
IMGBB_EXPIRATION_SECONDS="600"
IMGBB_MAX_BASE64_SIZE_BYTES="2097152"
if [[ "${USE_IMGBB_INPUT:-}" =~ ^[Yy]$ ]]; then
  USE_IMGBB="true"
  read -s -p "IMGBB_API_KEY: " IMGBB_API_KEY
  echo ""
fi

export RESEND_API_KEY FROM_EMAIL FRONTEND_URL DATABASE_URL TENOR_API_KEY
export USE_IMGBB IMGBB_API_KEY IMGBB_EXPIRATION_SECONDS IMGBB_MAX_BASE64_SIZE_BYTES

echo ""
echo -e "${YELLOW}[INFO] Env vars set for this session:${NC}"
echo -e "${GREEN}  ✓ RESEND_API_KEY: (set)${NC}"
echo -e "${GREEN}  ✓ FROM_EMAIL: $FROM_EMAIL${NC}"
echo -e "${GREEN}  ✓ FRONTEND_URL: $FRONTEND_URL${NC}"
echo -e "${GREEN}  ✓ DATABASE_URL: $DATABASE_URL${NC}"
echo -e "${GREEN}  ✓ TENOR_API_KEY: (set/empty)${NC}"
echo -e "${GREEN}  ✓ USE_IMGBB: $USE_IMGBB${NC}"
echo -e "${GREEN}  ✓ IMGBB_API_KEY: (set/empty)${NC}"

echo ""
read -p "Set permanently by appending to your shell rc file? (y/N): " PERM || true
if [[ "${PERM:-}" =~ ^[Yy]$ ]]; then
  SHELL_CONFIG=""
  if [ -n "${BASH_VERSION:-}" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
  elif [ -n "${ZSH_VERSION:-}" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
  fi

  if [ -n "$SHELL_CONFIG" ]; then
    {
      echo ""
      echo "# TopicsFlow env vars (added by env-setup.sh on $(date))"
      echo "export RESEND_API_KEY=\"$RESEND_API_KEY\""
      echo "export FROM_EMAIL=\"$FROM_EMAIL\""
      echo "export FRONTEND_URL=\"$FRONTEND_URL\""
      echo "export DATABASE_URL=\"$DATABASE_URL\""
      echo "export TENOR_API_KEY=\"$TENOR_API_KEY\""
      echo "export USE_IMGBB=\"$USE_IMGBB\""
      echo "export IMGBB_API_KEY=\"$IMGBB_API_KEY\""
      echo "export IMGBB_EXPIRATION_SECONDS=\"$IMGBB_EXPIRATION_SECONDS\""
      echo "export IMGBB_MAX_BASE64_SIZE_BYTES=\"$IMGBB_MAX_BASE64_SIZE_BYTES\""
    } >> "$SHELL_CONFIG"
    echo -e "${GREEN}[SUCCESS] Appended to $SHELL_CONFIG${NC}"
  else
    echo -e "${YELLOW}[WARN] Could not detect shell rc file. Skipping permanent setup.${NC}"
  fi
fi

if [ -d "backend" ]; then
  cat > backend/.env << EOF
# Flask Configuration
SECRET_KEY=your-secret-key-change-in-production
ENVIRONMENT=development

# Database Configuration
DATABASE_URL=$DATABASE_URL
DB_NAME=TopicsFlow

# Frontend Configuration
FRONTEND_URL=$FRONTEND_URL

# CORS Configuration
CORS_ALLOW_ALL=true

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Session Configuration
SESSION_TYPE=filesystem

# TOTP/2FA Configuration
TOTP_ISSUER=TopicsFlow
TOTP_VALIDITY_WINDOW=1

# Email Service (Resend)
RESEND_API_KEY=$RESEND_API_KEY
FROM_EMAIL=$FROM_EMAIL
APP_NAME=TopicsFlow

# GIF Service (Tenor)
TENOR_API_KEY=$TENOR_API_KEY
TENOR_CLIENT_KEY=topicsflow_app

# ImgBB (optional)
USE_IMGBB=$USE_IMGBB
IMGBB_API_KEY=$IMGBB_API_KEY
IMGBB_EXPIRATION_SECONDS=$IMGBB_EXPIRATION_SECONDS
IMGBB_MAX_BASE64_SIZE_BYTES=$IMGBB_MAX_BASE64_SIZE_BYTES
EOF
  echo -e "${GREEN}[SUCCESS] Wrote backend/.env${NC}"
else
  echo -e "${YELLOW}[WARN] backend/ not found; skipped backend/.env creation${NC}"
fi


