# Testing Guide

Quality assurance is critical for TopicsFlow. This guide covers how to run the various test suites available in the project.

## 🧪 Backend Testing

The backend uses `pytest` for unit and integration testing.

### Prerequisites

Ensure you have the test dependencies installed:
```bash
pip install -r backend/requirements.txt
```

### Running Tests

**Windows:**
```powershell
.\run_tests.bat
```

**Linux/Mac:**
```bash
./run_tests.sh
```

### Test Structure (`backend/tests/` or via scripts)

- **Unit Tests**: Test individual functions and models (e.g., `test_user.py`).
- **Integration Tests**: Test API endpoints and database interactions.
- **Connection Tests**:
  - `backend/test_cosmos_connection.py`: Verifies MongoDB/CosmosDB connectivity.
  - `backend/scripts/test_redis_connection.py`: Verifies Redis connectivity.

### Manual Testing with Postman
A Postman collection is included in the root directory: `TopicsFlow_API.postman_collection.json`. Import this into Postman to test API endpoints manually.

## ⚛️ Frontend Testing

Currently, the frontend relies on linting and type checking.

### Type Checking
```bash
cd frontend
npm run type-check
```

### Linting
```bash
cd frontend
npm run lint
```

## 🔄 End-to-End Verification

A comprehensive verification script checks the health of the entire local environment.

**Windows:**
```powershell
.\VERIFY_SETUP.bat
```

This script checks:
1. Python & Node.js versions.
2. Configuration files existence.
3. Database connection (via Python script).
4. Directory structure integrity.

## 🐛 Debugging

### Backend Logs
Flask logs are output to stdout. In production (Azure), these can be viewed in the Log Stream.

### Frontend Debugging
Use the React Developer Tools extension in your browser to inspect component state and Context values.
