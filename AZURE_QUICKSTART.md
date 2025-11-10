# Azure Deployment - Quick Start

## Deploy Rápido em 5 Minutos

### 1. Pré-requisitos

```bash
# Instalar Azure CLI (se necessário)
# Linux/Mac
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Windows
# Download de https://aka.ms/installazurecliwindows

# Login no Azure
az login
```

### 2. Configurar Variáveis

```bash
# Copiar arquivo de exemplo
cp .env.azure.example .env.azure

# Editar e configurar valores mínimos
nano .env.azure  # ou vim, code, etc.
```

**Mínimo necessário em `.env.azure`:**
```bash
AZURE_RESOURCE_GROUP=chatapp-rg
AZURE_CONTAINER_REGISTRY=chatappacr123  # Deve ser único globalmente
AZURE_COSMOS_ACCOUNT=chatapp-cosmos123  # Deve ser único globalmente
SECRET_KEY=$(openssl rand -base64 32)
```

### 3. Deploy!

```bash
# Carregar variáveis
export $(cat .env.azure | xargs)

# Executar deployment
./azure-deploy.sh
```

### 4. Acessar Aplicação

Após o script terminar, você verá:

```
Application URL: https://chatapp.azurecontainerapps.io
```

✅ Pronto! Sua aplicação está no ar!

## Teste Local Antes de Deploy

```bash
# Build e teste local
./azure-build.sh --test

# Acessar em http://localhost:8000
```

## Comandos Úteis

### Ver Logs
```bash
az containerapp logs show \
  --name chatapp \
  --resource-group chatapp-rg \
  --follow
```

### Atualizar Aplicação
```bash
# Rebuild e redeploy
export $(cat .env.azure | xargs)
./azure-deploy.sh
```

### Parar Aplicação (economizar custos)
```bash
az containerapp revision deactivate \
  --name chatapp \
  --resource-group chatapp-rg \
  --revision chatapp--<revision-name>
```

### Deletar Tudo
```bash
az group delete --name chatapp-rg --yes
```

## Diferenças Local vs Azure

| Aspecto | Local | Azure |
|---------|-------|-------|
| Database | MongoDB | CosmosDB (MongoDB API) |
| Cache | Redis | Azure Redis Cache |
| Frontend | Next.js Server | Static (servido pelo Flask) |
| SSL | Não | Sim (automático) |
| Scaling | Manual | Automático (1-10 instâncias) |

## Variáveis de Ambiente Azure

A aplicação detecta automaticamente o ambiente Azure através de:
- `WEBSITE_INSTANCE_ID`
- `AZURE_COSMOS_CONNECTIONSTRING`

Quando detectado, o código automaticamente:
- ✅ Usa CosmosDB em vez de MongoDB
- ✅ Configura SSL para conexões
- ✅ Desabilita `retryWrites` (não suportado pelo CosmosDB)
- ✅ Serve frontend estático

## Troubleshooting Rápido

### Erro: "ACR name already exists"
```bash
# Use um nome único
AZURE_CONTAINER_REGISTRY=chatapp-acr-$(date +%s)
```

### Erro: "Cosmos account name already exists"
```bash
# Use um nome único
AZURE_COSMOS_ACCOUNT=chatapp-cosmos-$(date +%s)
```

### Container não inicia
```bash
# Ver logs
az containerapp logs show --name chatapp --resource-group chatapp-rg --follow
```

### Frontend não aparece
```bash
# Rebuild com logs
docker build -f Dockerfile.azure -t chatapp-azure:latest . --progress=plain
```

## Arquitetura Azure

```
Internet
   ↓
Azure Container Apps (Ingress)
   ↓
Container (Flask + Static Frontend)
   ↓
   ├─→ Azure CosmosDB (MongoDB API)
   └─→ Azure Redis Cache (opcional)
```

## Custos

Estimativa mensal (uso médio):
- Container Apps: ~$40
- CosmosDB: ~$24
- Redis: ~$16 (opcional)
- ACR: ~$5

**Total: ~$85/mês** (ou ~$69 sem Redis)

💡 **Dica**: Use Azure Free Tier para testar gratuitamente por 12 meses!

## Próximos Passos

1. ✅ Configurar domínio personalizado
2. ✅ Adicionar CI/CD com GitHub Actions
3. ✅ Configurar Application Insights
4. ✅ Habilitar backups automáticos

Ver documentação completa em: [AZURE_DEPLOYMENT.md](./AZURE_DEPLOYMENT.md)
