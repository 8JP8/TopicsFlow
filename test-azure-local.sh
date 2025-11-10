#!/bin/bash

# Script para testar build Azure localmente
# Este script constrói a imagem Docker Azure e testa localmente

set -e

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   Teste Local - Build Azure           ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Passo 1: Build da imagem
echo -e "${BLUE}[1/5] Construindo imagem Docker Azure...${NC}"
echo -e "${YELLOW}Isso pode demorar 5-15 minutos na primeira vez...${NC}"
echo ""

docker build -f Dockerfile.azure -t chatapp-azure:local .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Imagem construída com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro ao construir imagem${NC}"
    exit 1
fi

echo ""

# Passo 2: Verificar se MongoDB está rodando
echo -e "${BLUE}[2/5] Verificando MongoDB...${NC}"

if docker ps | grep -q mongodb-test; then
    echo -e "${GREEN}✅ MongoDB já está rodando${NC}"
else
    echo -e "${YELLOW}MongoDB não encontrado. Iniciando...${NC}"
    docker run -d \
        --name mongodb-test \
        -p 27017:27017 \
        -e MONGO_INITDB_ROOT_USERNAME=admin \
        -e MONGO_INITDB_ROOT_PASSWORD=password123 \
        mongo:7.0

    echo -e "${YELLOW}Aguardando MongoDB iniciar...${NC}"
    sleep 5
    echo -e "${GREEN}✅ MongoDB iniciado${NC}"
fi

echo ""

# Passo 3: Parar container antigo se existir
echo -e "${BLUE}[3/5] Limpando containers antigos...${NC}"
docker stop chatapp-azure-test 2>/dev/null || true
docker rm chatapp-azure-test 2>/dev/null || true
echo -e "${GREEN}✅ Limpeza concluída${NC}"
echo ""

# Passo 4: Iniciar container Azure
echo -e "${BLUE}[4/5] Iniciando container Azure...${NC}"

# Detectar sistema operacional para usar host correto
if [[ "$OSTYPE" == "darwin"* ]] || [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "win32" ]]; then
    # macOS ou Windows - usa host.docker.internal
    MONGO_HOST="host.docker.internal"
else
    # Linux - usa IP do host
    MONGO_HOST=$(ip route | grep docker0 | awk '{print $9}' || echo "172.17.0.1")
fi

echo -e "${YELLOW}Usando MongoDB host: ${MONGO_HOST}${NC}"

docker run -d \
    --name chatapp-azure-test \
    -p 8000:8000 \
    -e AZURE_COSMOS_CONNECTIONSTRING="mongodb://admin:password123@${MONGO_HOST}:27017/chatapp?authSource=admin" \
    -e AZURE_COSMOS_DATABASE="chatapp" \
    -e SECRET_KEY="test-secret-key-local" \
    -e FRONTEND_URL="http://localhost:8000" \
    chatapp-azure:local

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Container iniciado!${NC}"
else
    echo -e "${RED}❌ Erro ao iniciar container${NC}"
    docker logs chatapp-azure-test
    exit 1
fi

echo ""
echo -e "${YELLOW}Aguardando aplicação iniciar...${NC}"
sleep 10

# Passo 5: Testar aplicação
echo -e "${BLUE}[5/5] Testando aplicação...${NC}"
echo ""

# Teste 1: Health check
echo -e "${YELLOW}Teste 1: Health check...${NC}"
HEALTH_RESPONSE=$(curl -s http://localhost:8000/health || echo "ERRO")

if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
    echo -e "${GREEN}✅ Health check OK${NC}"
    echo -e "   Response: ${HEALTH_RESPONSE}"
else
    echo -e "${RED}❌ Health check falhou${NC}"
    echo -e "   Response: ${HEALTH_RESPONSE}"
    echo ""
    echo -e "${YELLOW}Logs do container:${NC}"
    docker logs chatapp-azure-test | tail -20
    exit 1
fi

echo ""

# Teste 2: API root
echo -e "${YELLOW}Teste 2: API Root...${NC}"
API_RESPONSE=$(curl -s http://localhost:8000/ || echo "ERRO")

if [[ "$API_RESPONSE" == *"ChatApp"* ]] || [[ "$API_RESPONSE" == *"html"* ]]; then
    echo -e "${GREEN}✅ API respondendo${NC}"
    echo -e "   Response: ${API_RESPONSE:0:100}..."
else
    echo -e "${YELLOW}⚠️  API retornou resposta diferente${NC}"
    echo -e "   Response: ${API_RESPONSE:0:100}..."
fi

echo ""

# Resumo
echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   Teste Concluído com Sucesso! ✅      ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Informações:${NC}"
echo -e "  📦 Imagem: chatapp-azure:local"
echo -e "  🐳 Container: chatapp-azure-test"
echo -e "  🌐 URL: ${GREEN}http://localhost:8000${NC}"
echo -e "  🏥 Health: ${GREEN}http://localhost:8000/health${NC}"
echo ""
echo -e "${BLUE}Comandos úteis:${NC}"
echo -e "  Ver logs:      ${YELLOW}docker logs -f chatapp-azure-test${NC}"
echo -e "  Parar:         ${YELLOW}docker stop chatapp-azure-test${NC}"
echo -e "  Reiniciar:     ${YELLOW}docker restart chatapp-azure-test${NC}"
echo -e "  Remover:       ${YELLOW}docker rm -f chatapp-azure-test${NC}"
echo ""
echo -e "${GREEN}✨ Teste no navegador: http://localhost:8000${NC}"
echo ""
