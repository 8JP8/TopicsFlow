# Project Structure

The TopicsFlow repository is organized into two main applications: the Flask backend and the Next.js frontend, along with root-level configuration for deployment and development.

## 📂 Root Directory

| File/Folder | Description |
|---|---|
| `.github/` | GitHub Actions workflows for CI/CD (Azure, testing). |
| `backend/` | Python Flask application source code. |
| `frontend/` | Next.js/React application source code. |
| `docker-compose.yml` | Base Docker Compose configuration. |
| `docker-compose.local.yml` | Docker Compose overrides for local development (includes Mongo/Redis). |
| `docker-compose.prod.yml` | Docker Compose overrides for production. |
| `env-setup.bat/sh` | Scripts to generate `.env` files for development. |
| `run-local.bat/sh` | Helper scripts to start the application locally. |
| `README.md` | Project entry point documentation. |

## 🐍 Backend Structure (`/backend`)

The backend is built with Flask and structured using the Application Factory pattern.

| Directory | Description |
|---|---|
| `config/` | Configuration modules (Rate limits, environment settings). |
| `docs/` | Backend-specific documentation. |
| `models/` | MongoDB data models (ODM-like classes). |
| `routes/` | API route definitions (Blueprints). |
| `services/` | Business logic services (Auth, Email, Storage). |
| `utils/` | Helper utilities (Decorators, Validators, Cache). |
| `app.py` | Application entry point and factory function. |
| `extensions.py` | Flask extension initialization (SocketIO, CORS, Session). |
| `socketio_handlers.py` | Real-time WebSocket event handlers. |
| `wsgi.py` | WSGI entry point for production servers (Gunicorn). |

## ⚛️ Frontend Structure (`/frontend`)

The frontend is a Next.js application using TypeScript and Tailwind CSS.

| Directory | Description |
|---|---|
| `components/` | Reusable UI components (Atoms, Molecules, Organisms). |
| `contexts/` | React Context providers (Auth, Socket, UI State). |
| `hooks/` | Custom React hooks. |
| `pages/` | Next.js pages (File-based routing). |
| `public/` | Static assets (Images, Icons). |
| `styles/` | Global styles and Tailwind configuration. |
| `utils/` | Frontend utility functions (API clients, Formatters). |
| `next.config.js` | Next.js configuration. |
| `tailwind.config.js` | Tailwind CSS configuration. |
