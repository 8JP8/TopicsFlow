# TopicsFlow - Azure Deployment Guide

This guide provides the necessary steps to configure your Azure resources for **TopicsFlow**, following the architecture of **Azure Static Web Apps** (Frontend) and **Azure App Service** (Backend).

## 1. Backend: Azure App Service (Web App for Containers)

Your backend is ready to be deployed as a Docker container.

### Environment Variables
In the Azure Portal, go to your **App Service** > **Configuration** > **Application settings** and add:

| Key | Value | Description |
|-----|-------|-------------|
| `FLASK_ENV` | `azure` | Enables Azure-specific configuration. |
| `FRONTEND_URL` | `https://your-swa-url.azurestaticapps.net` | **CRITICAL**: The URL of your Static Web App. |
| `COSMOS_DB_URI` | `mongodb://...` | Connection string from your Cosmos DB (MongoDB API). |
| `COSMOS_DB_NAME` | `topicsflow` | Your database name. |
| `AZURE_STORAGE_CONNECTION_STRING` | `DefaultEndpointsProtocol=...` | Connection string from your Storage Account. |
| `AZURE_STORAGE_CONTAINER` | `uploads` | Container name for files (default is 'uploads'). |
| `SECRET_KEY` | `your-random-secret` | A secure random string for sessions. |
| `PORT` | `8000` | Port used by the container (already set in Dockerfile). |

### Networking
*   Ensure **Always On** is enabled (if using a paid plan) to keep WebSockets alive.
*   Enable **WebSockets** in the Configuration > General Settings.

---

## 2. Frontend: Azure Static Web App

You have already created the SWA. Ensure the following is set:

### Build Configuration
If you are using GitHub Actions to deploy, ensure your `build_command` is:
```bash
npm run build:azure
```
This ensures the `next.config.azure.js` is used for the static export into the `out/` directory.

### Environment Variables
For Static Web Apps, "Environment Variables" are baked in during build time if using GitHub Actions. In your workflow file (`.yml`), add:
```yaml
env:
  NEXT_PUBLIC_API_URL: https://your-backend-app-service.azurewebsites.net
```

---

## 3. Database: Cosmos DB (API for MongoDB)
*   Go to **Connection Strings**.
*   Copy the **Primary Connection String** and paste it into the `COSMOS_DB_URI` in the App Service settings.

---

## 4. File Storage: Azure Blob Storage
*   Create a container named `uploads`.
*   Set the Access Level to **Private** (recommended as the backend handles encryption/proxying).

## 5. Deployment Task
You can now run the `deploy-azure.bat` script. It will:
1.  Build a **Backend-only** Docker image (since the frontend is now separate).
2.  Push it to your Azure Container Registry.
3.  Update your App Service to use the new image.
