#!/bin/bash

# ChatApp - Teste Local com Docker
# Inicia todos os serviços em containers com logs visíveis

set -e

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${BLUE}============================================================${NC}"
echo -e "${BLUE}  ChatApp - TESTE LOCAL COM DOCKER${NC}"
echo -e "${BLUE}  Todos os serviços em containers${NC}"
echo -e "${BLUE}============================================================${NC}"
echo ""

# Verificar Docker
echo -e "${BLUE}[VERIFICACAO] Checando Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}[ERRO] Docker não encontrado!${NC}"
    echo ""
    echo "Por favor:"
    echo "1. Instale Docker: https://docs.docker.com/get-docker/"
    echo "2. Execute este script novamente"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}[ERRO] Docker não está rodando!${NC}"
    echo ""
    echo "Por favor:"
    echo "1. Inicie o Docker daemon"
    echo "2. Execute este script novamente"
    exit 1
fi

echo -e "${GREEN}[OK] Docker encontrado e rodando!${NC}"
docker --version
echo ""

# Limpar containers antigos
echo -e "${BLUE}[LIMPEZA] Parando containers antigos...${NC}"
docker-compose -f docker-compose.local.yml down &> /dev/null || true
echo -e "${GREEN}[OK] Limpeza concluída${NC}"
echo ""

# Iniciar serviços
echo -e "${BLUE}[INICIANDO] Construindo e iniciando todos os serviços...${NC}"
echo ""
echo "Isso pode demorar alguns minutos na primeira vez..."
echo "Os logs aparecerão abaixo em tempo real."
echo ""
echo -e "${YELLOW}Pressione Ctrl+C para parar todos os serviços${NC}"
echo ""
echo "============================================================"
echo ""

# Trap para garantir cleanup ao sair
trap 'echo ""; echo "[PARANDO] Desligando serviços..."; docker-compose -f docker-compose.local.yml down; echo "[CONCLUIDO] Todos os serviços foram parados."' EXIT

# Iniciar com logs visíveis
docker-compose -f docker-compose.local.yml up --build
