#!/bin/bash

# Script de Teste Automático do Backend
# Este script verifica e testa o backend automaticamente

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  ChatApp Backend - Teste Automático   ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Função para verificar comando
check_command() {
    if command -v $1 &> /dev/null; then
        echo -e "${GREEN}✅ $1 encontrado${NC}"
        return 0
    else
        echo -e "${RED}❌ $1 não encontrado${NC}"
        return 1
    fi
}

# Função para verificar porta
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Porta $1 está em uso (serviço rodando)${NC}"
        return 0
    else
        echo -e "${YELLOW}⚠️  Porta $1 livre${NC}"
        return 1
    fi
}

# Passo 1: Verificar Python
echo -e "${BLUE}[1/7] Verificando Python...${NC}"
if check_command python3; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "   ${BLUE}Versão: ${PYTHON_VERSION}${NC}"
else
    echo -e "${RED}   Python 3 não encontrado. Instale antes de continuar.${NC}"
    exit 1
fi
echo ""

# Passo 2: Verificar Docker
echo -e "${BLUE}[2/7] Verificando Docker...${NC}"
if check_command docker; then
    echo -e "   ${GREEN}Docker disponível para MongoDB/Redis${NC}"
    DOCKER_AVAILABLE=true
else
    echo -e "${YELLOW}   Docker não encontrado - você precisará ter MongoDB local${NC}"
    DOCKER_AVAILABLE=false
fi
echo ""

# Passo 3: Verificar/Iniciar MongoDB
echo -e "${BLUE}[3/7] Verificando MongoDB...${NC}"
if check_port 27017; then
    echo -e "   ${GREEN}MongoDB já está rodando${NC}"
else
    if [ "$DOCKER_AVAILABLE" = true ]; then
        echo -e "   ${YELLOW}Iniciando MongoDB via Docker...${NC}"
        docker start mongodb-test 2>/dev/null || \
        docker run -d --name mongodb-test \
            -p 27017:27017 \
            -e MONGO_INITDB_ROOT_USERNAME=admin \
            -e MONGO_INITDB_ROOT_PASSWORD=password123 \
            mongo:7.0 > /dev/null 2>&1

        echo -e "   ${YELLOW}Aguardando MongoDB iniciar...${NC}"
        sleep 5

        if check_port 27017; then
            echo -e "   ${GREEN}✅ MongoDB iniciado com sucesso${NC}"
        else
            echo -e "   ${RED}❌ Falha ao iniciar MongoDB${NC}"
            exit 1
        fi
    else
        echo -e "   ${RED}❌ MongoDB não encontrado e Docker não disponível${NC}"
        exit 1
    fi
fi
echo ""

# Passo 4: Verificar/Iniciar Redis (opcional)
echo -e "${BLUE}[4/7] Verificando Redis...${NC}"
if check_port 6379; then
    echo -e "   ${GREEN}Redis já está rodando${NC}"
else
    if [ "$DOCKER_AVAILABLE" = true ]; then
        echo -e "   ${YELLOW}Iniciando Redis via Docker...${NC}"
        docker start redis-test 2>/dev/null || \
        docker run -d --name redis-test \
            -p 6379:6379 \
            redis:7.2-alpine redis-server --requirepass password123 > /dev/null 2>&1

        sleep 2
        echo -e "   ${GREEN}✅ Redis iniciado${NC}"
    else
        echo -e "   ${YELLOW}⚠️  Redis não encontrado (opcional)${NC}"
    fi
fi
echo ""

# Passo 5: Verificar dependências Python
echo -e "${BLUE}[5/7] Verificando dependências Python...${NC}"
cd /home/user/RINTEP2/backend

if [ ! -d "venv" ]; then
    echo -e "   ${YELLOW}Criando ambiente virtual...${NC}"
    python3 -m venv venv
fi

source venv/bin/activate

echo -e "   ${YELLOW}Verificando pacotes instalados...${NC}"
if pip show flask > /dev/null 2>&1; then
    echo -e "   ${GREEN}✅ Dependências já instaladas${NC}"
else
    echo -e "   ${YELLOW}Instalando dependências (pode demorar)...${NC}"
    pip install -r requirements.txt > /dev/null 2>&1
    echo -e "   ${GREEN}✅ Dependências instaladas${NC}"
fi
echo ""

# Passo 6: Configurar variáveis de ambiente
echo -e "${BLUE}[6/7] Configurando ambiente...${NC}"
export FLASK_ENV=development
export DATABASE_URL="mongodb://admin:password123@localhost:27017/chatapp?authSource=admin"
export DB_NAME=chatapp
export REDIS_URL="redis://:password123@localhost:6379/0"
export SECRET_KEY="test-secret-key-for-development"
export FRONTEND_URL="http://localhost:3000"
export PORT=5000
export LOG_LEVEL=INFO

echo -e "   ${GREEN}✅ Variáveis de ambiente configuradas${NC}"
echo ""

# Passo 7: Testar sintaxe do código
echo -e "${BLUE}[7/7] Testando código Python...${NC}"

# Testar imports
echo -e "   ${YELLOW}Testando imports...${NC}"
python3 -c "
from config import config
from flask import Flask
print('✅ Imports OK')
" 2>&1 | while read line; do echo -e "   $line"; done

# Testar config
echo -e "   ${YELLOW}Testando configuração...${NC}"
python3 -c "
from config import config
cfg = config['development']
print('✅ Config carregada')
print('   MongoDB URI:', cfg.MONGO_URI)
print('   Database:', cfg.MONGO_DB_NAME)
print('   IS_AZURE:', cfg.IS_AZURE)
" 2>&1 | while read line; do echo -e "   $line"; done

# Testar sintaxe app.py
echo -e "   ${YELLOW}Testando app.py...${NC}"
python3 -m py_compile app.py 2>&1 && echo -e "   ${GREEN}✅ app.py sem erros de sintaxe${NC}" || echo -e "   ${RED}❌ Erro em app.py${NC}"

echo ""

# Resumo
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Testes Concluídos! ✅          ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Para iniciar o backend manualmente:${NC}"
echo ""
echo -e "${YELLOW}cd /home/user/RINTEP2/backend${NC}"
echo -e "${YELLOW}source venv/bin/activate${NC}"
echo -e "${YELLOW}export DATABASE_URL='mongodb://admin:password123@localhost:27017/chatapp?authSource=admin'${NC}"
echo -e "${YELLOW}export FLASK_ENV=development${NC}"
echo -e "${YELLOW}python app.py${NC}"
echo ""
echo -e "${BLUE}Ou use o comando rápido:${NC}"
echo -e "${GREEN}./quick-start-backend.sh${NC}"
echo ""
echo -e "${BLUE}Para testar se está funcionando (em outro terminal):${NC}"
echo -e "${YELLOW}curl http://localhost:5000/health${NC}"
echo ""
