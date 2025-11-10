# Guia de Teste Manual Local - ChatApp Backend

Este guia explica como iniciar e testar o backend manualmente no seu PC.

## Pré-requisitos

Antes de começar, você precisa ter:

### 1. MongoDB Rodando

**Opção A: MongoDB via Docker (Recomendado)**
```bash
docker run -d \
  --name mongodb-test \
  -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:7.0
```

**Opção B: MongoDB Local**
- Tenha MongoDB instalado e rodando em `localhost:27017`

**Verificar se MongoDB está rodando:**
```bash
# Com Docker
docker ps | grep mongodb

# Testar conexão
mongosh "mongodb://admin:password123@localhost:27017" --eval "db.adminCommand('ping')"
```

### 2. Redis Rodando (Opcional, mas recomendado)

```bash
docker run -d \
  --name redis-test \
  -p 6379:6379 \
  redis:7.2-alpine redis-server --requirepass password123
```

**Verificar se Redis está rodando:**
```bash
docker ps | grep redis
```

### 3. Python 3.11 Instalado

```bash
python --version
# ou
python3 --version
```

## Passo 1: Preparar Ambiente Virtual

```bash
# Ir para a pasta do backend
cd /home/user/RINTEP2/backend

# Criar ambiente virtual
python -m venv venv

# Ativar ambiente virtual
# Linux/Mac:
source venv/bin/activate

# Windows:
# venv\Scripts\activate

# Verificar se está ativo (deve aparecer (venv) no prompt)
which python
```

## Passo 2: Instalar Dependências

```bash
# Com ambiente virtual ativo
pip install -r requirements.txt

# Aguardar instalação (pode levar alguns minutos)
```

## Passo 3: Configurar Variáveis de Ambiente

### Opção A: Usar arquivo .env (Recomendado)

Crie o arquivo `.env` no diretório `backend/`:

```bash
cd /home/user/RINTEP2/backend
nano .env  # ou vim, code, etc.
```

Conteúdo do `.env`:

```bash
# Modo de desenvolvimento
FLASK_ENV=development

# Database (MongoDB local)
DATABASE_URL=mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
DB_NAME=chatapp

# Redis
REDIS_URL=redis://:password123@localhost:6379/0

# Secret Key (gerar nova)
SECRET_KEY=dev-secret-key-change-this-in-production

# Frontend URL
FRONTEND_URL=http://localhost:3000

# TOTP Config
TOTP_ISSUER=ChatHub
TOTP_VALIDITY_WINDOW=1

# Logging
LOG_LEVEL=DEBUG

# Porta
PORT=5000
```

**Salve o arquivo** (Ctrl+O, Enter, Ctrl+X no nano)

### Opção B: Exportar Variáveis Manualmente

```bash
export FLASK_ENV=development
export DATABASE_URL="mongodb://admin:password123@localhost:27017/chatapp?authSource=admin"
export DB_NAME=chatapp
export REDIS_URL="redis://:password123@localhost:6379/0"
export SECRET_KEY="dev-secret-key-test"
export FRONTEND_URL="http://localhost:3000"
export PORT=5000
```

## Passo 4: Verificar Configuração

```bash
# Testar importação do config
python -c "from config import config; print('Config OK:', config['development'].MONGO_URI)"

# Deve mostrar:
# Config OK: mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
```

## Passo 5: Iniciar o Backend

### Método 1: Modo Desenvolvimento (com auto-reload)

```bash
cd /home/user/RINTEP2/backend
python app.py
```

### Método 2: Com Flask CLI

```bash
cd /home/user/RINTEP2/backend
export FLASK_APP=app.py
flask run --host=0.0.0.0 --port=5000
```

### Método 3: Com Python direto

```bash
cd /home/user/RINTEP2/backend
python -c "from app import create_app, socketio; app = create_app('development'); socketio.run(app, host='0.0.0.0', port=5000, debug=True)"
```

## O que você deve ver ao iniciar

```
INFO:werkzeug: * Running on http://0.0.0.0:5000
INFO:root:Connecting to local MongoDB...
INFO:root:Connected to MongoDB successfully
INFO:root:Database indexes created successfully
INFO:root:No static frontend folder - API only mode
```

**Sinais de que está funcionando:**
- ✅ "Connected to MongoDB successfully"
- ✅ "Database indexes created successfully"
- ✅ "Running on http://0.0.0.0:5000"

## Passo 6: Testar o Backend

### Teste 1: Health Check

**Novo terminal** (deixe o backend rodando no outro):

```bash
# Testar endpoint de health
curl http://localhost:5000/health

# Deve retornar:
# {"service":"chatapp-backend","status":"healthy"}
```

### Teste 2: API Root

```bash
curl http://localhost:5000/

# Deve retornar:
# {"message":"ChatApp Backend API","version":"1.0.0"}
```

### Teste 3: Verificar Database

```bash
# Conectar ao MongoDB e verificar se o banco foi criado
mongosh "mongodb://admin:password123@localhost:27017" --eval "use chatapp; db.getCollectionNames()"

# Deve mostrar as collections criadas
```

### Teste 4: Testar API de Auth (opcional)

```bash
# Tentar registrar um usuário
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

## Troubleshooting

### Erro: "Failed to connect to database"

**Causa**: MongoDB não está rodando ou credenciais erradas

**Solução**:
```bash
# Verificar se MongoDB está rodando
docker ps | grep mongo

# Se não estiver, iniciar:
docker start mongodb-test

# Ou criar novo:
docker run -d --name mongodb-test -p 27017:27017 \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=password123 \
  mongo:7.0

# Testar conexão:
mongosh "mongodb://admin:password123@localhost:27017" --eval "db.adminCommand('ping')"
```

### Erro: "ModuleNotFoundError: No module named 'flask'"

**Causa**: Dependências não instaladas ou ambiente virtual não ativo

**Solução**:
```bash
# Ativar ambiente virtual
source venv/bin/activate

# Instalar dependências
pip install -r requirements.txt
```

### Erro: "Address already in use"

**Causa**: Porta 5000 já está sendo usada

**Solução**:
```bash
# Opção 1: Matar processo na porta 5000
lsof -ti:5000 | xargs kill -9

# Opção 2: Usar outra porta
export PORT=5001
python app.py
```

### Erro: "ImportError: cannot import name 'auth_bp'"

**Causa**: Faltam arquivos de rotas ou há erro de import

**Solução**:
```bash
# Verificar se todos os arquivos de rotas existem
ls -la routes/

# Deve ter:
# auth.py, topics.py, messages.py, reports.py, users.py
```

### Warning: "profanity-check" demorado

**Causa**: Biblioteca de profanity check é lenta para instalar

**Solução**: É normal, aguarde a instalação ou comente temporariamente:
```bash
# Editar requirements.txt e comentar:
# profanity-check==1.0.3
```

## Modo de Teste - Sem MongoDB

Se quiser testar sem MongoDB (apenas verificar se imports funcionam):

```bash
cd /home/user/RINTEP2/backend

# Testar imports
python -c "
from flask import Flask
from config import config
print('✅ Flask OK')
print('✅ Config OK')
print('MongoDB URI:', config['development'].MONGO_URI)
"
```

## Ver Logs Detalhados

```bash
# Iniciar com log level DEBUG
export LOG_LEVEL=DEBUG
python app.py

# Ou
LOG_LEVEL=DEBUG python app.py
```

## Parar o Backend

No terminal onde o backend está rodando:
- Pressione **Ctrl+C**

## Limpar Ambiente

```bash
# Desativar ambiente virtual
deactivate

# Parar containers Docker
docker stop mongodb-test redis-test

# Remover containers (opcional)
docker rm mongodb-test redis-test
```

## Comandos Rápidos - Checklist

```bash
# 1. Iniciar MongoDB
docker start mongodb-test || docker run -d --name mongodb-test -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0

# 2. Iniciar Redis (opcional)
docker start redis-test || docker run -d --name redis-test -p 6379:6379 redis:7.2-alpine redis-server --requirepass password123

# 3. Ativar ambiente e iniciar backend
cd /home/user/RINTEP2/backend
source venv/bin/activate
python app.py

# 4. Testar (novo terminal)
curl http://localhost:5000/health
```

## Variáveis de Ambiente - Referência Rápida

| Variável | Valor Padrão | Descrição |
|----------|--------------|-----------|
| `FLASK_ENV` | `development` | Modo do Flask |
| `DATABASE_URL` | `mongodb://localhost:27017/chatapp` | URI do MongoDB |
| `DB_NAME` | `chatapp` | Nome do database |
| `REDIS_URL` | `redis://localhost:6379/0` | URL do Redis |
| `PORT` | `5000` | Porta do servidor |
| `FRONTEND_URL` | `http://localhost:3000` | URL do frontend |
| `SECRET_KEY` | (necessário) | Chave secreta |
| `LOG_LEVEL` | `INFO` | Nível de log |

## Próximos Passos

Após o backend funcionar:

1. **Testar com Frontend**:
   ```bash
   cd /home/user/RINTEP2/frontend
   npm install
   npm run dev
   ```
   Acessar: http://localhost:3000

2. **Testar com Docker Compose**:
   ```bash
   cd /home/user/RINTEP2
   ./START.sh
   ```

3. **Verificar todos os endpoints**: Use Postman ou Insomnia

## Suporte

Se encontrar problemas:
1. Verificar logs do backend
2. Verificar se MongoDB/Redis estão rodando
3. Verificar variáveis de ambiente
4. Verificar portas não estão em uso
