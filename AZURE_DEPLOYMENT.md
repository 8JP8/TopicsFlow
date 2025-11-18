# Azure Deployment Guide for ChatApp

Este guia explica como fazer o deployment da aplicação ChatApp no Azure usando Azure Container Apps com CosmosDB (MongoDB API).

## Índice

1. [Arquitetura](#arquitetura)
2. [Pré-requisitos](#pré-requisitos)
3. [Configuração Local vs Azure](#configuração-local-vs-azure)
4. [Deployment Automatizado](#deployment-automatizado)
5. [Deployment Manual](#deployment-manual)
6. [Teste Local da Build Azure](#teste-local-da-build-azure)
7. [Variáveis de Ambiente](#variáveis-de-ambiente)
8. [Troubleshooting](#troubleshooting)

## Arquitetura

A aplicação foi adaptada para funcionar em dois ambientes:

### Local (Desenvolvimento)
- **Backend**: Flask + SocketIO
- **Frontend**: Next.js (servidor de desenvolvimento)
- **Database**: MongoDB local
- **Cache**: Redis local
- **Deployment**: Docker Compose

### Azure (Produção)
- **Backend**: Flask + SocketIO + Frontend estático servido pelo Flask
- **Frontend**: Next.js compilado estaticamente (dentro do container)
- **Database**: Azure CosmosDB (MongoDB API)
- **Cache**: Azure Cache for Redis (opcional)
- **Deployment**: Azure Container Apps

### Detecção Automática de Ambiente

O código detecta automaticamente se está rodando no Azure através das variáveis:
- `WEBSITE_INSTANCE_ID` (Azure App Service)
- `AZURE_COSMOS_CONNECTIONSTRING` (Presença de CosmosDB)

## Pré-requisitos

### Para Deployment
1. **Conta Azure** com subscrição ativa
2. **Azure CLI** instalado ([Download](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli))
3. **Docker** instalado ([Download](https://docs.docker.com/get-docker/))
4. **Git** para clonar o repositório

### Verificar Instalações
```bash
# Verificar Azure CLI
az --version

# Verificar Docker
docker --version

# Login no Azure
az login
```

## Configuração Local vs Azure

### Backend (config.py)

O arquivo `backend/config.py` detecta automaticamente o ambiente:

```python
# Detecta ambiente Azure
IS_AZURE = os.getenv('WEBSITE_INSTANCE_ID') is not None or \
           os.getenv('AZURE_COSMOS_CONNECTIONSTRING') is not None

# Se Azure, usa CosmosDB
if IS_AZURE:
    MONGO_URI = os.getenv('AZURE_COSMOS_CONNECTIONSTRING')
    MONGO_DB_NAME = os.getenv('AZURE_COSMOS_DATABASE', 'chatapp')
    COSMOS_SSL = True
    COSMOS_RETRY_WRITES = False  # CosmosDB não suporta retryWrites
else:
    # MongoDB local
    MONGO_URI = os.getenv('DATABASE_URL', 'mongodb://localhost:27017/chatapp')
    MONGO_DB_NAME = os.getenv('DB_NAME', 'chatapp')
```

### Frontend

O frontend tem duas configurações:

1. **Local**: `next.config.js` - Servidor de desenvolvimento
2. **Azure**: `next.config.azure.js` - Export estático

## Deployment Automatizado

### 1. Configurar Variáveis de Ambiente

Copie o arquivo de exemplo e preencha com seus valores:

```bash
cp .env.azure.example .env.azure
```

Edite `.env.azure` com suas configurações:

```bash
# Mínimo necessário
AZURE_RESOURCE_GROUP=chatapp-rg
AZURE_CONTAINER_REGISTRY=chatappacr
AZURE_COSMOS_ACCOUNT=chatapp-cosmos
SECRET_KEY=$(openssl rand -base64 32)
```

### 2. Fazer Source das Variáveis

```bash
source .env.azure
# ou
export $(cat .env.azure | xargs)
```

### 3. Executar Script de Deployment

```bash
./azure-deploy.sh
```

O script irá automaticamente:
1. ✅ Criar Resource Group
2. ✅ Criar Azure Container Registry
3. ✅ Build e push da imagem Docker
4. ✅ Criar CosmosDB Account (MongoDB API)
5. ✅ Criar Redis Cache (opcional)
6. ✅ Criar Container Apps Environment
7. ✅ Deploy da aplicação

### 4. Verificar Deployment

Após o deployment, o script exibirá a URL da aplicação:

```
Application URL: https://chatapp.azurecontainerapps.io
Health Check: https://chatapp.azurecontainerapps.io/health
```

## Deployment Manual

Se preferir fazer deployment manual:

### 1. Build da Imagem Docker

```bash
# Build local
docker build -f Dockerfile.azure -t chatapp-azure:latest .

# Ou build direto no ACR
az acr build \
  --registry chatappacr \
  --image chatapp-azure:latest \
  --file Dockerfile.azure \
  .
```

### 2. Criar CosmosDB

```bash
# Criar conta CosmosDB com MongoDB API
az cosmosdb create \
  --name chatapp-cosmos \
  --resource-group chatapp-rg \
  --kind MongoDB \
  --server-version 4.2

# Obter connection string
az cosmosdb keys list \
  --name chatapp-cosmos \
  --resource-group chatapp-rg \
  --type connection-strings \
  --query "connectionStrings[0].connectionString" \
  --output tsv
```

### 3. Criar Container App

```bash
az containerapp create \
  --name chatapp \
  --resource-group chatapp-rg \
  --environment chatapp-env \
  --image chatappacr.azurecr.io/chatapp-azure:latest \
  --target-port 8000 \
  --ingress external \
  --registry-server chatappacr.azurecr.io \
  --cpu 1.0 \
  --memory 2Gi \
  --min-replicas 1 \
  --max-replicas 10 \
  --env-vars \
    FLASK_ENV=azure \
    AZURE_COSMOS_CONNECTIONSTRING=<sua-connection-string> \
    AZURE_COSMOS_DATABASE=chatapp
```

## Teste Local da Build Azure

Você pode testar a build Azure localmente antes de fazer deploy:

### Opção 1: Build e Teste Manual

```bash
# Build da imagem
docker build -f Dockerfile.azure -t chatapp-azure:latest .

# Executar localmente
docker run -d \
  --name chatapp-test \
  -p 8000:8000 \
  -e AZURE_COSMOS_CONNECTIONSTRING="mongodb://localhost:27017/chatapp" \
  -e AZURE_COSMOS_DATABASE="chatapp" \
  chatapp-azure:latest

# Testar
curl http://localhost:8000/health

# Parar e remover
docker stop chatapp-test && docker rm chatapp-test
```

### Opção 2: Docker Compose

```bash
# Usar docker-compose.azure.yml com perfil local-test
docker-compose -f docker-compose.azure.yml --profile local-test up -d

# A aplicação estará disponível em http://localhost:8000
```

### Opção 3: Script de Build

```bash
# Build e teste automático
./azure-build.sh --test
```

## Variáveis de Ambiente

### Obrigatórias

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `AZURE_COSMOS_CONNECTIONSTRING` | Connection string do CosmosDB | `mongodb://...` |
| `SECRET_KEY` | Chave secreta do Flask | `openssl rand -base64 32` |

### Opcionais

| Variável | Descrição | Default |
|----------|-----------|---------|
| `AZURE_COSMOS_DATABASE` | Nome do database | `chatapp` |
| `AZURE_REDIS_CONNECTIONSTRING` | Redis connection string | - |
| `FRONTEND_URL` | URL da aplicação | Auto-detectado |
| `TOTP_ISSUER` | Nome do issuer TOTP | `ChatHub` |
| `TENOR_API_KEY` | API key do Tenor (GIFs) | - |
| `LOG_LEVEL` | Nível de logging | `INFO` |

### Configurar Variáveis no Azure

```bash
# Via Azure CLI
az containerapp update \
  --name chatapp \
  --resource-group chatapp-rg \
  --set-env-vars \
    TENOR_API_KEY=your-key \
    LOG_LEVEL=DEBUG

# Via Portal Azure
# Container Apps > chatapp > Revision management > Create new revision > Environment variables
```

## Troubleshooting

### 1. Erro de Conexão com CosmosDB

**Problema**: `Failed to connect to database`

**Solução**:
```bash
# Verificar connection string
az cosmosdb keys list \
  --name chatapp-cosmos \
  --resource-group chatapp-rg \
  --type connection-strings

# Verificar firewall do CosmosDB
az cosmosdb update \
  --name chatapp-cosmos \
  --resource-group chatapp-rg \
  --enable-public-network true
```

### 2. Container não Inicia

**Problema**: Container App não inicia ou reinicia constantemente

**Solução**:
```bash
# Ver logs
az containerapp logs show \
  --name chatapp \
  --resource-group chatapp-rg \
  --follow

# Verificar health check
curl https://chatapp.azurecontainerapps.io/health
```

### 3. Frontend não Carrega

**Problema**: API funciona mas frontend não carrega

**Solução**:
- Verificar se a pasta `static` foi criada no container
- Reconstruir a imagem: `./azure-build.sh`
- Verificar logs do build do Next.js

### 4. Erro SSL com CosmosDB

**Problema**: `SSL: CERTIFICATE_VERIFY_FAILED`

**Solução**:
- CosmosDB requer SSL. Verificar se `COSMOS_SSL=True` no config
- Adicionar `ssl=true` na connection string

### 5. Performance Lenta

**Problema**: Aplicação lenta no Azure

**Soluções**:
```bash
# Aumentar recursos do container
az containerapp update \
  --name chatapp \
  --resource-group chatapp-rg \
  --cpu 2.0 \
  --memory 4Gi

# Aumentar réplicas
az containerapp update \
  --name chatapp \
  --resource-group chatapp-rg \
  --min-replicas 2 \
  --max-replicas 20
```

## Monitoramento

### Logs em Tempo Real

```bash
# Container Apps logs
az containerapp logs show \
  --name chatapp \
  --resource-group chatapp-rg \
  --follow

# Application Insights (se configurado)
az monitor app-insights query \
  --app chatapp-insights \
  --analytics-query "traces | where timestamp > ago(1h)"
```

### Métricas

```bash
# CPU e Memória
az monitor metrics list \
  --resource /subscriptions/{sub-id}/resourceGroups/chatapp-rg/providers/Microsoft.App/containerApps/chatapp \
  --metric "UsageNanoCores,WorkingSetBytes"
```

## Custos Estimados (Azure)

Baseado em uso médio:

| Serviço | SKU | Custo Mensal |
|---------|-----|--------------|
| Container Apps | 1 vCPU, 2GB RAM | ~$40 |
| CosmosDB | 400 RU/s | ~$24 |
| Redis Cache | C0 Basic | ~$16 |
| Container Registry | Basic | ~$5 |
| **Total** | | **~$85/mês** |

*Custos podem variar por região e uso*

## Próximos Passos

1. **Domínio Personalizado**: Configurar domínio próprio
2. **SSL/TLS**: Já incluído no Container Apps
3. **CI/CD**: Configurar GitHub Actions
4. **Backup**: Configurar backup automático do CosmosDB
5. **Monitoring**: Adicionar Application Insights

## Recursos Úteis

- [Azure Container Apps Docs](https://learn.microsoft.com/en-us/azure/container-apps/)
- [CosmosDB MongoDB API](https://learn.microsoft.com/en-us/azure/cosmos-db/mongodb/introduction)
- [Azure CLI Reference](https://learn.microsoft.com/en-us/cli/azure/)

## Suporte

Para problemas ou dúvidas:
1. Verificar logs: `az containerapp logs show`
2. Verificar health: `https://your-app.azurecontainerapps.io/health`
3. Documentação Azure: [docs.microsoft.com](https://docs.microsoft.com)
