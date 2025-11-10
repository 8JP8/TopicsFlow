@echo off
title ChatApp - Deploy Azure
color 0B
setlocal enabledelayedexpansion

echo.
echo  ============================================================
echo   ChatApp - DEPLOY PARA AZURE
echo   Build e deployment em Azure Container Apps
echo  ============================================================
echo.

REM Verificar Azure CLI
echo [1/6] Verificando Azure CLI...
az --version >nul 2>&1
if errorlevel 1 (
    echo [ERRO] Azure CLI nao encontrado!
    echo.
    echo Instale Azure CLI:
    echo https://docs.microsoft.com/en-us/cli/azure/install-azure-cli-windows
    echo.
    pause
    exit /b 1
)
echo [OK] Azure CLI encontrado
echo.

REM Verificar login Azure
echo [2/6] Verificando login Azure...
az account show >nul 2>&1
if errorlevel 1 (
    echo [ACAO] Fazendo login no Azure...
    az login
    if errorlevel 1 (
        echo [ERRO] Falha no login Azure
        pause
        exit /b 1
    )
)
echo [OK] Logado no Azure
az account show --query "{Subscription:name, ID:id}" -o table
echo.

REM Verificar arquivo .env.azure
echo [3/6] Verificando configuracao Azure...
if not exist ".env.azure" (
    echo [AVISO] Arquivo .env.azure nao encontrado!
    echo.
    echo [ACAO] Criando arquivo .env.azure com valores padrao...
    echo Por favor, edite este arquivo com suas configuracoes Azure!
    echo.

    (
        echo # Azure Resource Configuration
        echo AZURE_RESOURCE_GROUP=chatapp-rg
        echo AZURE_LOCATION=eastus
        echo AZURE_APP_NAME=chatapp
        echo AZURE_ENV_NAME=chatapp-env
        echo.
        echo # Azure Container Registry
        echo AZURE_CONTAINER_REGISTRY=chatappacr
        echo.
        echo # Azure CosmosDB
        echo AZURE_COSMOS_ACCOUNT=chatapp-cosmos
        echo AZURE_COSMOS_DATABASE=chatapp
        echo.
        echo # Azure Redis Cache ^(opcional^)
        echo AZURE_REDIS_CACHE=chatapp-redis
        echo.
        echo # Application Config
        echo SECRET_KEY=CHANGE-THIS-TO-SECURE-RANDOM-KEY
    ) > .env.azure

    echo.
    echo [IMPORTANTE] Edite o arquivo .env.azure antes de continuar!
    echo Pressione qualquer tecla para abrir o arquivo...
    pause >nul
    notepad .env.azure
    echo.
    echo Arquivo editado? [S/N]
    set /p EDITED=
    if /i not "!EDITED!"=="S" (
        echo Deploy cancelado. Edite .env.azure e execute novamente.
        pause
        exit /b 1
    )
)

REM Carregar variáveis do .env.azure
echo [ACAO] Carregando configuracoes...
for /f "tokens=1,2 delims==" %%a in (.env.azure) do (
    set %%a=%%b
)

echo [OK] Configuracoes carregadas:
echo   Resource Group: %AZURE_RESOURCE_GROUP%
echo   Location: %AZURE_LOCATION%
echo   App Name: %AZURE_APP_NAME%
echo   Registry: %AZURE_CONTAINER_REGISTRY%
echo.

REM Confirmar deploy
echo [4/6] Confirmacao de deploy
echo.
echo  ATENCAO: Isto ira:
echo  1. Criar recursos no Azure ^(custos aplicaveis^)
echo  2. Build da imagem Docker
echo  3. Push para Azure Container Registry
echo  4. Deploy no Azure Container Apps
echo.
set /p CONFIRM=Deseja continuar? [S/N]:
if /i not "!CONFIRM!"=="S" (
    echo Deploy cancelado pelo usuario.
    pause
    exit /b 1
)
echo.

REM Build local primeiro para validar
echo [5/6] Testando build localmente...
echo [ACAO] Construindo imagem Docker Azure...
docker build -f Dockerfile.azure -t chatapp-azure:deploy .
if errorlevel 1 (
    echo.
    echo [ERRO] Build falhou! Corrija os erros antes de fazer deploy.
    pause
    exit /b 1
)
echo [OK] Build local bem-sucedida
echo.

REM Deploy para Azure
echo [6/6] Fazendo deploy para Azure...
echo [ACAO] Executando script de deploy...
echo.

REM Verificar se temos bash (Git Bash, WSL)
where bash >nul 2>&1
if not errorlevel 1 (
    echo Usando bash para executar azure-deploy.sh...
    bash azure-deploy.sh
) else (
    echo [AVISO] Bash nao encontrado. Deploy manual necessario.
    echo.
    echo Execute os seguintes comandos manualmente:
    echo.
    echo 1. Criar Resource Group:
    echo    az group create --name %AZURE_RESOURCE_GROUP% --location %AZURE_LOCATION%
    echo.
    echo 2. Criar Container Registry:
    echo    az acr create --name %AZURE_CONTAINER_REGISTRY% --resource-group %AZURE_RESOURCE_GROUP% --sku Basic --admin-enabled true
    echo.
    echo 3. Build e Push:
    echo    az acr build --registry %AZURE_CONTAINER_REGISTRY% --image chatapp-azure:latest --file Dockerfile.azure .
    echo.
    echo 4. Deploy Container App:
    echo    ^(veja azure-deploy.sh para comandos completos^)
    echo.
    pause
)

echo.
echo  ============================================================
echo   Deploy Concluido!
echo  ============================================================
echo.
echo Proximos passos:
echo 1. Verifique o deployment no Portal Azure
echo 2. Configure as variaveis de ambiente necessarias
echo 3. Acesse sua aplicacao na URL fornecida
echo.
pause
