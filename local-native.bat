@echo off
title ChatApp - Teste Local NATIVO Windows
color 0E
setlocal enabledelayedexpansion

echo.
echo  ============================================================
echo   ChatApp - TESTE LOCAL NATIVO (Sem Docker)
echo   Backend rodando diretamente no Windows
echo   Dependencias instaladas no sistema (sem venv)
echo  ============================================================
echo.

REM Verificar Python
echo [1/5] Verificando Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Python nao encontrado!
    echo Instale Python 3.11+: https://www.python.org/downloads/
    echo Marque 'Add Python to PATH' durante instalacao
    pause
    exit /b 1
)
python --version
echo.

REM Verificar MongoDB
echo [2/5] Verificando MongoDB...
set MONGO_RUNNING=0

REM Tentar conexão MongoDB
python -c "from pymongo import MongoClient; MongoClient('mongodb://localhost:27017', serverSelectionTimeoutMS=2000).admin.command('ping')" >nul 2>&1
if not errorlevel 1 (
    echo [OK] MongoDB local encontrado em localhost:27017
    set MONGO_RUNNING=1
) else (
    REM Verificar se Docker está disponível
    docker --version >nul 2>&1
    if not errorlevel 1 (
        echo [AVISO] MongoDB local nao encontrado
        echo [ACAO] Iniciando MongoDB via Docker...
        docker start mongodb-test >nul 2>&1 || docker run -d --name mongodb-test -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
        timeout /t 5 /nobreak >nul
        echo [OK] MongoDB iniciado via Docker
        set MONGO_RUNNING=1
    ) else (
        echo [ERRO] MongoDB nao encontrado e Docker nao disponivel!
        echo.
        echo Opcoes:
        echo 1. Instale MongoDB: https://www.mongodb.com/try/download/community
        echo 2. OU instale Docker Desktop para usar MongoDB em container
        echo.
        pause
        exit /b 1
    )
)
echo.

REM Verificar e instalar dependências Python (direto no sistema)
echo [3/5] Verificando dependencias Python...
cd /d "%~dp0backend"

echo [ACAO] Verificando se dependencias estao instaladas...
pip show flask >nul 2>&1
if errorlevel 1 (
    echo [ACAO] Instalando dependencias no sistema (pode demorar alguns minutos)...
    echo.
    pip install -r requirements.txt
    if errorlevel 1 (
        echo.
        echo [ERRO] Falha ao instalar dependencias!
        pause
        exit /b 1
    )
) else (
    echo [OK] Dependencias ja instaladas
)
echo.

REM Criar/verificar arquivo .env
echo [4/5] Configurando variaveis de ambiente...
if not exist ".env" (
    echo [ACAO] Criando arquivo .env...
    (
        echo # Modo LOCAL - Nao Azure
        echo FLASK_ENV=development
        echo FORCE_LOCAL_MODE=true
        echo.
        echo # Database local
        echo DATABASE_URL=mongodb://admin:password123@localhost:27017/chatapp?authSource=admin
        echo DB_NAME=chatapp
        echo.
        echo # Redis local ^(opcional^)
        echo REDIS_URL=redis://:password123@localhost:6379/0
        echo.
        echo # Secret key
        echo SECRET_KEY=dev-secret-key-local-native-testing
        echo.
        echo # Frontend
        echo FRONTEND_URL=http://localhost:3000
        echo.
        echo # Server
        echo PORT=5000
        echo.
        echo # Debug
        echo LOG_LEVEL=DEBUG
        echo PYTHONUNBUFFERED=1
    ) > .env
    echo [OK] Arquivo .env criado
) else (
    echo [OK] Arquivo .env existente
)
echo.

REM Mostrar configuração
echo [5/5] Configuracao atual:
echo ============================================================
type .env
echo ============================================================
echo.

REM Iniciar backend
echo.
echo  ============================================================
echo   INICIANDO BACKEND
echo  ============================================================
echo.
echo Backend rodando em: http://localhost:5000
echo Health check:       http://localhost:5000/health
echo.
echo Pressione Ctrl+C para parar o servidor
echo.
echo ============================================================
echo.

REM Iniciar com Python diretamente (logs visíveis)
python app.py

REM Quando usuário para
echo.
echo [PARADO] Servidor backend parado.
echo.

REM Voltar para pasta raiz
cd /d "%~dp0"
pause
