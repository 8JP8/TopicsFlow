@echo off
title ChatApp - Setup Inicial Windows
color 0E

echo.
echo  ========================================
echo   ChatApp - Setup Inicial para Windows
echo  ========================================
echo.

REM Verificar Python
echo [1/5] Verificando Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: Python nao encontrado!
    echo.
    echo Por favor, instale Python 3.11+:
    echo https://www.python.org/downloads/
    echo.
    echo Durante a instalacao, marque:
    echo [X] Add Python to PATH
    echo.
    pause
    exit /b 1
)
python --version
echo Python encontrado!
echo.

REM Verificar Docker
echo [2/5] Verificando Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo ERRO: Docker nao encontrado!
    echo.
    echo Por favor, instale Docker Desktop:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo Apos instalar, abra o Docker Desktop e aguarde inicializar.
    echo.
    pause
    exit /b 1
)
docker --version
echo Docker encontrado!
echo.

REM Criar containers MongoDB e Redis
echo [3/5] Criando containers MongoDB e Redis...

docker ps -a | findstr mongodb-dev >nul 2>&1
if errorlevel 1 (
    echo Criando MongoDB container...
    docker run -d --name mongodb-dev -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
    echo MongoDB container criado!
) else (
    echo MongoDB container ja existe!
    docker start mongodb-dev >nul 2>&1
)

docker ps -a | findstr redis-dev >nul 2>&1
if errorlevel 1 (
    echo Criando Redis container...
    docker run -d --name redis-dev -p 6379:6379 redis:7.2-alpine redis-server --requirepass password123
    echo Redis container criado!
) else (
    echo Redis container ja existe!
    docker start redis-dev >nul 2>&1
)

echo Aguardando containers iniciarem...
timeout /t 5 /nobreak >nul
echo.

REM Criar ambiente virtual Python
echo [4/5] Configurando ambiente Python...
cd /d "%~dp0backend"

if not exist "venv\" (
    echo Criando ambiente virtual...
    python -m venv venv
    if errorlevel 1 (
        echo ERRO ao criar ambiente virtual!
        pause
        exit /b 1
    )
    echo Ambiente virtual criado!
) else (
    echo Ambiente virtual ja existe!
)

echo Ativando ambiente virtual...
call venv\Scripts\activate.bat

echo Instalando dependencias (pode demorar alguns minutos)...
pip install --quiet --upgrade pip
pip install --quiet -r requirements.txt
if errorlevel 1 (
    echo ERRO ao instalar dependencias!
    pause
    exit /b 1
)
echo Dependencias instaladas!
echo.

REM Criar arquivo .env
echo [5/5] Criando arquivo de configuracao...
if not exist ".env" (
    (
        echo FLASK_ENV=development
        echo DATABASE_URL=mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
        echo DB_NAME=chatapp
        echo REDIS_URL=redis://:password123@localhost:6379/0
        echo SECRET_KEY=dev-secret-key-change-in-production
        echo FRONTEND_URL=http://localhost:3000
        echo PORT=5000
        echo LOG_LEVEL=DEBUG
    ) > .env
    echo Arquivo .env criado!
) else (
    echo Arquivo .env ja existe!
)
echo.

REM Voltar para pasta raiz
cd /d "%~dp0"

echo.
echo  ========================================
echo   Setup Completo!
echo  ========================================
echo.
echo Tudo pronto para usar!
echo.
echo Para iniciar o backend:
echo    1. Duplo clique em: start-backend.bat
echo.
echo Para testar:
echo    1. Duplo clique em: test-backend.bat
echo.
echo Para parar tudo:
echo    1. Duplo clique em: stop-all.bat
echo.
echo  ========================================
echo.
pause
