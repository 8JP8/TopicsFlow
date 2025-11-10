# Windows Troubleshooting Guide

## Common Issues and Solutions

### 🔴 bcrypt._bcrypt Module Not Found

**Error:**
```
ModuleNotFoundError: No module named 'bcrypt._bcrypt'
```

This is a common Windows issue where bcrypt's C extensions fail to install properly.

#### Solution 1: Use the Updated Script (Recommended)
The `local-native.bat` script now includes an automatic fix. Simply run it again:
```batch
local-native.bat
```

The script will:
1. Uninstall any broken bcrypt installation
2. Install bcrypt using prebuilt binary wheels
3. Fall back to source compilation if needed

---

#### Solution 2: Manual bcrypt Reinstall

If the script doesn't work, try these manual steps:

**Step 1: Uninstall bcrypt**
```batch
pip uninstall -y bcrypt
```

**Step 2: Install with binary wheel only**
```batch
pip install --only-binary :all: bcrypt==4.1.0
```

If this fails with "no matching distribution", proceed to Solution 3.

---

#### Solution 3: Install Visual Studio Build Tools

If prebuilt wheels aren't available for your Python version, you need to compile bcrypt from source.

**Step 1: Download Visual Studio Build Tools**
- Download: https://visualstudio.microsoft.com/downloads/
- Scroll down to "Tools for Visual Studio"
- Download "Build Tools for Visual Studio 2022"

**Step 2: Install with C++ Build Tools**
- Run the installer
- Select "Desktop development with C++"
- Click Install (requires ~7GB)

**Step 3: Reinstall bcrypt**
```batch
pip install bcrypt==4.1.0
```

---

#### Solution 4: Use Compatible bcrypt Version

If you can't install Build Tools, try an older bcrypt version that has Windows wheels:

```batch
pip uninstall -y bcrypt
pip install bcrypt==4.0.1
```

Then update `backend/requirements.txt`:
```
bcrypt==4.0.1
```

---

#### Solution 5: Downgrade to Python 3.11

Python 3.12 is very new and some packages may not have prebuilt wheels yet.

**Step 1: Check your Python version**
```batch
python --version
```

**Step 2: If Python 3.12, install Python 3.11**
- Download: https://www.python.org/downloads/release/python-3119/
- Install Python 3.11.9 (make sure to check "Add Python to PATH")

**Step 3: Verify and reinstall**
```batch
python --version
pip install --upgrade pip
pip install -r backend\requirements.txt
```

---

### 🔴 Port Already in Use

**Error:**
```
OSError: [WinError 10048] Only one usage of each socket address
```

**Solution: Kill the process using the port**

**Find process on port 5000:**
```batch
netstat -ano | findstr :5000
```

**Kill the process:**
```batch
taskkill /PID <number> /F
```

Example:
```batch
netstat -ano | findstr :5000
# Output: TCP    0.0.0.0:5000    0.0.0.0:0    LISTENING    12345

taskkill /PID 12345 /F
```

---

### 🔴 MongoDB Connection Failed

**Error:**
```
pymongo.errors.ServerSelectionTimeoutError: localhost:27017
```

**Solution 1: Check if MongoDB is running**
```batch
docker ps | findstr mongodb
```

**Solution 2: Start MongoDB**
```batch
docker start mongodb-test
```

**Solution 3: Create new MongoDB container**
```batch
docker run -d --name mongodb-test -p 27017:27017 -e MONGO_INITDB_ROOT_USERNAME=admin -e MONGO_INITDB_ROOT_PASSWORD=password123 mongo:7.0
```

**Solution 4: Install MongoDB locally**
- Download: https://www.mongodb.com/try/download/community
- Install MongoDB Community Server
- Start MongoDB service from Windows Services

---

### 🔴 Docker Not Found

**Error:**
```
'docker' is not recognized as an internal or external command
```

**Solution: Install Docker Desktop**
1. Download: https://www.docker.com/products/docker-desktop/
2. Install Docker Desktop for Windows
3. Restart computer
4. Start Docker Desktop
5. Wait for Docker to fully start (check system tray icon)

---

### 🔴 Python Not Found

**Error:**
```
'python' is not recognized as an internal or external command
```

**Solution 1: Install Python**
1. Download: https://www.python.org/downloads/
2. Install Python 3.11+
3. ✅ **IMPORTANT:** Check "Add Python to PATH" during installation
4. Restart command prompt

**Solution 2: Fix PATH (if already installed)**
1. Search "Environment Variables" in Windows
2. Edit "Path" in System Variables
3. Add: `C:\Users\YourUsername\AppData\Local\Programs\Python\Python311`
4. Add: `C:\Users\YourUsername\AppData\Local\Programs\Python\Python311\Scripts`
5. Click OK and restart command prompt

---

### 🔴 pip Not Found

**Error:**
```
'pip' is not recognized as an internal or external command
```

**Solution: Reinstall pip**
```batch
python -m ensurepip --upgrade
python -m pip install --upgrade pip
```

---

### 🔴 Permission Denied Errors

**Error:**
```
PermissionError: [WinError 5] Access is denied
```

**Solution 1: Run as Administrator**
- Right-click `local-native.bat`
- Select "Run as administrator"

**Solution 2: Install packages for user only**
```batch
pip install --user -r backend\requirements.txt
```

---

### 🔴 eventlet Not Working on Windows

This is expected! The script automatically detects Windows and uses `threading` mode instead of `eventlet`. This is handled automatically in `backend/app.py`.

---

## Quick Diagnostic Commands

Check your environment:

```batch
REM Python version (should be 3.11+)
python --version

REM pip version
pip --version

REM Docker version
docker --version

REM Check if packages are installed
pip list | findstr flask
pip list | findstr bcrypt
pip list | findstr pymongo

REM Check running processes on port 5000
netstat -ano | findstr :5000

REM Check Docker containers
docker ps -a
```

---

## Clean Reinstall (Nuclear Option)

If nothing else works, start fresh:

```batch
REM 1. Uninstall all Python packages
pip freeze > packages.txt
pip uninstall -r packages.txt -y
del packages.txt

REM 2. Upgrade pip
python -m pip install --upgrade pip setuptools wheel

REM 3. Reinstall everything
cd backend
pip install -r requirements.txt

REM 4. Run the script
cd ..
local-native.bat
```

---

## Still Having Issues?

1. Check the error message carefully
2. Search for the specific error online
3. Make sure you're using Python 3.11 or 3.12
4. Verify Docker Desktop is running (if using Docker for MongoDB)
5. Check Windows Firewall isn't blocking ports 5000 or 27017

---

## Contact Information

If you continue to have issues, please provide:
- Python version: `python --version`
- pip version: `pip --version`
- Operating System: Windows 10/11
- Error message: Full traceback
- Output of: `pip list`
