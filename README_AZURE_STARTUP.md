# Azure App Service - Startup Configuration

## Problem
Azure App Service is trying to use `eventlet` worker class but the module is not installed, causing:
```
ModuleNotFoundError: No module named 'eventlet'
```

## Solution

### Option 1: Use Startup Script (Recommended)

1. **Ensure `requirements.txt` is in the correct location:**
   - The `requirements.txt` should be in `/home/site/wwwroot/backend/` or `/home/site/wwwroot/`
   - Azure App Service automatically installs dependencies from `requirements.txt` during build

2. **Configure Azure App Service Startup Command:**
   - Go to Azure Portal → Your App Service → **Configuration** → **General settings**
   - Set **Startup Command** to:
     ```bash
     cd /home/site/wwwroot/backend && bash startup.sh
     ```
   - Or if your app is in the root:
     ```bash
     bash startup.sh
     ```

3. **Alternative: Use Python directly with requirements installation:**
   ```bash
   pip install -r requirements.txt && gunicorn --bind=0.0.0.0:8000 --worker-class eventlet --workers=1 app:app
   ```

### Option 2: Use Sync Worker (No eventlet needed)

If you don't need WebSocket support or can use a different approach:

1. **Change startup command to:**
   ```bash
   gunicorn --bind=0.0.0.0:8000 --worker-class sync --workers=4 --timeout=120 app:app
   ```

2. **Note:** This won't support WebSocket connections. For WebSocket support, you need `eventlet` or `gevent`.

### Option 3: Use Gevent Worker (Alternative to eventlet)

1. **Add to requirements.txt:**
   ```
   gevent==23.9.1
   gevent-websocket==0.10.1
   ```

2. **Change startup command to:**
   ```bash
   gunicorn --bind=0.0.0.0:8000 --worker-class gevent --workers=1 --timeout=120 app:app
   ```

### Option 4: Ensure Requirements.txt is Installed

The most common issue is that Azure isn't finding or installing `requirements.txt`. 

1. **Check file location:**
   - Requirements.txt should be in the deployment root or backend directory
   - Azure looks for it in `/home/site/wwwroot/requirements.txt` or `/home/site/wwwroot/backend/requirements.txt`

2. **Enable Oryx build:**
   - Go to Azure Portal → Configuration → General settings
   - Ensure **"Always On"** is enabled
   - Check **"SCM_DO_BUILD_DURING_DEPLOYMENT"** is set to `true` (default)

3. **Manual installation in startup:**
   ```bash
   pip install -r /home/site/wwwroot/backend/requirements.txt && gunicorn --bind=0.0.0.0:8000 --worker-class eventlet --workers=1 app:app
   ```

## Recommended Configuration

For TopicsFlow with WebSocket support, use:

**Startup Command:**
```bash
cd /home/site/wwwroot/backend && pip install --no-cache-dir -r requirements.txt && gunicorn --bind=0.0.0.0:8000 --worker-class eventlet --workers=1 --timeout=120 --access-logfile - --error-logfile - app:app
```

This ensures:
1. Dependencies are installed before starting
2. Eventlet worker is used for WebSocket support
3. Single worker (required for eventlet with SocketIO)
4. Proper logging

## Verify Installation

After deployment, check logs to verify:
- `eventlet` is installed
- Gunicorn starts successfully
- No import errors

