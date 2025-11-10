@echo off
title ChatApp Backend
color 0A

echo.
echo  ========================================
echo   ChatApp Backend - Inicio Automatico
echo  ========================================
echo.

REM Verificar Python
echo [1/6] Verificando Python...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Python nao encontrado!
    echo Baixe em: https://www.python.org/downloads/
    pause
    exit /b 1
)
python --version
echo.

REM Verificar Docker
echo [2/6] Verificando Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo AVISO: Docker nao encontrado!
    echo Voce precisara ter MongoDB instalado localmente.
    echo.
) else (
    docker --version
    echo.

    REM Iniciar MongoDB
    echo [3/6] Iniciando MongoDB...
    docker ps | findstr mongodb-dev >nul 2>&1
    if errorlevel 1 (
        echo MongoDB nao esta rodando. Iniciando...
        docker start mongodb-dev 2>nul || docker run -d --name mongodb-dev -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
        if errorlevel 1 (
            echo ERRO ao iniciar MongoDB!
            pause
            exit /b 1
        )
        echo Aguardando MongoDB iniciar...
        timeout /t 5 /nobreak >nul
        echo MongoDB iniciado!
    ) else (
        echo MongoDB ja esta rodando!
    )
    echo.

    REM Iniciar Redis
    echo [4/6] Iniciando Redis...
    docker ps | findstr redis-dev >nul 2>&1
    if errorlevel 1 (
        echo Redis nao esta rodando. Iniciando...
        docker start redis-dev 2>nul || docker run -d --name redis-dev -p 6379:6379 redis:7.2-alpine redis-server --requirepass password123
        timeout /t 2 /nobreak >nul
        echo Redis iniciado!
    ) else (
        echo Redis ja esta rodando!
    )
    echo.
)

REM Navegar para pasta backend
echo [5/6] Configurando ambiente...
cd /d "%~dp0backend"
if errorlevel 1 (
    echo ERRO: Pasta backend nao encontrada!
    pause
    exit /b 1
)

REM Criar ambiente virtual se não existir
if not exist "venv\" (
    echo Criando ambiente virtual Python...
    python -m venv venv
    if errorlevel 1 (
        echo ERRO ao criar ambiente virtual!
        pause
        exit /b 1
    )
)

REM Ativar ambiente virtual
echo Ativando ambiente virtual...
call venv\Scripts\activate.bat
if errorlevel 1 (
    echo ERRO ao ativar ambiente virtual!
    pause
    exit /b 1
)

REM Verificar e instalar dependências
pip show flask >nul 2>&1
if errorlevel 1 (
    echo Instalando dependencias Python (pode demorar alguns minutos)...
    pip install -r requirements.txt
    if errorlevel 1 (
        echo ERRO ao instalar dependencias!
        pause
        exit /b 1
    )
)

REM Verificar se .env existe
if not exist ".env" (
    echo.
    echo AVISO: Arquivo .env nao encontrado!
    echo Criando arquivo .env com configuracoes padrao...
    echo.
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
    echo Arquivo .env criado com sucesso!
    echo.
)

echo.
echo [6/6] Iniciando servidor Flask...
echo.
echo  ========================================
echo   Backend rodando em:
echo   http://localhost:5000
echo.
echo   Health check:
echo   http://localhost:5000/health
echo.
echo   Pressione Ctrl+C para parar o servidor
echo  ========================================
echo.

REM Iniciar aplicação
python app.py

REM Se o servidor parar
echo.
echo Servidor parado.
pause
