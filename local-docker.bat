@echo off
title ChatApp - Teste Local com Docker
color 0A
setlocal enabledelayedexpansion

echo.
echo  ============================================================
echo   ChatApp - TESTE LOCAL COM DOCKER
echo   Todos os servicos em containers
echo  ============================================================
echo.

REM Verificar Docker
echo [VERIFICACAO] Checando Docker Desktop...
docker --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERRO] Docker nao encontrado!
    echo.
    echo Por favor:
    echo 1. Instale Docker Desktop: https://www.docker.com/products/docker-desktop/
    echo 2. Abra Docker Desktop e aguarde inicializar
    echo 3. Execute este script novamente
    echo.
    pause
    exit /b 1
)

docker info >nul 2>&1
if errorlevel 1 (
    echo.
    echo [ERRO] Docker nao esta rodando!
    echo.
    echo Por favor:
    echo 1. Abra Docker Desktop
    echo 2. Aguarde o icone ficar verde
    echo 3. Execute este script novamente
    echo.
    pause
    exit /b 1
)

echo [OK] Docker encontrado e rodando!
docker --version
echo.

REM Limpar containers antigos
echo [LIMPEZA] Parando containers antigos...
docker-compose -f docker-compose.local.yml down >nul 2>&1
echo [OK] Limpeza concluida
echo.

REM Iniciar servicos
echo [INICIANDO] Construindo e iniciando todos os servicos...
echo.
echo Isso pode demorar alguns minutos na primeira vez...
echo Os logs aparecerao abaixo em tempo real.
echo.
echo Pressione Ctrl+C para parar todos os servicos
echo.
echo ============================================================
echo.

REM Iniciar com logs visíveis
docker-compose -f docker-compose.local.yml up --build

REM Quando usuário para com Ctrl+C
echo.
echo.
echo [PARANDO] Desligando servicos...
docker-compose -f docker-compose.local.yml down

echo.
echo [CONCLUIDO] Todos os servicos foram parados.
echo.
pause
