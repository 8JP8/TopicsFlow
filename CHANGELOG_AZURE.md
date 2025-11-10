# Changelog - Azure Deployment Support

## Branch: azuredeployment

### 🚀 Novo: Suporte para Azure Deployment

Esta branch adiciona suporte completo para deployment no Azure, mantendo compatibilidade com deployment local.

## ✨ Mudanças Principais

### 1. Backend Adaptado para Azure

#### `backend/config.py`
- ✅ Detecção automática de ambiente Azure
- ✅ Suporte para Azure CosmosDB (MongoDB API)
- ✅ Suporte para Azure Redis Cache
- ✅ Configuração de SSL para CosmosDB
- ✅ Nova classe `AzureConfig` para configuração específica do Azure

#### `backend/app.py`
- ✅ Conexão otimizada para CosmosDB com timeouts e SSL
- ✅ Suporte para servir frontend estático compilado
- ✅ Detecção automática de pasta `static/` para modo híbrido
- ✅ Logging detalhado do tipo de database conectado

#### `backend/requirements.txt`
- ✅ Adicionado `gunicorn==21.2.0` para produção

### 2. Frontend Otimizado

#### `frontend/next.config.azure.js`
- ✅ Nova configuração para export estático
- ✅ Imagens não otimizadas (compatível com export)
- ✅ Headers de segurança
- ✅ Trailing slash para melhor compatibilidade

#### `frontend/package.json`
- ✅ Novo script `build:azure` para build de produção

### 3. Docker para Azure

#### `Dockerfile.azure`
- ✅ Multi-stage build (frontend + backend)
- ✅ Compila frontend Next.js estaticamente
- ✅ Copia frontend compilado para pasta `static/` do Flask
- ✅ Usa gunicorn com eventlet para produção
- ✅ Health checks configurados
- ✅ Otimizado para Azure Container Apps

#### `docker-compose.azure.yml`
- ✅ Configuração para teste local da build Azure
- ✅ Suporte para MongoDB e Redis locais (perfil local-test)
- ✅ Variáveis de ambiente Azure configuradas

### 4. Scripts de Deployment

#### `azure-build.sh`
- ✅ Build automatizado da imagem Docker
- ✅ Tag e push para Azure Container Registry
- ✅ Opção `--test` para teste local

#### `azure-deploy.sh`
- ✅ Deployment completo e automatizado para Azure
- ✅ Cria todos os recursos necessários:
  - Resource Group
  - Azure Container Registry
  - CosmosDB Account (MongoDB API)
  - Redis Cache (opcional)
  - Container Apps Environment
  - Container App
- ✅ Configuração automática de secrets e variáveis
- ✅ Logs coloridos e informativos

### 5. Configuração Azure

#### `azure-container-apps.yaml`
- ✅ Configuração declarativa para Container Apps
- ✅ Probes de liveness e readiness
- ✅ Auto-scaling configurado (1-10 replicas)
- ✅ Secrets management

#### `.env.azure.example`
- ✅ Template completo de variáveis de ambiente
- ✅ Documentação inline de cada variável

### 6. Documentação Completa

#### `AZURE_DEPLOYMENT.md`
- ✅ Guia completo de deployment (8 seções)
- ✅ Arquitetura detalhada
- ✅ Deployment automatizado e manual
- ✅ Teste local
- ✅ Variáveis de ambiente
- ✅ Troubleshooting
- ✅ Monitoramento
- ✅ Estimativa de custos

#### `AZURE_QUICKSTART.md`
- ✅ Guia rápido de 5 minutos
- ✅ Comandos essenciais
- ✅ Troubleshooting rápido

#### `GITHUB_ACTIONS_SETUP.md`
- ✅ Configuração de CI/CD com GitHub Actions
- ✅ Setup de secrets
- ✅ Script automático de configuração
- ✅ Troubleshooting de CI/CD

#### `CHANGELOG_AZURE.md` (este arquivo)
- ✅ Resumo de todas as mudanças

### 7. CI/CD com GitHub Actions

#### `.github/workflows/azure-deploy.yml`
- ✅ Pipeline completo de CI/CD
- ✅ Build e push automático
- ✅ Deploy automático no Azure
- ✅ Health check pós-deployment
- ✅ Summary com URL da aplicação
- ✅ Job de testes opcional

### 8. Atualizações Gerais

#### `.gitignore`
- ✅ Adicionadas entradas para arquivos Azure
- ✅ Ignora `.env.azure`
- ✅ Ignora pasta `backend/static/`

## 🎯 Funcionalidades

### Detecção Automática de Ambiente

O código detecta automaticamente se está rodando no Azure:

```python
IS_AZURE = os.getenv('WEBSITE_INSTANCE_ID') is not None or \
           os.getenv('AZURE_COSMOS_CONNECTIONSTRING') is not None
```

### Modo Híbrido Flask + Frontend Estático

- Se existe pasta `backend/static/`: Serve frontend + API
- Se não existe: Apenas API (modo desenvolvimento)

### Compatibilidade

- ✅ **Local**: MongoDB + Redis locais via Docker Compose
- ✅ **Azure**: CosmosDB + Redis Cache via variáveis de ambiente
- ✅ **Sem mudanças no código**: Funciona em ambos automaticamente

## 📦 Novos Arquivos

```
.
├── Dockerfile.azure                    # Dockerfile unificado para Azure
├── docker-compose.azure.yml            # Compose para teste local
├── azure-build.sh                      # Script de build
├── azure-deploy.sh                     # Script de deployment
├── azure-container-apps.yaml           # Configuração Container Apps
├── .env.azure.example                  # Template de variáveis
├── AZURE_DEPLOYMENT.md                 # Documentação completa
├── AZURE_QUICKSTART.md                 # Guia rápido
├── GITHUB_ACTIONS_SETUP.md             # Setup CI/CD
├── CHANGELOG_AZURE.md                  # Este arquivo
├── .github/workflows/azure-deploy.yml  # Pipeline CI/CD
└── frontend/next.config.azure.js       # Config Next.js para Azure
```

## 🔄 Arquivos Modificados

```
backend/config.py          # + Detecção Azure + CosmosDB
backend/app.py             # + Servir frontend estático
backend/requirements.txt   # + gunicorn
frontend/package.json      # + script build:azure
.gitignore                 # + entradas Azure
```

## 🚀 Como Usar

### Deployment Local (não mudou)

```bash
./START.sh
```

### Deployment Azure

```bash
# Configurar variáveis
cp .env.azure.example .env.azure
nano .env.azure

# Deploy
export $(cat .env.azure | xargs)
./azure-deploy.sh
```

### CI/CD

```bash
# Push para branch
git push origin azuredeployment

# GitHub Actions faz deployment automaticamente
```

## 📊 Benefícios

1. ✅ **Sem mudanças no código**: Funciona local e Azure
2. ✅ **Deployment único**: Um container com frontend + backend
3. ✅ **Menos complexidade**: Sem necessidade de servir frontend separado
4. ✅ **Menos custo**: Um container ao invés de dois
5. ✅ **Auto-scaling**: Container Apps escala automaticamente
6. ✅ **CI/CD pronto**: GitHub Actions configurado
7. ✅ **Documentação completa**: Guias detalhados

## 🔒 Segurança

- ✅ SSL/TLS automático no Azure Container Apps
- ✅ Secrets gerenciados pelo Azure
- ✅ Headers de segurança configurados
- ✅ Non-root user no container
- ✅ Variáveis de ambiente não commitadas

## 💰 Custos Estimados Azure

| Serviço | Custo Mensal |
|---------|--------------|
| Container Apps | ~$40 |
| CosmosDB | ~$24 |
| Redis Cache | ~$16 |
| ACR | ~$5 |
| **Total** | **~$85** |

## 🧪 Testado

- ✅ Build local da imagem Azure
- ✅ Execução local da imagem Azure
- ✅ Compatibilidade CosmosDB
- ✅ Serving de frontend estático
- ✅ Health checks
- ✅ Environment detection

## 📝 TODO (Futuro)

- [ ] Testes automatizados
- [ ] Application Insights
- [ ] Backup automático CosmosDB
- [ ] Domínio personalizado
- [ ] CDN para assets estáticos

## 👥 Autor

Adaptação Azure por Claude (Anthropic)

## 📄 Licença

Mesma licença do projeto principal
