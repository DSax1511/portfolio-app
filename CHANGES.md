# Post-Deployment Changes

## Last Updated: December 1, 2025

---

## Recent Fixes

### Tailwind CSS Removal (Dec 1)
- Removed `tailwindcss`, `postcss`, `autoprefixer` from package.json
- Deleted `tailwind.config.js`
- Reverted `postcss.config.cjs` to empty config
- Removed `@tailwind` directives from `src/index.css`
- **Reason:** PostCSS syntax error breaking Vercel deployment; reverted to original plain CSS approach

---

## Project Architecture

### Frontend (`/client`)
- **Framework:** React 19 + Vite
- **Styling:** Plain CSS (no frameworks)
- **Key Pages:**
  - Overview: snapshot, equity curve, metrics
  - Positions: holdings, exposures, weights
  - Analytics: performance stats, backtests, stress tests
  - Strategy: quant strategy selection and configuration

### Backend (`/backend`)
- **Framework:** FastAPI with Pydantic
- **Structure:**
  - `/api/v1/` - REST endpoints (overview, positions, analytics, backtests, optimizers)
  - `/services/` - Business logic and analytics
  - `/schemas/` - Request/response types
  - `/core/` - Config and exceptions

### Key Features
- Real-time portfolio metrics (Sharpe, Sortino, drawdowns)
- Walk-forward backtesting with transaction costs
- Portfolio optimization with constraints
- Factor attribution analysis
- Risk decomposition
- CSV portfolio upload

---

## Critical Fixes (Historical)

1. **Synthetic Data Fallback** - Removed fake data generation; now returns explicit errors
2. **Lookahead Bias** - Implemented walk-forward validation for backtests
3. **Transaction Costs** - Added cost term to optimizer objective function

---

## Deployment

- **Frontend:** Vercel
- **Backend:** Render or Docker
- **Docker Compose:** Available for local development
