---
description: How to restart MongoDB on Windows
---

# Restarting MongoDB

Since you are encountering connection errors, your MongoDB server is likely stopped.

## Option 1: Run Manually (Recommended for Dev)
1. Open a new Terminal (PowerShell or Command Prompt).
2. Run the command:
   ```powershell
   mongod
   ```
3. Keep this window **OPEN**. You should see logs like `Waiting for connections on port 27017`.

## Option 2: Windows Service (If installed as Service)
1. Open PowerShell **as Administrator**.
2. Run:
   ```powershell
   net start MongoDB
   ```
   Or if it's already running but stuck:
   ```powershell
   net stop MongoDB
   net start MongoDB
   ```

## Option 3: Docker (If using Docker)
1. Run:
   ```powershell
   docker-compose up -d mongodb
   ```
