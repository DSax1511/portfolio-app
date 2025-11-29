# Portfolio Quant App

Thin React client over a modular FastAPI quant engine. Run locally with Python/Node, or via Docker Compose.

## Prerequisites
- Python 3.11+ (for backend)
- Node 18+ (for frontend)
- Docker & Docker Compose (optional, for containers)

## Quick start (local, two terminals)
1) Backend
```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # or use your env manager
pip install --upgrade pip
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

2) Frontend
```bash
cd client
npm install
# optional: echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev -- --host --port 5173
```

Visit http://localhost:5173 (frontend) and http://localhost:8000/docs (backend).

## Docker Compose
```bash
docker compose up --build
```
- Backend: http://localhost:8000
- Frontend: http://localhost:3000
- Compose passes `VITE_API_BASE_URL=http://backend:8000` to the frontend build.

## Key environment variables
- `FRONTEND_ORIGINS` (backend): comma-separated list of allowed CORS origins. Defaults to localhost dev ports.
- `VITE_API_BASE_URL` (frontend): API base URL; defaults to same-origin. In dev, set to `http://localhost:8000`.
- `DATA_CACHE_DIR`, `RUNS_DIR` (backend): optional paths for cached prices and run logs; default under `backend/app/`.

## Running tests
Backend tests (fast, synthetic data):
```bash
cd backend
python -m pytest backend/tests backend/app/tests
```

## Project layout
- `backend/app/` — FastAPI app (analytics, backtests, optimizers, rebalance, dashboard), data caching, config, infra.
- `backend/tests/`, `backend/app/tests/` — pytest suites (metrics, backtests, optimizers, rebalance).
- `client/` — React/Vite UI; API calls in `src/api.ts`; main UI in `src/App.jsx`.
- `docker-compose.yml` — builds backend + frontend; frontend served via nginx.

## Common issues
- Docker build errors about disk/overlay: free space with `docker system prune -af` (removes unused images/containers) and retry `docker compose build --no-cache`.
- CORS: set `FRONTEND_ORIGINS` to include your frontend origin(s) if not using defaults.
