#!/bin/bash

# ChatApp - Teste Local NATIVO (sem Docker)
# Backend rodando diretamente no sistema

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  ChatApp - TESTE LOCAL NATIVO (Sem Docker)${NC}"
echo -e "${BLUE}  Backend rodando diretamente no sistema${NC}"
echo -e "${BLUE}  Dependencias instaladas no sistema (sem venv)${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Verificar Python
echo -e "${BLUE}[1/4] Verificando Python...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[ERRO] Python não encontrado!${NC}"
    echo "Instale Python 3.11+: https://www.python.org/downloads/"
    exit 1
fi
python3 --version
echo ""

# Verificar e instalar dependências Python PRIMEIRO (direto no sistema)
echo -e "${BLUE}[2/4] Verificando e instalando dependencias Python...${NC}"
cd backend

echo -e "${BLUE}[ACAO] Atualizando pip, setuptools e wheel...${NC}"
python3 -m pip install --upgrade pip setuptools wheel &> /dev/null

echo -e "${BLUE}[ACAO] Verificando se dependencias estao instaladas...${NC}"
if ! pip3 show flask &> /dev/null; then
    echo -e "${BLUE}[ACAO] Instalando dependencias no sistema (pode demorar alguns minutos)...${NC}"
    echo ""
    pip3 install -r requirements.txt
    if [ $? -ne 0 ]; then
        echo ""
        echo -e "${RED}[ERRO] Falha ao instalar dependencias!${NC}"
        exit 1
    fi
    echo ""
    echo -e "${GREEN}[OK] Dependencias instaladas com sucesso!${NC}"
else
    echo -e "${BLUE}[ACAO] Verificando e atualizando dependencias se necessario...${NC}"
    pip3 install --upgrade -r requirements.txt &> /dev/null
    if [ $? -ne 0 ]; then
        echo -e "${YELLOW}[AVISO] Algumas dependencias podem precisar de atualizacao manual${NC}"
    fi
    echo -e "${GREEN}[OK] Dependencias verificadas${NC}"
fi
echo ""

# Agora sim verificar MongoDB (depois de ter pymongo instalado)
echo -e "${BLUE}[3/4] Verificando MongoDB...${NC}"
MONGO_RUNNING=0

echo -e "${BLUE}[ACAO] Testando conexao MongoDB...${NC}"
if python3 -c "from pymongo import MongoClient; MongoClient('mongodb://localhost:27017', serverSelectionTimeoutMS=2000).admin.command('ping')" &> /dev/null; then
    echo -e "${GREEN}[OK] MongoDB local encontrado em localhost:27017${NC}"
    MONGO_RUNNING=1
else
    # Verificar se Docker está disponível
    if command -v docker &> /dev/null && docker info &> /dev/null; then
        echo -e "${YELLOW}[AVISO] MongoDB local não encontrado${NC}"
        echo -e "${BLUE}[ACAO] Iniciando MongoDB via Docker...${NC}"
        docker start mongodb-test &> /dev/null || docker run -d --name mongodb-test -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
        echo -e "${BLUE}[ACAO] Aguardando MongoDB iniciar...${NC}"
        sleep 5

        # Testar novamente
        if python3 -c "from pymongo import MongoClient; MongoClient('mongodb://localhost:27017', serverSelectionTimeoutMS=2000).admin.command('ping')" &> /dev/null; then
            echo -e "${GREEN}[OK] MongoDB iniciado via Docker${NC}"
            MONGO_RUNNING=1
        else
            echo -e "${YELLOW}[AVISO] MongoDB pode não estar pronto ainda${NC}"
            echo -e "${BLUE}[ACAO] Continuando... App tentará conectar ao iniciar${NC}"
            MONGO_RUNNING=1
        fi
    else
        echo -e "${RED}[ERRO] MongoDB não encontrado e Docker não disponível!${NC}"
        echo ""
        echo "Opções:"
        echo "1. Instale MongoDB: https://www.mongodb.com/try/download/community"
        echo "2. OU instale Docker para usar MongoDB em container"
        exit 1
    fi
fi
echo ""

# Criar/verificar arquivo .env
echo -e "${BLUE}[4/4] Configurando variáveis de ambiente...${NC}"
if [ ! -f ".env" ]; then
    echo -e "${BLUE}[ACAO] Criando arquivo .env...${NC}"
    cat > .env << 'EOF'
# Modo LOCAL - Não Azure
FLASK_ENV=development
FORCE_LOCAL_MODE=true

# Database local
DATABASE_URL=mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
DB_NAME=chatapp

# Redis local (opcional)
REDIS_URL=redis://:password123@localhost:6379/0

# Secret key
SECRET_KEY=dev-secret-key-local-native-testing

# Frontend
FRONTEND_URL=http://localhost:3000

# Server
PORT=5000

# Debug
LOG_LEVEL=DEBUG
PYTHONUNBUFFERED=1
EOF
    echo -e "${GREEN}[OK] Arquivo .env criado${NC}"
else
    echo -e "${GREEN}[OK] Arquivo .env existente${NC}"
fi
echo ""

# Mostrar configuração
echo -e "${BLUE}Configuração atual:${NC}"
echo "============================================================"
cat .env
echo "============================================================"
echo ""

# Iniciar backend
echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  INICIANDO BACKEND${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""
echo -e "${GREEN}Backend rodando em: http://localhost:5000${NC}"
echo -e "${GREEN}Health check:       http://localhost:5000/health${NC}"
echo ""
echo -e "${YELLOW}Pressione Ctrl+C para parar o servidor${NC}"
echo ""
echo "============================================================"
echo ""

# Iniciar com Python diretamente (logs visíveis)
python3 app.py

# Quando usuário para
echo ""
echo -e "${YELLOW}[PARADO] Servidor backend parado.${NC}"
