# 🧪 Teste Local da Build Azure - Guia Completo

Este guia mostra como testar a build Azure localmente antes de fazer deploy.

## 🎯 O que Vamos Testar

- ✅ Build do frontend Next.js (static export)
- ✅ Build da imagem Docker unificada
- ✅ Backend Flask servindo frontend estático
- ✅ Conexão com MongoDB (simulando CosmosDB)
- ✅ API funcionando
- ✅ Health checks

---

## 🚀 Opção 1: Script Automático (RECOMENDADO)

### **Windows:**

Duplo clique em:
```
test-azure-local.bat
```

### **Linux/Mac:**

```bash
./test-azure-local.sh
```

**Isso vai:**
1. ✅ Construir a imagem Docker Azure
2. ✅ Iniciar MongoDB (se necessário)
3. ✅ Iniciar o container
4. ✅ Testar health check
5. ✅ Abrir no navegador

**Tempo:** ~5-15 minutos (primeira vez)

---

## 🛠️ Opção 2: Passo a Passo Manual

### **Passo 1: Build da Imagem**

```bash
# Construir imagem Docker
docker build -f Dockerfile.azure -t chatapp-azure:local .
```

**O que acontece:**
- Stage 1: Compila frontend Next.js → gera pasta `out/`
- Stage 2: Cria imagem Python com backend + frontend estático

**Tempo esperado:** 5-15 minutos (primeira vez)

**Sinais de sucesso:**
```
=> => naming to docker.io/library/chatapp-azure:local
```

---

### **Passo 2: Iniciar MongoDB**

```bash
# Criar MongoDB para teste
docker run -d \
  --name mongodb-test \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:7.0
```

**Verificar se está rodando:**
```bash
docker ps | grep mongodb-test
```

---

### **Passo 3: Iniciar Container Azure**

**Linux:**
```bash
docker run -d \
  --name chatapp-azure-test \
  -p 8000:8000 \
  -e AZURE_COSMOS_CONNECTIONSTRING="mongodb://admin:password123@172.17.0.1:27017/chatapp?authSource=admin" \
  -e AZURE_COSMOS_DATABASE="chatapp" \
  -e SECRET_KEY="test-secret-key" \
  -e FRONTEND_URL="http://localhost:8000" \
  chatapp-azure:local
```

**Windows/Mac:**
```bash
docker run -d \
  --name chatapp-azure-test \
  -p 8000:8000 \
  -e AZURE_COSMOS_CONNECTIONSTRING="mongodb://admin:password123@host.docker.internal:27017/chatapp?authSource=admin" \
  -e AZURE_COSMOS_DATABASE="chatapp" \
  -e SECRET_KEY="test-secret-key" \
  -e FRONTEND_URL="http://localhost:8000" \
  chatapp-azure:local
```

**Nota:** A diferença é o hostname:
- Windows/Mac: `host.docker.internal`
- Linux: `172.17.0.1` (IP do Docker bridge)

---

### **Passo 4: Verificar Logs**

```bash
# Ver logs em tempo real
docker logs -f chatapp-azure-test
```

**O que você deve ver:**
```
INFO:root:Connecting to Azure CosmosDB...
INFO:root:Connected to Azure CosmosDB successfully
INFO:root:Database indexes created successfully
INFO:root:Static frontend folder found - serving static files
[2025-11-10 19:00:00 +0000] [1] [INFO] Starting gunicorn 21.2.0
[2025-11-10 19:00:00 +0000] [1] [INFO] Listening at: http://0.0.0.0:8000
```

---

### **Passo 5: Testar**

**Teste 1: Health Check**
```bash
curl http://localhost:8000/health
```

**Resposta esperada:**
```json
{"service":"chatapp-backend","status":"healthy"}
```

**Teste 2: Frontend**

Abra no navegador:
- http://localhost:8000

Deve carregar o frontend Next.js!

**Teste 3: API**
```bash
curl http://localhost:8000/api/auth/status
```

---

## 🐛 Troubleshooting

### Build Falha - "npm ci failed"

**Problema:** package-lock.json não existe ou está desatualizado

**Solução:**
```bash
cd frontend
npm install
cd ..
git add frontend/package-lock.json
```

---

### Build Falha - "No module named 'X'"

**Problema:** Dependência Python faltando

**Solução:**
Verifique se está em `backend/requirements.txt`:
```bash
cat backend/requirements.txt | grep <nome-do-modulo>
```

Se não estiver, adicione e rebuild.

---

### Container Não Inicia

**Problema:** Erro ao conectar MongoDB

**Verificar logs:**
```bash
docker logs chatapp-azure-test
```

**Solução:**

1. Verificar se MongoDB está rodando:
```bash
docker ps | grep mongodb-test
```

2. Testar conexão MongoDB:
```bash
# Linux
docker exec mongodb-test mongosh "mongodb://admin:password123@localhost:27017" --eval "db.adminCommand('ping')"
```

3. Verificar hostname correto:
   - Windows/Mac: `host.docker.internal`
   - Linux: `172.17.0.1` ou usar `--network host`

---

### "Failed to connect to database"

**Solução Linux - Usar mesma rede:**

```bash
# Criar rede
docker network create chatapp-network

# Executar MongoDB na rede
docker run -d \
  --name mongodb-test \
  --network chatapp-network \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:7.0

# Executar app na mesma rede
docker run -d \
  --name chatapp-azure-test \
  --network chatapp-network \
  -p 8000:8000 \
  -e AZURE_COSMOS_CONNECTIONSTRING="mongodb://admin:password123@mongodb-test:27017/chatapp?authSource=admin" \
  -e AZURE_COSMOS_DATABASE="chatapp" \
  -e SECRET_KEY="test-secret-key" \
  chatapp-azure:local
```

---

### Frontend Não Carrega

**Verificar:**

1. Se pasta `static/` existe no container:
```bash
docker exec chatapp-azure-test ls -la /app/static/
```

Deve mostrar arquivos HTML, CSS, JS.

2. Ver logs do Gunicorn:
```bash
docker logs chatapp-azure-test | grep static
```

Deve mostrar: `Static frontend folder found - serving static files`

---

### "Address already in use"

**Problema:** Porta 8000 já está em uso

**Solução:**

**Linux/Mac:**
```bash
lsof -ti:8000 | xargs kill -9
```

**Windows:**
```powershell
netstat -ano | findstr :8000
taskkill /PID <número> /F
```

**Ou use outra porta:**
```bash
docker run -d \
  --name chatapp-azure-test \
  -p 8001:8000 \  # Porta externa diferente
  ...
```

Acessar: http://localhost:8001

---

## 📊 Verificações

### Verificar Imagem Construída

```bash
# Listar imagens
docker images | grep chatapp-azure

# Tamanho esperado: ~800MB-1.5GB
```

### Verificar Container Rodando

```bash
# Ver containers rodando
docker ps | grep chatapp

# Deve mostrar:
# chatapp-azure-test   Up X minutes   0.0.0.0:8000->8000/tcp
```

### Verificar Processos no Container

```bash
# Entrar no container
docker exec -it chatapp-azure-test bash

# Ver processos
ps aux

# Deve mostrar gunicorn rodando
```

### Verificar Logs Completos

```bash
# Logs completos
docker logs chatapp-azure-test

# Últimas 50 linhas
docker logs --tail 50 chatapp-azure-test

# Tempo real
docker logs -f chatapp-azure-test
```

---

## 🎮 Comandos Úteis

### Gerenciar Container

```bash
# Ver logs
docker logs -f chatapp-azure-test

# Parar
docker stop chatapp-azure-test

# Iniciar novamente
docker start chatapp-azure-test

# Reiniciar
docker restart chatapp-azure-test

# Remover
docker rm -f chatapp-azure-test

# Stats (CPU, memória)
docker stats chatapp-azure-test
```

### Inspecionar Container

```bash
# Informações detalhadas
docker inspect chatapp-azure-test

# Ver variáveis de ambiente
docker exec chatapp-azure-test env

# Ver portas
docker port chatapp-azure-test
```

### Rebuild

```bash
# Rebuild sem cache (força rebuild completo)
docker build --no-cache -f Dockerfile.azure -t chatapp-azure:local .

# Rebuild apenas uma stage
docker build --target frontend-builder -f Dockerfile.azure -t chatapp-frontend:test .
```

---

## 📝 Checklist de Teste

Antes de fazer deploy no Azure, verifique:

- [ ] ✅ Build completa sem erros
- [ ] ✅ Container inicia sem erros
- [ ] ✅ Health check retorna `{"status":"healthy"}`
- [ ] ✅ Frontend carrega no navegador
- [ ] ✅ API responde em `/api/`
- [ ] ✅ Logs não mostram erros
- [ ] ✅ Conexão com MongoDB funciona
- [ ] ✅ Frontend estático está sendo servido pelo Flask

---

## 🎯 Próximos Passos

### Se Teste Local Passou:

**Opção 1: Deploy no Azure**
```bash
# Configurar variáveis
cp .env.azure.example .env.azure
nano .env.azure

# Deploy
./azure-deploy.sh
```

**Opção 2: Docker Compose Completo**
```bash
docker-compose -f docker-compose.azure.yml up
```

---

## 📚 Arquivos Relacionados

- `Dockerfile.azure` - Dockerfile para build Azure
- `test-azure-local.sh` - Script de teste Linux/Mac
- `test-azure-local.bat` - Script de teste Windows
- `docker-compose.azure.yml` - Compose para teste local
- `azure-deploy.sh` - Deploy para Azure

---

## 💡 Dicas

1. **Use scripts automáticos** - Mais fácil e rápido
2. **Teste localmente sempre** antes de fazer deploy
3. **Verifique logs** se algo não funcionar
4. **Use Docker networks** se tiver problemas de conexão
5. **Limpe containers antigos** antes de testar novamente

---

## ✅ Teste Passou?

Se tudo funcionou localmente:

**Está pronto para deploy no Azure!** 🚀

```bash
./azure-deploy.sh
```

Se algo não funcionou, verifique a seção de **Troubleshooting** acima ou me envie o erro completo! 😊
