# Production Notes & Design Decisions

## Why React + FastAPI?
- React + Vite delivers the responsive, card-based UI expected from modern quant dashboards, while FastAPI serves typed endpoints with automatic docs and async-friendly patterns.
- Keeping the UI in React lets us reuse components (PageShell, cards, tables, charts) across Portfolio, Quant Lab, and Tax modules without spinning up a second stack.

## Feature-based frontend structure
- Each major area (overview, PM, quant) lives in its own folder with dedicated state, services, and routes, so new modules like Tax Harvest can re-use the same layout without bloating the global scope.
- The `QuantLabStore` centrally caches experiment runs, while `PortfolioAnalyticsProvider` keeps live positions and analytics in sync; both inject into the app shell so pages stay consistent.

## CORS, environment variables, and deployment
- FastAPI respects `BACKEND_CORS_ORIGINS` (comma-separated) and defaults to localhost/Vercel/Render-friendly origins; middleware also allows `https://*.vercel.app`.
- React reads `VITE_API_BASE_URL` (or auto-detects localhost) so the same build runs locally, in Docker Compose, and when the frontend is hosted on Render or Vercel.
- `docker-compose.yml` wires the frontend service to `VITE_API_BASE_URL=http://backend:8000`, while Render deployments rely on env vars for both frontend and backend.

## Known limitations & future extensions
- Currently limited to daily data; intraday extensions would require additional market-data ingestion and a scheduler for live fills.
- The quant engine is single-asset; multi-asset or multi-factor strategies will need a portfolio-level position manager and separate trade blotter.
- Futures/options, fund flows, or pandemic-era regime detection remain future work; integrating `quant_regimes` and `quant_microstructure` is the next frontier.
