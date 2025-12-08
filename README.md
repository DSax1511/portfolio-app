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

## Documentation & research

- `docs/saxtonpi_overview.md`: covers Saxton PI’s problems (portfolio analysis, risk stats, tax harvest, backtesting), walks through the realistic SMA/RSI strategy (signal-on-close, trade-next-open, integer shares, slippage, commission), and links to the annotated strategy screenshot.  
- `docs/design_decisions.md`: production notes on the FastAPI + React choice, feature-based frontend structure, CORS/env var handling, known limitations, and future extensions.  
- `docs/architecture.svg`: visual overview of Frontend → FastAPI → Analytics Engine → Data/Cache plus the detailed backtest pipeline (data → signals → trades → equity → metrics).  
## Sample data & demo setups

- `sample_data/spy_sample.csv`: trimmed SPY history for offline demos or notebook playback.  
- `sample_data/portfolio_positions.csv`: an example holdings file (AAPL, MSFT, VTI, etc.) for uploading and tax-harvest exploration.  
- `demo/strategy_config.json`: the SPY SMA/RSI configuration used in the docs/screenshots.  
- `demo/portfolio.json`: a small multi-asset portfolio for PM walkthroughs and tax-harvest analysis.

## Research notebook

- `notebooks/strategy_walkthrough.ipynb` drives a parameter sweep (SMA fast/slow grid), renders a Sharpe heatmap, and interrogates one corner (fast=10, slow=200) using the `run_quant_backtest` helper from the backend.

## Testing & continuous integration

- Backend pytest suite (e.g., `backend/app/tests/test_backtest_buy_and_hold_matches_benchmark.py`, `test_backtest_flat_strategy_keeps_equity_constant.py`, `test_drawdown_matches_hand_calculation.py`) validates the equity curve, drawdowns, and benchmark tracking math.  
- Frontend Vitest check in `client/src/services/__tests__/apiClient.test.ts` ensures `resolveApiBase` honors `VITE_API_BASE_URL`.  
- `.github/workflows/ci.yml` installs backend requirements, runs `pytest`, and then installs/builds the React client so every push validates both stacks.  

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
