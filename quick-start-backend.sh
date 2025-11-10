#!/bin/bash

# Quick Start - Backend
# Inicia o backend rapidamente com configuração padrão

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Iniciando ChatApp Backend...${NC}"
echo ""

# Verificar se MongoDB está rodando
if ! lsof -Pi :27017 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}📦 Iniciando MongoDB...${NC}"
    docker start mongodb-test 2>/dev/null || \
    docker run -d --name mongodb-test \
        -p 27017:27017 \
        -e MONGO_INITDB_ROOT_USERNAME=admin \
        -e MONGO_INITDB_ROOT_PASSWORD=password123 \
        mongo:7.0 > /dev/null 2>&1
    sleep 5
fi

# Verificar se Redis está rodando
if ! lsof -Pi :6379 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "${YELLOW}📦 Iniciando Redis...${NC}"
    docker start redis-test 2>/dev/null || \
    docker run -d --name redis-test \
        -p 6379:6379 \
        redis:7.2-alpine redis-server --requirepass password123 > /dev/null 2>&1
    sleep 2
fi

# Ir para pasta do backend
cd /home/user/RINTEP2/backend

# Ativar ambiente virtual
if [ ! -d "venv" ]; then
    echo -e "${YELLOW}📦 Criando ambiente virtual...${NC}"
    python3 -m venv venv
fi

source venv/bin/activate

# Instalar dependências se necessário
if ! pip show flask > /dev/null 2>&1; then
    echo -e "${YELLOW}📦 Instalando dependências...${NC}"
    pip install -r requirements.txt > /dev/null 2>&1
fi

# Configurar variáveis de ambiente
export FLASK_ENV=development
export DATABASE_URL="mongodb://admin:password123@localhost:27017/chatapp?authSource=admin"
export DB_NAME=chatapp
export REDIS_URL="redis://:password123@localhost:6379/0"
export SECRET_KEY="dev-secret-key-for-testing"
export FRONTEND_URL="http://localhost:3000"
export PORT=5000

echo ""
echo -e "${GREEN}✅ Ambiente configurado${NC}"
echo -e "${BLUE}📡 Iniciando servidor em http://localhost:5000${NC}"
echo ""
echo -e "${YELLOW}Pressione Ctrl+C para parar${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Iniciar aplicação
python app.py
