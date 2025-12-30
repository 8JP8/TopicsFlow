# Deployment & DevOps

TopicsFlow is designed to be deployed using **Docker** and is optimized for **Microsoft Azure** (Container Apps).

## ☁️ Azure Deployment

The project includes configuration for deploying to Azure Container Apps, utilizing:
- **Azure Container Apps**: For hosting the Backend and Frontend containers.
- **Azure CosmosDB for MongoDB**: For the database layer.
- **Azure Cache for Redis**: For session management and caching.

### Deployment Files

- `azure-container-apps.yaml`: Infrastructure-as-Code (IaC) definition for the container apps environment.
- `.github/workflows/azure-deploy.yml`: GitHub Actions workflow for automated deployment on push to `main`.
- `Dockerfile.azure`: Optimized Dockerfile for the backend in Azure.
- `Dockerfile.frontend`: Dockerfile for the Next.js frontend.

### Environment Variables (Azure)

When deploying to Azure, ensure these variables are set in the Container App secrets/env:

| Variable | Description |
|---|---|
| `MONGO_URI` | Connection string for CosmosDB. |
| `REDIS_URL` | Connection string for Azure Redis. |
| `FLASK_ENV` | Set to `production`. |
| `IS_AZURE` | Set to `true` to enable Azure-specific tweaks. |
| `FRONTEND_URL` | URL of the deployed frontend (for CORS). |

## 🐳 Docker Deployment

For generic deployment (VPS, other clouds), use `docker-compose.prod.yml`.

1. **Build Images**:
   ```bash
   docker-compose -f docker-compose.prod.yml build
   ```
2. **Start Services**:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

## 🔄 CI/CD Pipelines

The project uses GitHub Actions for Continuous Integration and Deployment.

### Workflows

1. **Test & Lint** (`main_topicsflowrinte.yml`):
   - Runs on every push.
   - Executes backend tests (`pytest`).
   - Checks code style.

2. **Azure Deploy** (`azure-deploy.yml`):
   - Triggered on push to `main`.
   - Builds Docker images.
   - Pushes to Azure Container Registry (ACR).
   - Updates Azure Container Apps revision.

## 🛠️ Maintenance Scripts

The `scripts/` directory contains useful tools for database maintenance:
- `migrate_database_schema.py`: Applies schema updates to existing documents.
- `fix_indexes_and_migrate.py`: Rebuilds MongoDB indexes.
- `cleanup_locales.py`: Manage translation files.

Run these from the backend container or a machine with access to the database.
