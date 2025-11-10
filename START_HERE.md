# 🚀 ChatApp - Como Iniciar

## 📋 3 Formas de Testar/Rodar

Escolha UMA das opções abaixo:

---

## 1️⃣ **TESTE LOCAL COM DOCKER** (Recomendado para teste)

Todos os serviços em containers. Logs visíveis. Fácil de parar.

### Windows:
```
Duplo clique: local-docker.bat
```

### Linux/Mac:
```bash
./local-docker.sh
```

**O que faz:**
- ✅ MongoDB em container
- ✅ Redis em container
- ✅ Backend em container
- ✅ Frontend em container
- ✅ Logs visíveis em tempo real
- ✅ Ctrl+C para parar tudo

**Acessar:**
- Frontend: http://localhost:3000
- Backend: http://localhost:5000
- Health: http://localhost:5000/health

---

## 2️⃣ **TESTE LOCAL NATIVO** (Windows direto)

Backend roda diretamente no Windows (mais rápido para desenvolvimento).

### Windows:
```
Duplo clique: local-native.bat
```

### Linux/Mac:
```bash
./local-native.sh
```

**O que faz:**
- ✅ MongoDB via Docker (ou local se instalado)
- ✅ Backend roda diretamente no Python do sistema
- ✅ Mais rápido que containers
- ✅ Ideal para desenvolvimento e debug
- ✅ Ctrl+C para parar

**Acessar:**
- Backend: http://localhost:5000
- Health: http://localhost:5000/health

**Nota:** Frontend separado (se precisar):
```bash
cd frontend
npm install
npm run dev
```

---

## 3️⃣ **DEPLOY PARA AZURE** (Produção)

Deploy real para Azure Cloud.

### Windows:
```
Duplo clique: deploy-azure.bat
```

### Linux/Mac:
```bash
./azure-deploy.sh
```

**Antes de rodar:**
1. Edite `.env.azure` com suas configurações
2. Faça login no Azure CLI (`az login`)
3. Execute o script

**O que faz:**
- ✅ Cria recursos Azure (CosmosDB, Container Registry, Container Apps)
- ✅ Build da imagem Docker
- ✅ Push para Azure
- ✅ Deploy automático

---

## 🎯 Qual Escolher?

| Situação | Use |
|----------|-----|
| Quero testar rapidamente | `local-docker` |
| Estou desenvolvendo/debugando | `local-native` |
| Quero colocar em produção | `deploy-azure` |
| Primeira vez testando | `local-docker` |

---

## 📊 Comparação Detalhada

### Local com Docker
- ✅ Mais próximo do ambiente Azure
- ✅ Tudo isolado em containers
- ✅ Fácil de limpar (só parar containers)
- ⚠️ Usa mais recursos (RAM/CPU)
- ⚠️ Build inicial demora mais

### Local Nativo
- ✅ Mais rápido para desenvolvimento
- ✅ Hot reload automático
- ✅ Debug mais fácil
- ✅ Usa menos recursos
- ⚠️ Precisa Python instalado
- ⚠️ Precisa gerenciar dependências

### Deploy Azure
- ✅ Ambiente de produção real
- ✅ Escalável automaticamente
- ✅ SSL/HTTPS automático
- ⚠️ Custos aplicáveis (~$85/mês)
- ⚠️ Requer conta Azure

---

## 🐛 Problemas Comuns

### Docker não encontrado
**Solução:** Instale Docker Desktop
- Windows: https://www.docker.com/products/docker-desktop/
- Mac: https://www.docker.com/products/docker-desktop/
- Linux: https://docs.docker.com/engine/install/

### Python não encontrado
**Solução:** Instale Python 3.11+
- https://www.python.org/downloads/
- ✅ Marque "Add Python to PATH"

### Porta já em uso
**Windows:**
```powershell
netstat -ano | findstr :5000
taskkill /PID <número> /F
```

**Linux/Mac:**
```bash
lsof -ti:5000 | xargs kill -9
```

### MongoDB connection failed
**Verificar:** MongoDB está rodando?
```bash
docker ps | grep mongodb
```

**Iniciar:**
```bash
docker start mongodb-test
```

---

## 📂 Estrutura de Scripts

```
RINTEP2/
├── local-docker.bat/sh     ⭐ Teste com Docker
├── local-native.bat/sh     ⭐ Teste nativo Windows
├── deploy-azure.bat/sh     ⭐ Deploy Azure
├── docker-compose.local.yml # Config Docker local
├── Dockerfile.azure         # Build para Azure
└── .env.azure.example       # Config Azure
```

---

## 🔧 Configurações

### Ambiente Local (.env no backend/)
```bash
FLASK_ENV=development
DATABASE_URL=mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
PORT=5000
LOG_LEVEL=DEBUG
```

### Ambiente Azure (.env.azure na raiz)
```bash
AZURE_RESOURCE_GROUP=chatapp-rg
AZURE_CONTAINER_REGISTRY=chatappacr
AZURE_COSMOS_ACCOUNT=chatapp-cosmos
SECRET_KEY=<sua-chave-secreta>
```

---

## ✅ Checklist

Antes de começar:

### Para local-docker:
- [ ] Docker Desktop instalado e rodando

### Para local-native:
- [ ] Python 3.11+ instalado
- [ ] MongoDB rodando (Docker ou local)

### Para deploy-azure:
- [ ] Azure CLI instalado
- [ ] Conta Azure ativa
- [ ] Arquivo .env.azure configurado

---

## 🎓 Próximos Passos

1. **Escolha um modo** (recomendo `local-docker` primeiro)
2. **Execute o script** correspondente
3. **Aguarde iniciar** (primeira vez demora mais)
4. **Teste no navegador** nas URLs indicadas
5. **Pressione Ctrl+C** para parar

---

## 📚 Documentação Completa

- **AZURE_DEPLOYMENT.md** - Guia completo Azure
- **START_BACKEND_WINDOWS.md** - Guia Windows detalhado
- **LOCAL_TESTING_GUIDE.md** - Guia de testes
- **TEST_AZURE_LOCAL.md** - Testes Azure local

---

## 🆘 Precisa de Ajuda?

1. Verifique os logs do script
2. Consulte a seção "Problemas Comuns" acima
3. Veja a documentação completa nos arquivos .md

---

**Comece agora! Escolha um modo e execute o script!** 🚀
