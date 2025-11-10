#!/bin/bash

# Azure Build Script for ChatApp
# This script builds the Docker image for Azure deployment

set -e

echo "======================================"
echo "Azure ChatApp Build Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="${AZURE_IMAGE_NAME:-chatapp-azure}"
IMAGE_TAG="${AZURE_IMAGE_TAG:-latest}"
REGISTRY="${AZURE_CONTAINER_REGISTRY}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Build the Docker image
echo -e "${GREEN}Building Docker image...${NC}"
docker build -f Dockerfile.azure -t ${IMAGE_NAME}:${IMAGE_TAG} .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Docker image built successfully: ${IMAGE_NAME}:${IMAGE_TAG}${NC}"
else
    echo -e "${RED}Failed to build Docker image${NC}"
    exit 1
fi

# Tag and push to Azure Container Registry if configured
if [ ! -z "$REGISTRY" ]; then
    echo -e "${GREEN}Tagging image for Azure Container Registry...${NC}"
    docker tag ${IMAGE_NAME}:${IMAGE_TAG} ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}

    echo -e "${GREEN}Pushing image to Azure Container Registry...${NC}"
    docker push ${REGISTRY}/${IMAGE_NAME}:${IMAGE_TAG}

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}Image pushed successfully to ${REGISTRY}${NC}"
    else
        echo -e "${RED}Failed to push image to registry${NC}"
        exit 1
    fi
else
    echo -e "${YELLOW}Azure Container Registry not configured. Skipping push.${NC}"
    echo -e "${YELLOW}To push to ACR, set AZURE_CONTAINER_REGISTRY environment variable${NC}"
fi

# Test the image locally (optional)
if [ "$1" = "--test" ]; then
    echo -e "${GREEN}Testing image locally...${NC}"
    docker run -d \
        --name chatapp-test \
        -p 8000:8000 \
        -e AZURE_COSMOS_CONNECTIONSTRING="mongodb://localhost:27017/chatapp" \
        -e AZURE_COSMOS_DATABASE="chatapp" \
        ${IMAGE_NAME}:${IMAGE_TAG}

    echo -e "${GREEN}Container started. Test at http://localhost:8000${NC}"
    echo -e "${YELLOW}To stop: docker stop chatapp-test && docker rm chatapp-test${NC}"
fi

echo -e "${GREEN}======================================"
echo -e "Build completed successfully!"
echo -e "======================================${NC}"
