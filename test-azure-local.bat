@echo off
title ChatApp - Teste Azure Local
color 0B

echo.
echo  ========================================
echo   Teste Local - Build Azure
echo  ========================================
echo.

REM Verificar Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Docker nao encontrado!
    echo Instale Docker Desktop: https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

REM Passo 1: Build da imagem
echo [1/5] Construindo imagem Docker Azure...
echo Isso pode demorar 5-15 minutos na primeira vez...
echo.

docker build -f Dockerfile.azure -t chatapp-azure:local .
if errorlevel 1 (
    echo.
    echo ERRO ao construir imagem!
    pause
    exit /b 1
)

echo.
echo Imagem construida com sucesso!
echo.

REM Passo 2: Verificar MongoDB
echo [2/5] Verificando MongoDB...

docker ps | findstr mongodb-test >nul 2>&1
if errorlevel 1 (
    echo MongoDB nao encontrado. Iniciando...
    docker run -d --name mongodb-test -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
    echo Aguardando MongoDB iniciar...
    timeout /t 5 /nobreak >nul
    echo MongoDB iniciado!
) else (
    echo MongoDB ja esta rodando!
)

echo.

REM Passo 3: Limpar containers antigos
echo [3/5] Limpando containers antigos...
docker stop chatapp-azure-test >nul 2>&1
docker rm chatapp-azure-test >nul 2>&1
echo Limpeza concluida!
echo.

REM Passo 4: Iniciar container
echo [4/5] Iniciando container Azure...
echo Usando host.docker.internal para Windows...
echo.

docker run -d --name chatapp-azure-test -p 8000:8000 -e AZURE_COSMOS_CONNECTIONSTRING="mongodb://admin:password123@host.docker.internal:27017/chatapp?authSource=admin" -e AZURE_COSMOS_DATABASE="chatapp" -e SECRET_KEY="test-secret-key-local" -e FRONTEND_URL="http://localhost:8000" chatapp-azure:local

if errorlevel 1 (
    echo.
    echo ERRO ao iniciar container!
    docker logs chatapp-azure-test
    pause
    exit /b 1
)

echo Container iniciado!
echo Aguardando aplicacao iniciar...
timeout /t 10 /nobreak >nul
echo.

REM Passo 5: Testar aplicação
echo [5/5] Testando aplicacao...
echo.

echo Teste 1: Health check...
curl -s http://localhost:8000/health
if errorlevel 1 (
    echo ERRO: Health check falhou!
    echo.
    echo Logs do container:
    docker logs chatapp-azure-test
    pause
    exit /b 1
)

echo.
echo Health check OK!
echo.

echo Teste 2: API Root...
curl -s http://localhost:8000/
echo.
echo.

REM Resumo
echo  ========================================
echo   Teste Concluido com Sucesso!
echo  ========================================
echo.
echo Informacoes:
echo   Imagem: chatapp-azure:local
echo   Container: chatapp-azure-test
echo   URL: http://localhost:8000
echo   Health: http://localhost:8000/health
echo.
echo Comandos uteis:
echo   Ver logs:    docker logs -f chatapp-azure-test
echo   Parar:       docker stop chatapp-azure-test
echo   Reiniciar:   docker restart chatapp-azure-test
echo   Remover:     docker rm -f chatapp-azure-test
echo.
echo Abrindo navegador...
start http://localhost:8000
echo.
pause
