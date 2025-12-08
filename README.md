Portfolio Quant App

A modern React + FastAPI quantitative analytics platform for portfolio analysis, risk metrics, backtesting, optimization, and empirical strategy development.

Built with a feature-based architecture, production-grade engineering patterns, and ready for local dev, Docker Compose, or cloud deployment (Vercel / Render).

🚀 Features
Frontend — /client

Modern Vite + React application with a modular, scalable structure:

Feature-based pages:
Overview (snapshot, equity curve, PnL, metrics)
Positions (holdings, exposures, weights)
Analytics (performance stats, Sharpe/vol, drawdowns, backtests, stress tests)

Centralized API client (services/apiClient)

Shared domain types (types/portfolio.ts)

Pure quant math extracted into lib/analyticsCalculations

Demo mode + CSV upload support

Responsive UI + rich charting with Recharts

Clean routing using a dedicated AppShell and routes.tsx

Backend — /backend/app

Modular FastAPI quant engine designed around clarity, testability, and performance:

Clean API under api/v1/
(overview, positions, analytics, backtests, optimizers)

Services layer (services/) for business logic & analytics computation

Typed Pydantic schemas (schemas/) for all endpoints

Config & exceptions (core/)

Optional caching for market data and recurring calculations

Analytics engine includes:

Returns, volatility, Sharpe, Sortino

Max drawdown & full drawdown series

Position-level exposures & risk

Backtesting + simple optimizers

🧪 Project Structure
backend/
  app/
    api/v1/             # API routes
    services/           # analytics & portfolio logic
    schemas/            # Pydantic models
    core/               # settings, config, exceptions
    data_cache/         # optional cached market data
    runs/               # backtest logs
  tests/                # unit + integration tests

client/
  src/
    app/                # AppShell, global routes
    features/           # overview / positions / analytics
    services/           # API client
    types/              # shared TS domain types
    lib/                # pure quant math
    components/         # shared UI pieces
    hooks/              # shared hooks

🛠 Local Development
1. Backend (FastAPI)
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


FastAPI runs at: http://localhost:8000

Docs: http://localhost:8000/docs

2. Frontend (React + Vite)
cd client
npm install
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev -- --host --port 5173


Frontend runs at: http://localhost:5173

🐳 Docker Compose (One Command)

To run the full stack with Docker:

docker compose up --build


Exposed services:

Service	URL
Backend	http://localhost:8000

Frontend	http://localhost:3000

VITE_API_BASE_URL is automatically wired to the backend container inside Docker.

⚙️ Environment Variables
Backend
Variable	Description
BACKEND_CORS_ORIGINS	Comma-separated allowed CORS origins (defaults cover localhost, saxtonpi.com/www.saxtonpi.com, Render URL)
DATA_CACHE_DIR	Price cache directory (default: app/data_cache)
RUNS_DIR	Backtest output directory
Frontend
Variable	Description
VITE_API_BASE_URL	URL of the FastAPI backend (set to Render backend in Vercel, e.g., https://portfolio-app-6lfb.onrender.com)
Vercel: set VITE_API_BASE_URL to the Render backend. Render: set BACKEND_CORS_ORIGINS to include https://saxtonpi.com and https://www.saxtonpi.com (plus previews).
🧪 Testing
Backend Tests
cd backend
pytest


Covers:

Analytics math

Services layer

Endpoint response shapes

Frontend Tests (optional)

Vitest + React Testing Library (when enabled)

📦 Deployment

This project is ready for:

Render (backend)

Vercel or Netlify (frontend)

Full Docker deployment via Compose or Kubernetes

Local development without Docker

🎯 Purpose

This project is designed as a portfolio analytics + quant engineering showcase, combining:

Modern frontend architecture

Typed backend with clean APIs

Real quant metrics

Reproducible environments (Docker)

Extensible structure for more factor models, ML signals, execution sims, etc.

## Documentation & research

- `docs/saxtonpi_overview.md`: explains what Saxton PI solves (portfolio analytics, research, tax harvesting) and walks through the institutional-grade SMA/RSI workflow (signal-on-close/trade-next-open, integer shares, slippage, commissions, equity curve + metrics).  
- `docs/design_decisions.md`: production notes on the React + FastAPI choice, feature-based frontend structure, CORS/env handling, deployment guidance, and known limitations/future work.  
- `docs/architecture.svg`: visual map of Frontend → FastAPI → Analytics Engine → Data/Cache plus the detailed backtest flow (signals → trades → equity → metrics).  
- Screenshots were removed from the repo to keep the build light—capture fresh hero frames by running `npm run dev` and taking your own frames if desired.

## Sample data & demo setups

- `sample_data/spy_sample.csv`: trimmed SPY price history you can load into the notebook or use for quick sanity checks.  
- `sample_data/portfolio_positions.csv`: a sample portfolio (AAPL, MSFT, VTI, etc.) for uploading into the tax-harvest builder.  
- `demo/strategy_config.json`: the SPY SMA/RSI configuration referenced across the docs.  
- `demo/portfolio.json`: a small multi-asset portfolio for PM walkthroughs and tax-harvest analysis.

## Research notebook

- `notebooks/strategy_walkthrough.ipynb` runs a SMA fast/slow parameter sweep, renders a Sharpe/CAGR heatmap, and drills into a single corner (e.g., fast=10 / slow=200) using the local `run_quant_backtest` helper.

## Testing & continuous integration

- Backend pytest suite (`backend/app/tests/test_backtest_buy_and_hold_matches_benchmark.py`, `test_backtest_flat_strategy_keeps_equity_constant.py`, `test_drawdown_matches_hand_calculation.py`) ensures the quant engine maintains equity, drawdowns, and benchmark tracking math.  
- Frontend Vitest check (`client/src/services/__tests__/apiClient.test.ts`) verifies `resolveApiBase` honors `VITE_API_BASE_URL` or falls back cleanly to localhost/same-origin.  
- `.github/workflows/ci.yml` installs backend dependencies + runs pytest, then installs frontend deps, runs `npm run test`, and finally builds the React app so every push/PR validates both stacks.

Run the stacks manually:

- Backend tests: `cd backend && pytest`
- Frontend tests: `cd client && npm run test`
