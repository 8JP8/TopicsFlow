@echo off
title Parar ChatApp
color 0C

echo.
echo  ========================================
echo   Parando ChatApp - Todos os Servicos
echo  ========================================
echo.

REM Parar containers Docker
echo Parando containers Docker...

docker stop mongodb-dev 2>nul
if errorlevel 1 (
    echo MongoDB container nao encontrado
) else (
    echo MongoDB parado
)

docker stop redis-dev 2>nul
if errorlevel 1 (
    echo Redis container nao encontrado
) else (
    echo Redis parado
)

echo.
echo  ========================================
echo   Servicos parados!
echo  ========================================
echo.
echo Para remover os containers completamente:
echo    docker rm mongodb-dev redis-dev
echo.
pause
