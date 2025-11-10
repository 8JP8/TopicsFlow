# Como Iniciar o Backend Manualmente - Guia Rápido

## ✅ Status dos Testes

**Código testado e funcionando:**
- ✅ Flask OK
- ✅ Config carregada com sucesso
- ✅ app.py sem erros de sintaxe
- ✅ Todos os arquivos de rotas existem
- ✅ create_app pode ser importado

**Detectado:**
- 🏠 Ambiente: Local (IS_AZURE: False)
- 📦 MongoDB URI: mongodb://localhost:27017/chatapp
- 💾 Database: chatapp
- 🌐 Frontend URL: http://localhost:3000

---

## 🚀 Opção 1: Início Rápido (Mais Fácil)

### Se você tem Docker Compose:

```bash
cd /home/user/RINTEP2
./START.sh
```

Isso inicia TUDO automaticamente (MongoDB, Redis, Backend, Frontend)

---

## 🛠️ Opção 2: Início Manual (Passo a Passo)

### Passo 1: Ter MongoDB Rodando

**Opção A - Com Docker:**
```bash
docker run -d \
  --name mongodb-dev \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:7.0
```

**Opção B - MongoDB Local:**
- Instale MongoDB em seu sistema
- Inicie: `mongod --port 27017`

**Verificar se MongoDB está rodando:**
```bash
# Ver se porta 27017 está em uso
netstat -an | grep 27017
# ou
lsof -i :27017
```

### Passo 2: Ter Redis Rodando (Opcional)

**Com Docker:**
```bash
docker run -d \
  --name redis-dev \
  -p 6379:6379 \
  redis:7.2-alpine redis-server --requirepass password123
```

**Verificar:**
```bash
netstat -an | grep 6379
# ou
lsof -i :6379
```

### Passo 3: Configurar Ambiente Python

```bash
# 1. Ir para pasta do backend
cd /home/user/RINTEP2/backend

# 2. Criar ambiente virtual (só primeira vez)
python3 -m venv venv

# 3. Ativar ambiente virtual
source venv/bin/activate

# 4. Instalar dependências (só primeira vez)
pip install -r requirements.txt
```

### Passo 4: Criar arquivo .env

Crie o arquivo `.env` em `/home/user/RINTEP2/backend/.env`:

```bash
# Criar arquivo .env
cat > /home/user/RINTEP2/backend/.env << 'EOF'
# Modo
FLASK_ENV=development

# Database (ajuste se necessário)
DATABASE_URL=mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
DB_NAME=chatapp

# Redis (opcional)
REDIS_URL=redis://:password123@localhost:6379/0

# Secret Key
SECRET_KEY=dev-secret-key-change-in-production

# Frontend
FRONTEND_URL=http://localhost:3000

# TOTP
TOTP_ISSUER=ChatHub

# Logging
LOG_LEVEL=DEBUG

# Porta
PORT=5000
EOF
```

**Ou copie o exemplo:**
```bash
cp /home/user/RINTEP2/.env.example /home/user/RINTEP2/backend/.env
```

### Passo 5: Iniciar o Backend

```bash
# Com ambiente virtual ativo
cd /home/user/RINTEP2/backend
python app.py
```

**Você deve ver:**
```
INFO:root:Connecting to local MongoDB...
INFO:root:Connected to MongoDB successfully
INFO:root:Database indexes created successfully
INFO:werkzeug: * Running on http://0.0.0.0:5000
```

---

## 🧪 Testar se Está Funcionando

**Em outro terminal:**

```bash
# Teste 1: Health check
curl http://localhost:5000/health

# Resposta esperada:
# {"service":"chatapp-backend","status":"healthy"}

# Teste 2: API root
curl http://localhost:5000/

# Resposta esperada:
# {"message":"ChatApp Backend API","version":"1.0.0"}

# Teste 3: Ver no navegador
# Abra: http://localhost:5000/health
```

---

## 📁 Estrutura de Variáveis de Ambiente

| Variável | Valor Padrão | Necessário? | Descrição |
|----------|--------------|-------------|-----------|
| `DATABASE_URL` | mongodb://localhost:27017/chatapp | ✅ Sim | URI do MongoDB |
| `DB_NAME` | chatapp | ✅ Sim | Nome do database |
| `FLASK_ENV` | development | ⚠️ Recomendado | Modo (development/production) |
| `SECRET_KEY` | - | ✅ Sim | Chave secreta |
| `FRONTEND_URL` | http://localhost:3000 | ✅ Sim | URL do frontend |
| `REDIS_URL` | redis://localhost:6379/0 | ❌ Opcional | URL do Redis |
| `PORT` | 5000 | ❌ Opcional | Porta do servidor |

---

## 🐛 Troubleshooting

### Erro: "Failed to connect to database"

**Causa:** MongoDB não está rodando

**Solução:**
```bash
# Verificar se MongoDB está rodando
docker ps | grep mongo
# ou
ps aux | grep mongod

# Iniciar MongoDB
docker start mongodb-dev
# ou
mongod --port 27017
```

### Erro: "Address already in use"

**Causa:** Porta 5000 já está em uso

**Solução:**
```bash
# Ver o que está usando a porta
lsof -i :5000

# Matar processo
kill -9 <PID>

# Ou usar outra porta
export PORT=5001
python app.py
```

### Erro: "No module named 'flask'"

**Causa:** Ambiente virtual não ativo ou dependências não instaladas

**Solução:**
```bash
cd /home/user/RINTEP2/backend
source venv/bin/activate
pip install -r requirements.txt
```

### Erro: "ModuleNotFoundError: No module named 'routes.auth'"

**Causa:** Executando do diretório errado

**Solução:**
```bash
# Sempre execute de dentro da pasta backend
cd /home/user/RINTEP2/backend
python app.py
```

---

## 📝 Comandos Completos - Copia e Cola

### Setup Inicial (Apenas Primeira Vez)

```bash
# MongoDB
docker run -d --name mongodb-dev -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:7.0

# Redis (opcional)
docker run -d --name redis-dev -p 6379:6379 \
  redis:7.2-alpine redis-server --requirepass password123

# Ambiente Python
cd /home/user/RINTEP2/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Criar .env
cat > .env << 'EOF'
FLASK_ENV=development
DATABASE_URL=mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
DB_NAME=chatapp
REDIS_URL=redis://:password123@localhost:6379/0
SECRET_KEY=dev-secret-key-change-in-production
FRONTEND_URL=http://localhost:3000
PORT=5000
EOF
```

### Iniciar Backend (Todas as Vezes)

```bash
# Iniciar MongoDB e Redis
docker start mongodb-dev redis-dev

# Iniciar Backend
cd /home/user/RINTEP2/backend
source venv/bin/activate
python app.py
```

### Testar

```bash
# Novo terminal
curl http://localhost:5000/health
```

---

## 🎯 Próximos Passos

Depois que o backend estiver funcionando:

### 1. Iniciar Frontend (em outro terminal)

```bash
cd /home/user/RINTEP2/frontend
npm install
npm run dev
```

Acessar: http://localhost:3000

### 2. Usar Docker Compose (mais fácil)

```bash
cd /home/user/RINTEP2
./START.sh
```

Isso inicia tudo automaticamente!

---

## 📊 Verificar Status

```bash
# MongoDB
docker ps | grep mongo
mongosh mongodb://admin:password123@localhost:27017 --eval "db.adminCommand('ping')"

# Redis
docker ps | grep redis
redis-cli -a password123 ping

# Backend
curl http://localhost:5000/health

# Ver logs do backend
# (no terminal onde o backend está rodando)
```

---

## 🛑 Parar o Backend

No terminal onde o backend está rodando:
- Pressione **Ctrl+C**

Para parar MongoDB/Redis:
```bash
docker stop mongodb-dev redis-dev
```

---

## 💡 Dicas

1. **Sempre ative o ambiente virtual** antes de rodar:
   ```bash
   source venv/bin/activate
   ```

2. **Use .env para configurações** (não commite este arquivo!)

3. **Mantenha MongoDB/Redis rodando** enquanto desenvolve

4. **Use logs** para debug:
   ```bash
   export LOG_LEVEL=DEBUG
   python app.py
   ```

5. **Para desenvolvimento, use Docker Compose**:
   ```bash
   ./START.sh
   ```
   É muito mais fácil!

---

## 📚 Arquivos Úteis

- `LOCAL_TESTING_GUIDE.md` - Guia completo detalhado
- `test-backend.sh` - Script de teste automático
- `quick-start-backend.sh` - Início rápido automático
- `START.sh` - Docker Compose completo

---

## ✅ Checklist de Pré-requisitos

Antes de iniciar, certifique-se:

- [ ] Python 3.11+ instalado
- [ ] MongoDB rodando (porta 27017)
- [ ] Redis rodando (porta 6379) - opcional
- [ ] Ambiente virtual criado
- [ ] Dependências instaladas
- [ ] Arquivo .env configurado
- [ ] Porta 5000 livre

---

**Pronto! Seu backend deve estar funcionando em http://localhost:5000** 🚀
