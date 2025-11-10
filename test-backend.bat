@echo off
title ChatApp Backend - Teste
color 0B

echo.
echo  ========================================
echo   ChatApp Backend - Testes
echo  ========================================
echo.

REM Testar se backend está respondendo
echo [1/4] Testando conexao com backend...
curl -s http://localhost:5000/health >nul 2>&1
if errorlevel 1 (
    echo ERRO: Backend nao esta respondendo em http://localhost:5000
    echo.
    echo Verifique se o backend esta rodando:
    echo    start-backend.bat
    echo.
    pause
    exit /b 1
)
echo Backend esta respondendo!
echo.

REM Teste 1: Health Check
echo [2/4] Testando endpoint /health...
curl -s http://localhost:5000/health
echo.
echo.

REM Teste 2: API Root
echo [3/4] Testando endpoint raiz /...
curl -s http://localhost:5000/
echo.
echo.

REM Teste 3: MongoDB (se Docker estiver disponível)
echo [4/4] Testando MongoDB...
docker exec mongodb-dev mongosh "mongodb://admin:password123@localhost:27017/chatapp?authSource=admin" --eval "db.adminCommand('ping')" --quiet 2>nul
if errorlevel 1 (
    echo MongoDB: Nao disponivel via Docker
) else (
    echo MongoDB: Conectado e funcionando!
)
echo.

echo  ========================================
echo   Todos os testes concluidos!
echo  ========================================
echo.

REM Abrir navegador com health check
echo Abrindo health check no navegador...
start http://localhost:5000/health

echo.
pause
