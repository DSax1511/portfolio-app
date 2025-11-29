Portfolio Quant App

A modern, feature-based React + FastAPI application for portfolio analytics, risk metrics, backtesting, and optimization.

The app consists of:

Backend: Modular FastAPI quant engine (analytics, risk, backtests, optimizers, rebalance).

Frontend: Vite + React client with clean feature architecture and routed pages (Overview / Positions / Analytics).

Deployment: Local dev (Python/Node), Docker Compose, or cloud hosting (Render/Vercel-ready).

Features
Frontend (client/)

Modern React/Vite architecture with feature folders:

Overview — portfolio snapshot, equity + PnL, summary metrics

Positions — holdings table, exposures, weights

Analytics — performance, Sharpe/vol, drawdowns, backtests, stress tests

Centralized API client (services/apiClient)

Shared domain types (types/portfolio.ts)

Pure quant math extracted into lib/analyticsCalculations

Demo mode and CSV upload support

Responsive design and charting with Recharts

Backend (backend/app/)

Modular FastAPI structure:

api/v1 — cleanly separated routes (overview, positions, analytics)

services/ — portfolio & analytics business logic

schemas/ — Pydantic models for typed responses

core/ — config, exceptions, dependencies

Analytics engine:

Returns, volatility, Sharpe, Sortino

Max drawdown & drawdown series

Position-level metrics & exposures

Backtesting + optimizers (if enabled)

Optional caching of market data for faster runs

Installation & Quick Start
Local Development
1. Backend (FastAPI)
cd backend
python -m venv .venv
source .venv/bin/activate       # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


Backend runs at:
http://localhost:8000

Docs:
http://localhost:8000/docs

2. Frontend (React/Vite)
cd client
npm install
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev -- --host --port 5173


Frontend runs at:
http://localhost:5173

 Docker Compose (one command)

To run the full stack using Docker:

docker compose up --build


Services exposed:

Service	URL
Backend	http://localhost:8000

Frontend	http://localhost:3000

VITE_API_BASE_URL is automatically wired to the backend container.

Environment Variables
Backend
Variable	Description
FRONTEND_ORIGINS	Comma-separated allowed CORS origins
DATA_CACHE_DIR	Directory for price cache (default: backend/app/data_cache)
RUNS_DIR	Directory for backtest logs (default: backend/app/runs)
Frontend
Variable	Description
VITE_API_BASE_URL	URL of FastAPI backend (default: same origin)

Testing
Backend Tests
cd backend
pytest


Tests include:

Unit tests (analytics math, services)

Integration tests (FastAPI endpoints, expected response shapes)

Frontend Tests

(when enabled)
Uses Vitest + React Testing Library.

Project Structure
backend/
  app/
    api/v1/             # routes (overview, positions, analytics)
    services/           # business logic (analytics, portfolio, backtests)
    schemas/            # pydantic models
    core/               # settings, exceptions, dependencies
    data_cache/         # price & analytics caching
    runs/               # backtest logs
  tests/                # unit + integration tests

client/
  src/
    app/                # AppShell, routing
    features/           # overview/positions/analytics pages
    services/           # apiClient + portfolioApi
    types/              # shared TS domain types
    lib/                # pure quant calculations
    components/         # shared UI components
    hooks/              # shared hooks

 