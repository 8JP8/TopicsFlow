@echo off
echo ========================================
echo  Iniciando MongoDB
echo ========================================
echo.

echo Verificando Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERRO: Docker nao encontrado!
    echo Por favor, instale Docker Desktop:
    echo https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo Iniciando MongoDB container...
docker start mongodb-dev 2>nul
if errorlevel 1 (
    echo MongoDB container nao existe. Criando...
    docker run -d --name mongodb-dev -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
    if errorlevel 1 (
        echo ERRO ao criar MongoDB container!
        pause
        exit /b 1
    )
    echo Aguardando MongoDB iniciar...
    timeout /t 5 /nobreak >nul
)

echo.
echo ========================================
echo  MongoDB rodando em localhost:27017
echo  Username: admin
echo  Password: password123
echo ========================================
echo.
pause
