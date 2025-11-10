#!/bin/bash

# Azure Deployment Script for ChatApp
# This script deploys the application to Azure Container Apps

set -e

echo "======================================"
echo "Azure ChatApp Deployment Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration - Update these values
RESOURCE_GROUP="${AZURE_RESOURCE_GROUP}"
LOCATION="${AZURE_LOCATION:-eastus}"
CONTAINER_APP_NAME="${AZURE_APP_NAME:-chatapp}"
CONTAINER_ENV_NAME="${AZURE_ENV_NAME:-chatapp-env}"
ACR_NAME="${AZURE_CONTAINER_REGISTRY}"
IMAGE_NAME="chatapp-azure"
IMAGE_TAG="latest"

# Cosmos DB Configuration
COSMOS_ACCOUNT_NAME="${AZURE_COSMOS_ACCOUNT}"
COSMOS_DB_NAME="${AZURE_COSMOS_DATABASE:-chatapp}"

# Redis Cache Configuration (optional)
REDIS_CACHE_NAME="${AZURE_REDIS_CACHE}"

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo -e "${RED}Error: Azure CLI is not installed${NC}"
    echo -e "${YELLOW}Install from: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli${NC}"
    exit 1
fi

# Check if logged in to Azure
echo -e "${BLUE}Checking Azure login status...${NC}"
az account show &> /dev/null || {
    echo -e "${YELLOW}Not logged in to Azure. Logging in...${NC}"
    az login
}

# Validate required variables
if [ -z "$RESOURCE_GROUP" ]; then
    echo -e "${RED}Error: AZURE_RESOURCE_GROUP is not set${NC}"
    exit 1
fi

if [ -z "$ACR_NAME" ]; then
    echo -e "${RED}Error: AZURE_CONTAINER_REGISTRY is not set${NC}"
    exit 1
fi

echo -e "${GREEN}Configuration:${NC}"
echo -e "  Resource Group: ${RESOURCE_GROUP}"
echo -e "  Location: ${LOCATION}"
echo -e "  Container App: ${CONTAINER_APP_NAME}"
echo -e "  ACR: ${ACR_NAME}"
echo ""

# Step 1: Create Resource Group (if not exists)
echo -e "${BLUE}Step 1: Creating Resource Group...${NC}"
az group create \
    --name ${RESOURCE_GROUP} \
    --location ${LOCATION} \
    --output none 2>/dev/null || echo -e "${YELLOW}Resource group already exists${NC}"

# Step 2: Create Azure Container Registry (if not exists)
echo -e "${BLUE}Step 2: Creating Azure Container Registry...${NC}"
az acr create \
    --name ${ACR_NAME} \
    --resource-group ${RESOURCE_GROUP} \
    --sku Basic \
    --admin-enabled true \
    --output none 2>/dev/null || echo -e "${YELLOW}ACR already exists${NC}"

# Step 3: Build and push Docker image
echo -e "${BLUE}Step 3: Building and pushing Docker image...${NC}"
az acr build \
    --registry ${ACR_NAME} \
    --image ${IMAGE_NAME}:${IMAGE_TAG} \
    --file Dockerfile.azure \
    .

# Step 4: Create CosmosDB Account (MongoDB API)
if [ ! -z "$COSMOS_ACCOUNT_NAME" ]; then
    echo -e "${BLUE}Step 4: Creating CosmosDB Account...${NC}"
    az cosmosdb create \
        --name ${COSMOS_ACCOUNT_NAME} \
        --resource-group ${RESOURCE_GROUP} \
        --kind MongoDB \
        --server-version 4.2 \
        --default-consistency-level Eventual \
        --locations regionName=${LOCATION} failoverPriority=0 isZoneRedundant=False \
        --output none 2>/dev/null || echo -e "${YELLOW}CosmosDB already exists${NC}"

    # Get CosmosDB connection string
    COSMOS_CONNECTION_STRING=$(az cosmosdb keys list \
        --name ${COSMOS_ACCOUNT_NAME} \
        --resource-group ${RESOURCE_GROUP} \
        --type connection-strings \
        --query "connectionStrings[0].connectionString" \
        --output tsv)

    echo -e "${GREEN}CosmosDB connection string retrieved${NC}"
else
    echo -e "${YELLOW}Skipping CosmosDB creation (AZURE_COSMOS_ACCOUNT not set)${NC}"
    echo -e "${RED}Warning: You need to set COSMOS_CONNECTION_STRING manually${NC}"
fi

# Step 5: Create Redis Cache (optional)
if [ ! -z "$REDIS_CACHE_NAME" ]; then
    echo -e "${BLUE}Step 5: Creating Redis Cache...${NC}"
    az redis create \
        --name ${REDIS_CACHE_NAME} \
        --resource-group ${RESOURCE_GROUP} \
        --location ${LOCATION} \
        --sku Basic \
        --vm-size C0 \
        --output none 2>/dev/null || echo -e "${YELLOW}Redis Cache already exists${NC}"

    # Get Redis connection string
    REDIS_ACCESS_KEY=$(az redis list-keys \
        --name ${REDIS_CACHE_NAME} \
        --resource-group ${RESOURCE_GROUP} \
        --query primaryKey \
        --output tsv)

    REDIS_CONNECTION_STRING="redis://:${REDIS_ACCESS_KEY}@${REDIS_CACHE_NAME}.redis.cache.windows.net:6380/0?ssl=True"
    echo -e "${GREEN}Redis connection string retrieved${NC}"
fi

# Step 6: Create Container Apps Environment
echo -e "${BLUE}Step 6: Creating Container Apps Environment...${NC}"
az containerapp env create \
    --name ${CONTAINER_ENV_NAME} \
    --resource-group ${RESOURCE_GROUP} \
    --location ${LOCATION} \
    --output none 2>/dev/null || echo -e "${YELLOW}Environment already exists${NC}"

# Step 7: Get ACR credentials
ACR_SERVER="${ACR_NAME}.azurecr.io"
ACR_USERNAME=$(az acr credential show --name ${ACR_NAME} --query username --output tsv)
ACR_PASSWORD=$(az acr credential show --name ${ACR_NAME} --query passwords[0].value --output tsv)

# Step 8: Create/Update Container App
echo -e "${BLUE}Step 8: Deploying Container App...${NC}"

# Generate random secret key if not set
SECRET_KEY="${SECRET_KEY:-$(openssl rand -base64 32)}"

# Build environment variables
ENV_VARS="FLASK_ENV=azure PORT=8000 TOTP_ISSUER=ChatHub WEBSITE_INSTANCE_ID=azure-container-apps"

if [ ! -z "$COSMOS_CONNECTION_STRING" ]; then
    ENV_VARS="${ENV_VARS} AZURE_COSMOS_CONNECTIONSTRING=${COSMOS_CONNECTION_STRING} AZURE_COSMOS_DATABASE=${COSMOS_DB_NAME}"
fi

if [ ! -z "$REDIS_CONNECTION_STRING" ]; then
    ENV_VARS="${ENV_VARS} AZURE_REDIS_CONNECTIONSTRING=${REDIS_CONNECTION_STRING}"
fi

# Deploy container app
az containerapp create \
    --name ${CONTAINER_APP_NAME} \
    --resource-group ${RESOURCE_GROUP} \
    --environment ${CONTAINER_ENV_NAME} \
    --image ${ACR_SERVER}/${IMAGE_NAME}:${IMAGE_TAG} \
    --target-port 8000 \
    --ingress external \
    --registry-server ${ACR_SERVER} \
    --registry-username ${ACR_USERNAME} \
    --registry-password ${ACR_PASSWORD} \
    --cpu 1.0 \
    --memory 2Gi \
    --min-replicas 1 \
    --max-replicas 10 \
    --env-vars ${ENV_VARS} \
    --secrets secret-key=${SECRET_KEY} \
    --output none 2>/dev/null || {

    echo -e "${YELLOW}Container app exists, updating...${NC}"
    az containerapp update \
        --name ${CONTAINER_APP_NAME} \
        --resource-group ${RESOURCE_GROUP} \
        --image ${ACR_SERVER}/${IMAGE_NAME}:${IMAGE_TAG} \
        --output none
}

# Get the app URL
APP_URL=$(az containerapp show \
    --name ${CONTAINER_APP_NAME} \
    --resource-group ${RESOURCE_GROUP} \
    --query properties.configuration.ingress.fqdn \
    --output tsv)

echo -e "${GREEN}======================================"
echo -e "Deployment completed successfully!"
echo -e "======================================"
echo -e "${BLUE}Application URL: ${GREEN}https://${APP_URL}${NC}"
echo -e "${BLUE}Health Check: ${GREEN}https://${APP_URL}/health${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "1. Update FRONTEND_URL environment variable to: https://${APP_URL}"
echo -e "2. Configure any additional environment variables (TENOR_API_KEY, etc.)"
echo -e "3. Test the application"
echo -e "4. Configure custom domain (optional)"
