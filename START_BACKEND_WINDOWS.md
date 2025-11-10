# 🪟 Como Iniciar o Backend no Windows - Guia Completo

## 🚀 Opção 1: Forma MAIS FÁCIL (Docker Desktop)

### Pré-requisitos
1. **Docker Desktop para Windows** instalado
   - Download: https://www.docker.com/products/docker-desktop/
   - Após instalar, abra o Docker Desktop

### Passos

**Abra o PowerShell ou CMD na pasta do projeto:**

```powershell
# Navegar para a pasta do projeto
cd C:\caminho\para\RINTEP2

# Iniciar tudo com Docker Compose
.\START.sh
```

Ou se `START.sh` não funcionar no Windows:

```powershell
docker-compose up -d
```

✅ Isso inicia TUDO automaticamente!

Acessar: http://localhost:3000

---

## 🛠️ Opção 2: Backend Manual no Windows

### Passo 1: Instalar Pré-requisitos

#### 1.1. Python 3.11+

**Verificar se já tem:**
```powershell
python --version
```

**Se não tiver, baixe:**
- https://www.python.org/downloads/
- Durante instalação: ✅ Marque "Add Python to PATH"

#### 1.2. MongoDB

**Opção A - MongoDB com Docker Desktop (RECOMENDADO):**

```powershell
# Abrir PowerShell como Administrador
docker run -d --name mongodb-dev -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
```

**Opção B - MongoDB instalado no Windows:**
- Download: https://www.mongodb.com/try/download/community
- Após instalar, inicie o serviço MongoDB

**Verificar se MongoDB está rodando:**
```powershell
# PowerShell
netstat -an | findstr "27017"
```

#### 1.3. Redis (Opcional)

**Com Docker Desktop:**
```powershell
docker run -d --name redis-dev -p 6379:6379 redis:7.2-alpine redis-server --requirepass password123
```

---

### Passo 2: Configurar Ambiente Python

**Abra PowerShell ou CMD na pasta do projeto:**

```powershell
# Navegar para a pasta backend
cd C:\caminho\para\RINTEP2\backend

# Criar ambiente virtual (só primeira vez)
python -m venv venv

# Ativar ambiente virtual
# PowerShell:
.\venv\Scripts\Activate.ps1

# CMD:
# venv\Scripts\activate.bat

# Git Bash (se usar):
# source venv/Scripts/activate
```

**Se der erro de execução no PowerShell:**
```powershell
# Executar como Administrador:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Instalar dependências:**
```powershell
pip install -r requirements.txt
```

---

### Passo 3: Criar Arquivo .env

**Criar arquivo `.env` na pasta `backend\`:**

Você pode criar de duas formas:

**Opção A - Notepad:**
1. Abra Notepad
2. Cole o conteúdo abaixo
3. Salve como `backend\.env` (não `.env.txt`!)

**Opção B - PowerShell:**
```powershell
cd C:\caminho\para\RINTEP2\backend

# Criar arquivo .env
@"
FLASK_ENV=development
DATABASE_URL=mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
DB_NAME=chatapp
REDIS_URL=redis://:password123@localhost:6379/0
SECRET_KEY=dev-secret-key-change-in-production
FRONTEND_URL=http://localhost:3000
PORT=5000
LOG_LEVEL=DEBUG
"@ | Out-File -FilePath .env -Encoding utf8
```

**Conteúdo do arquivo `.env`:**
```
FLASK_ENV=development
DATABASE_URL=mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
DB_NAME=chatapp
REDIS_URL=redis://:password123@localhost:6379/0
SECRET_KEY=dev-secret-key-change-in-production
FRONTEND_URL=http://localhost:3000
PORT=5000
LOG_LEVEL=DEBUG
```

---

### Passo 4: Iniciar o Backend

**No PowerShell ou CMD (com ambiente virtual ativo):**

```powershell
# Certifique-se que está na pasta backend
cd C:\caminho\para\RINTEP2\backend

# Ambiente virtual deve estar ativo (você verá (venv) no prompt)
# Se não estiver, ative:
.\venv\Scripts\Activate.ps1

# Iniciar o backend
python app.py
```

**Você deve ver:**
```
INFO:root:Connecting to local MongoDB...
INFO:root:Connected to MongoDB successfully
INFO:root:Database indexes created successfully
INFO:werkzeug: * Running on http://0.0.0.0:5000
```

✅ **Backend está rodando!**

---

## 🧪 Testar se Está Funcionando

**Abra outro PowerShell/CMD ou use o navegador:**

### Opção 1: PowerShell
```powershell
# Teste health check
Invoke-WebRequest -Uri http://localhost:5000/health

# Ou com curl (se tiver instalado)
curl http://localhost:5000/health
```

### Opção 2: Navegador
Abra no navegador:
- http://localhost:5000/health
- http://localhost:5000/

**Deve mostrar:**
```json
{"service":"chatapp-backend","status":"healthy"}
```

---

## 📝 Scripts Automáticos para Windows

Vou criar scripts `.bat` para você!

### Script 1: `start-mongodb.bat`

Crie o arquivo `start-mongodb.bat` na pasta raiz:

```batch
@echo off
echo Iniciando MongoDB...
docker start mongodb-dev 2>nul || docker run -d --name mongodb-dev -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
echo MongoDB iniciado!
pause
```

### Script 2: `start-backend.bat`

Crie o arquivo `start-backend.bat` na pasta raiz:

```batch
@echo off
echo ========================================
echo  Iniciando ChatApp Backend
echo ========================================
echo.

REM Verificar se MongoDB está rodando
echo Verificando MongoDB...
docker ps | findstr mongodb-dev >nul 2>&1
if errorlevel 1 (
    echo MongoDB nao encontrado. Iniciando...
    docker start mongodb-dev 2>nul || docker run -d --name mongodb-dev -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
    timeout /t 5 /nobreak >nul
)

REM Verificar Redis
echo Verificando Redis...
docker ps | findstr redis-dev >nul 2>&1
if errorlevel 1 (
    echo Redis nao encontrado. Iniciando...
    docker start redis-dev 2>nul || docker run -d --name redis-dev -p 6379:6379 redis:7.2-alpine redis-server --requirepass password123
    timeout /t 2 /nobreak >nul
)

echo.
echo Navegando para pasta backend...
cd backend

REM Criar ambiente virtual se não existir
if not exist "venv\" (
    echo Criando ambiente virtual...
    python -m venv venv
)

REM Ativar ambiente virtual
echo Ativando ambiente virtual...
call venv\Scripts\activate.bat

REM Instalar dependências se necessário
pip show flask >nul 2>&1
if errorlevel 1 (
    echo Instalando dependencias...
    pip install -r requirements.txt
)

echo.
echo ========================================
echo  Iniciando servidor...
echo ========================================
echo  URL: http://localhost:5000
echo  Pressione Ctrl+C para parar
echo ========================================
echo.

REM Iniciar aplicação
python app.py
```

### Script 3: `test-backend.bat`

Crie o arquivo `test-backend.bat` na pasta raiz:

```batch
@echo off
echo ========================================
echo  Testando Backend
echo ========================================
echo.

echo [1/3] Testando health check...
curl -s http://localhost:5000/health
echo.

echo [2/3] Testando API root...
curl -s http://localhost:5000/
echo.

echo [3/3] Testando MongoDB...
docker exec mongodb-dev mongosh --eval "db.adminCommand('ping')" --quiet
echo.

echo ========================================
echo  Testes concluidos!
echo ========================================
pause
```

---

## 🎯 Como Usar os Scripts

### Primeira vez (Setup):

1. **Criar os scripts** (copie o conteúdo acima e salve como `.bat`)

2. **Executar setup inicial:**
   ```powershell
   # Duplo clique em:
   start-mongodb.bat

   # Depois duplo clique em:
   start-backend.bat
   ```

### Próximas vezes:

```powershell
# Apenas duplo clique em:
start-backend.bat
```

O script faz tudo automaticamente!

---

## 🐛 Troubleshooting Windows

### Erro: "cannot be loaded because running scripts is disabled"

**Solução:**
```powershell
# Abrir PowerShell como Administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Erro: "Python não é reconhecido"

**Solução:**
1. Reinstale Python
2. Durante instalação: ✅ Marque "Add Python to PATH"
3. Reinicie o terminal

**Ou adicione manualmente ao PATH:**
1. Painel de Controle → Sistema → Configurações Avançadas
2. Variáveis de Ambiente
3. Adicione: `C:\Users\SeuUsuario\AppData\Local\Programs\Python\Python311`

### Erro: "Docker não encontrado"

**Solução:**
1. Instale Docker Desktop: https://www.docker.com/products/docker-desktop/
2. Abra o Docker Desktop
3. Aguarde inicializar
4. Tente novamente

### Erro: "porta 5000 already in use"

**Solução:**
```powershell
# Ver o que está usando a porta
netstat -ano | findstr :5000

# Matar processo (substitua <PID> pelo número que apareceu)
taskkill /PID <PID> /F

# Ou use outra porta
$env:PORT = "5001"
python app.py
```

### Erro: "Failed to connect to database"

**Solução:**
```powershell
# Verificar se MongoDB está rodando
docker ps | findstr mongo

# Se não estiver, iniciar:
docker start mongodb-dev

# Ou criar novo:
docker run -d --name mongodb-dev -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
```

---

## 📋 Checklist Windows

Antes de iniciar, certifique-se:

- [ ] Python 3.11+ instalado
- [ ] Python adicionado ao PATH
- [ ] Docker Desktop instalado e rodando
- [ ] MongoDB container criado
- [ ] Ambiente virtual criado
- [ ] Dependências instaladas
- [ ] Arquivo .env configurado
- [ ] Porta 5000 livre

---

## 🎮 Comandos Rápidos Windows

### PowerShell

```powershell
# Setup inicial
cd C:\caminho\para\RINTEP2
docker run -d --name mongodb-dev -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt

# Criar .env (PowerShell)
@"
FLASK_ENV=development
DATABASE_URL=mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
DB_NAME=chatapp
SECRET_KEY=dev-secret-key
FRONTEND_URL=http://localhost:3000
PORT=5000
"@ | Out-File -FilePath .env -Encoding utf8

# Iniciar backend
python app.py
```

### CMD

```cmd
REM Setup inicial
cd C:\caminho\para\RINTEP2
docker run -d --name mongodb-dev -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
cd backend
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt

REM Criar .env manualmente com Notepad
notepad .env

REM Iniciar backend
python app.py
```

---

## 🌐 Acessar a Aplicação

Depois de iniciar o backend:

- **Backend API:** http://localhost:5000
- **Health Check:** http://localhost:5000/health
- **Frontend** (se iniciar): http://localhost:3000

---

## 💡 Dicas Windows

1. **Use PowerShell** (é melhor que CMD)

2. **Git Bash** também funciona (se tiver Git instalado)

3. **Docker Desktop deve estar rodando** antes de iniciar

4. **Firewall:** Pode pedir permissão na primeira vez (aceite)

5. **Antivírus:** Pode bloquear. Adicione exceção se necessário

6. **WSL2:** Se usar, pode rodar os scripts Linux normalmente

---

## 📝 Variáveis de Ambiente no Windows

### PowerShell (sessão atual):
```powershell
$env:FLASK_ENV = "development"
$env:PORT = "5000"
```

### CMD (sessão atual):
```cmd
set FLASK_ENV=development
set PORT=5000
```

### Permanente (Windows):
1. Painel de Controle → Sistema
2. Configurações Avançadas do Sistema
3. Variáveis de Ambiente
4. Adicionar nova variável

**Ou use arquivo `.env`** (recomendado!)

---

## 🚀 Recomendação Final para Windows

**Melhor opção para você:**

1. **Instale Docker Desktop**
2. **Use os scripts `.bat`** que criei
3. **Duplo clique em `start-backend.bat`**

Pronto! ✅

---

## 📞 Suporte

Se tiver problemas:

1. Verifique se Docker Desktop está rodando
2. Verifique se Python está no PATH
3. Execute PowerShell como Administrador
4. Verifique firewall/antivírus

---

**Qualquer dúvida, me avise!** 😊
