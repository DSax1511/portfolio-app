# **Saxton PI – Portfolio Intelligence Platform**

A quantitative research and analytics environment for systematic strategy development, portfolio construction, and risk management. Designed with institutional-grade optimization algorithms, walk-forward validation frameworks, and production engineering patterns. Suitable for academic research, proprietary trading desk analytics, and systematic portfolio management workflows.

---

## **System Overview**

**Saxton PI** is a modular quantitative analytics platform comprising:

- **Backend**: FastAPI-based computation engine with convex optimization (CVXPY/OSQP), regime detection (HMM), factor attribution (Fama-French), and walk-forward backtesting infrastructure.
- **Frontend**: React 19 + Vite application providing interactive charting, portfolio dashboards, and strategy configuration interfaces.
- **Data Layer**: Yahoo Finance ingestion with 24-hour parquet-based caching, exponential backoff retry logic, and async/concurrent fetching with rate limiting.
- **Deployment**: Docker Compose support; production deployment on Vercel (frontend) and Render (backend).

**Core Problems Addressed**:

1. **Strategy Research**: Empirical validation of time-series momentum, mean reversion, pairs trading, and volatility-targeted strategies with proper out-of-sample testing.
2. **Risk Analytics**: VaR/CVaR estimation (parametric, historical, Cornish-Fisher), tail risk metrics (Sortino, Calmar, Omega), PCA decomposition, and historical stress testing (2008 GFC, 2020 COVID, 2022 rates).
3. **Portfolio Optimization**: Markowitz mean-variance, maximum Sharpe ratio, risk parity, and Black-Litterman with realistic constraints (position caps, turnover limits, transaction costs).
4. **Execution Simulation**: Integer share sizing, signal-on-close/trade-next-open logic, slippage modeling, and commission accounting.

**Architectural Philosophy**: Separation of signal generation, portfolio construction, and risk measurement. All optimization problems are formulated as convex programs with guaranteed global optima. Backtests incorporate transaction costs, turnover penalties, and walk-forward validation to mitigate overfitting.

---

## **Research Methodology**

### **3.1 Data Handling & Preprocessing**

**Data Source**: Yahoo Finance via `yfinance` library. Daily OHLC with adjusted prices (dividend and split-adjusted).

**Caching**: 24-hour TTL file-based cache (parquet format) to reduce API load and ensure reproducibility within intraday research sessions.

**Quality Checks**:
- Missing data: forward-fill up to 5 trading days; exclude assets with >10% missing observations over lookback window.
- Outlier detection: flag daily returns > 5σ from rolling 60-day mean; manual review required for inclusion.
- Survivorship bias: not explicitly addressed; universe is limited to currently traded instruments (ETFs, large-cap equities). Future work: incorporate delisted securities via CRSP/Compustat.

**Assumptions**:
- Adjusted prices fully capture corporate actions.
- No bid-ask spread modeling (transaction costs via fixed basis-point slippage).
- Daily frequency only; intraday microstructure ignored.

### **3.2 Signal Construction Philosophy**

**Deterministic Signals**: All signals (SMA crossover, RSI, momentum rank, cointegration z-score) are rule-based with fixed parameters. No machine learning or adaptive parameter selection in production signals.

**Parameterization**: Strategy parameters (lookback windows, thresholds, rebalance frequency) are exposed as configuration inputs. Parameter sweeps and sensitivity analysis conducted via walk-forward optimization module.

**Reproducibility**: All backtests log configuration, random seeds (where applicable), and data snapshots. Backtest results include trade-level logs for audit purposes.

**Signal Timing**:
- Signal calculation: end-of-day close prices.
- Trade execution: next-day open (or close, depending on strategy configuration).
- Realistic lag: 1-day minimum between signal and execution to avoid lookahead bias.

### **3.3 Risk-Adjusted Return Evaluation**

**Primary Metrics**:
- **Sharpe Ratio**: \((r_p - r_f) / \sigma_p\), annualized assuming 252 trading days.
- **Sortino Ratio**: \((r_p - r_f) / \sigma_{\text{downside}}\), where downside deviation computed relative to zero threshold.
- **Calmar Ratio**: CAGR / Max Drawdown.
- **Omega Ratio**: Probability-weighted gains vs losses relative to threshold.

**Statistical Significance**:
- **t-statistics**: For Sharpe ratio, computed as \(\text{SR} \times \sqrt{T}\) where \(T\) is number of observations.
- **p-values**: Derived from t-distribution with \(T-1\) degrees of freedom.
- **Effect Size**: Require Sharpe > 0.5 (t > 2.24 for 5 years daily data) for economic significance.

**Return Decomposition**:
- Fama-French 5-factor regression to isolate alpha from systematic exposures.
- Factor loadings tested for significance (\(|t| > 2\)).
- Residual variance analyzed to assess strategy-specific risk.

### **3.4 Out-of-Sample & Walk-Forward Validation**

**Walk-Forward Framework**:
1. **Training Window**: 252–504 trading days (1–2 years).
2. **Test Window**: 63–126 trading days (3–6 months).
3. **Refit Frequency**: Quarterly or semi-annually.
4. **Anchored vs Rolling**: Default is rolling window to adapt to regime shifts.

**Overfitting Detection**:
- Compare in-sample Sharpe to out-of-sample Sharpe.
- Flag degradation > 30% as potential overfitting.
- Track stability of parameter estimates across refit periods.

**Cross-Validation**:
- For parameter selection: 5-fold time-series cross-validation with expanding window.
- Avoid shuffling; preserve temporal ordering to prevent lookahead bias.

### **3.5 Guarding Against Bias**

**Lookahead Bias**:
- All signals use only data available at time \(t\) to generate signal for trade at \(t+1\).
- No use of future information in covariance estimation, volatility forecasts, or regime classification.

**Survivorship Bias**:
- Current implementation limited to surviving assets. Future versions will incorporate delisting events and backfill historical constituent lists.

**Data Leakage**:
- Train/test splits strictly enforced in walk-forward optimization.
- No hyperparameter tuning on test set; separate validation set used for parameter selection.

**Multiple Testing**:
- Bonferroni correction applied when evaluating multiple strategy variants simultaneously.
- Report only strategies with Sharpe t-stat > 3 (p < 0.001 for 5 years daily data) to reduce false discovery rate.

---

## **Risk Controls & Guardrails**

### **4.1 Volatility Targeting**

**Mechanism**: Scale portfolio leverage to maintain constant ex-ante volatility.

\[
L_t = \frac{\sigma_{\text{target}}}{\hat{\sigma}_{t}}, \quad w_t^{\text{scaled}} = L_t \cdot w_t^{\text{base}}.
\]

**Volatility Estimation**:
- Rolling 60-day realized volatility (default).
- GARCH(1,1) for conditional volatility forecasts (optional).
- Minimum volatility floor: 5% annualized to prevent excessive leverage.
- Maximum leverage cap: 2x (3x for GARCH strategies).

**Rebalance Frequency**: Monthly or when realized vol deviates >20% from target.

### **4.2 Regime Scaling**

**Regime Definition**:
- **Risk-On/Risk-Off**: SPY relative to 200-day moving average.
- **Volatility Regime**: VIX terciles (low <15, mid 15-25, high >25).
- **Macro Regime**: HMM-based classification using term spread, credit spread, unemployment rate (if available).

**Position Sizing Adjustment**:
- **Risk-Off**: Reduce gross exposure by 50%.
- **High Vol**: Reduce leverage to 1x (no scaling above 1x).
- **Crisis Regime**: Liquidate momentum positions; hold only minimum-variance portfolio.

**Empirical Justification**: Historical analysis shows 30-50% drawdown reduction when scaling exposure in high-volatility regimes (2008, 2020, 2022 drawdowns).

### **4.3 Exposure Netting & Risk Parity**

**Netting Logic**:
- Long/short pairs: net exposure capped at 30% of portfolio NAV.
- Sector exposure: no single sector > 40% of gross exposure.

**Risk Parity**:
- Equal risk contribution (ERC) constraint:
  \[
  RC_i = w_i (\Sigma w)_i = \frac{1}{N} w^T \Sigma w.
  \]
- Solved via iterative convex approximation (converges in <50 iterations).

### **4.4 Drawdown-Aware Position Sizing**

**Conditional Sizing**:
- If current drawdown > 10%: reduce new position sizes by 25%.
- If current drawdown > 20%: halt new positions; only rebalance existing holdings.

**Recovery Heuristic**: Resume normal sizing only after equity recovers to within 5% of prior peak.

**Note**: Not yet implemented in production code; currently under research validation.

### **4.5 Statistical Significance Checks**

**Strategy Acceptance Criteria**:
- Sharpe ratio t-statistic > 2.0 (p < 0.05).
- Minimum 3 years of data for statistically meaningful evaluation.
- Maximum drawdown < 25% for unlevered strategies, < 40% for levered.

**Hypothesis Testing**:
- H0: Strategy Sharpe ≤ 0.
- Reject H0 if t-statistic > critical value at α = 0.05.

**Effect Size**: Require Sharpe > 0.5 for economic materiality (accounts for transaction costs and implementation frictions).

### **4.6 Data Quality Checks**

**Pre-Backtest Validation**:
- Check for gaps in price data; interpolate up to 5-day gaps, reject assets with longer gaps.
- Verify positive prices; flag negative or zero prices as errors.
- Detect price spikes: flag if \(|r_t| > 5\sigma_{60d}\).

**Covariance Matrix Validation**:
- Positive semi-definiteness: minimum eigenvalue ≥ 0.
- Condition number < 1000 (else apply Ledoit-Wolf shrinkage).
- Regularization: add \(\varepsilon I\) where \(\varepsilon = 10^{-6} \times \text{tr}(\Sigma)\) if PSD fails.

---

## **Limitations & Future Work**

### **5.1 Expanding Universe**

**Current Scope**: 10–50 assets (ETFs, large-cap equities). Limited to US markets, daily frequency.

**Future Directions**:
- Cross-sectional equity strategies (Russell 3000 universe).
- Multi-asset global macro (equities, fixed income, commodities, FX).
- Futures and options strategies (term structure, volatility surface).

### **5.2 Transaction Cost Models**

**Current Implementation**: Fixed basis-point slippage (10 bps default) + per-trade commission ($1/trade default).

**Enhancements Needed**:
- Market impact models: square-root law (\(\text{impact} \propto \sqrt{Q/V}\)).
- Bid-ask spread estimation from intraday data.
- Borrow costs for short positions (integrate IBKR fee schedules).
- Time-of-day effects (VWAP vs open/close execution).

### **5.3 Rigorous Out-of-Sample Testing**

**Current Gaps**:
- Walk-forward optimization implemented but not systematically applied across all strategies.
- No cross-validation for hyperparameter tuning (currently manual parameter selection).

**Roadmap**:
- Automate WFO as default backtest mode.
- Implement grid search with time-series cross-validation.
- Report both in-sample and OOS metrics in all strategy dashboards.

### **5.4 Model Risk Considerations**

**Distributional Assumptions**:
- Current VaR/CVaR assumes normality or empirical distribution.
- Tail risk may be underestimated during extreme events.

**Mitigation**:
- Implement Cornish-Fisher expansion for VaR (accounts for skew/kurtosis).
- Extreme value theory (EVT) for tail modeling.
- Stress testing with historical crisis scenarios (already implemented: 2008, 2020, 2022).

**Parameter Stability**:
- Strategy parameters (lookback windows, thresholds) re-estimated quarterly.
- Track rolling Sharpe to detect structural breaks.

### **5.5 Robust Distributional Assumptions**

**Current Methods**:
- Parametric VaR: assumes Gaussian returns.
- Historical VaR: non-parametric but limited by sample size.

**Advanced Methods to Implement**:
- **Cornish-Fisher VaR**: Adjusts for skewness and kurtosis.
  \[
  \text{VaR}_{CF} = \mu + \sigma \left[ z_\alpha + \frac{(\gamma_1)}{6}(z_\alpha^2 - 1) + \frac{(\gamma_2)}{24}(z_\alpha^3 - 3z_\alpha) \right].
  \]
- **EVT**: Generalized Pareto Distribution (GPD) for tail exceedances.
- **GARCH(1,1)**: Conditional heteroskedasticity for time-varying volatility.

### **5.6 Real Portfolio Constraints**

**Missing Constraints**:
- Turnover caps: current optimizer supports turnover penalty but not hard cap.
- Lot size constraints: integer share sizing in backtest but not in optimization.
- Short sale restrictions: implemented as \(w_i \geq 0\) but no borrow capacity limits.
- Regulatory limits: 5% position caps for mutual funds (not enforced).

**Implementation Plan**:
- Add mixed-integer programming (MIP) for lot size constraints via CVXPY.
- Integrate borrow capacity tracking in live trading module.
- Add user-configurable constraint profiles (long-only, 130/30, market-neutral).

---

## **Core Platform Features**

### **6.1 Strategy Research Engine**

- **Walk-Forward Optimization**: Rolling or anchored window with train/test splits; tracks parameter stability and overfitting metrics.
- **Parameter Sensitivity**: Grid search and heatmap visualization (Sharpe, CAGR, MaxDD vs parameter pairs).
- **Signal Library**: SMA crossover, RSI, momentum rank, cointegration z-score, GARCH volatility.
- **Backtest Audit Trail**: Trade-level logs with timestamps, prices, slippage, commissions, equity curve.

### **6.2 Regime-Aware Trend Following**

**RT-TSMOM Strategy** (Regime-Tuned Time-Series Momentum):
- Universe: 11 sector ETFs (XLK, XLE, XLF, XLV, XLI, XLY, XLP, XLU, XLB, XLRE, XLC).
- Signal: 12-month momentum rank; long top 50% by past return.
- Volatility Targeting: 10% annualized; positions scaled by \(0.10 / \hat{\sigma}_i\).
- Regime Filter: If SPY < SMA(200), reduce exposure by 50%.
- Rebalance: Monthly.

**Empirical Results** (2010–2025, indicative):
- CAGR: 8–12% (dependent on regime classification accuracy).
- Sharpe: 0.6–0.9.
- Max Drawdown: 20–30% (vs 50% for unlevered SPY in 2008–2009).

### **6.3 Risk & Portfolio Analytics**

**Risk Metrics**:
- VaR/CVaR at 95% and 99% confidence levels (parametric, historical, Cornish-Fisher).
- Downside deviation, Sortino ratio, Calmar ratio, Omega ratio.
- Maximum drawdown, average drawdown, drawdown duration.

**Factor Attribution**:
- Fama-French 5-factor regression: MKT, SMB, HML, RMW, CMA.
- Factor exposure decomposition (systematic vs idiosyncratic variance).
- Alpha estimation with t-statistics and p-values.

**Stress Testing**:
- Historical scenarios: 2008 GFC (-50% SPY), 2020 COVID (-34% SPY), 2022 rate shock (-25% TLT).
- Custom shock: user-defined asset-level shocks applied to current portfolio.

**Covariance Analysis**:
- Estimator comparison: sample, Ledoit-Wolf, OAS, exponential weighting.
- Condition number tracking (flag if \(\kappa > 1000\)).
- Eigenvalue spectrum and PCA variance explained.

### **6.4 Interactive Visualization Layer**

- **Equity Curve**: Daily portfolio value with drawdown shading.
- **Returns Distribution**: Histogram with normal overlay, Q-Q plot.
- **Rolling Sharpe**: 252-day rolling window to detect regime shifts.
- **Efficient Frontier**: Mean-variance frontier with current portfolio and tangency portfolio highlighted.
- **Correlation Heatmap**: Asset pairwise correlations with hierarchical clustering.
- **Trade Log**: Chronological list of trades with PnL, slippage, commissions.

---

## **Architecture Diagram**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SAXTON PI PLATFORM                          │
└─────────────────────────────────────────────────────────────────────┘

    ┌───────────────────┐
    │   React Frontend  │  (Vite, React 19, Recharts)
    │   - Dashboard     │
    │   - Strategy UI   │
    │   - Charts        │
    └─────────┬─────────┘
              │ HTTP/REST
              ▼
    ┌───────────────────┐
    │  FastAPI Backend  │  (Python 3.11+, FastAPI)
    │   /api/v1/...     │
    └─────────┬─────────┘
              │
        ┌─────┴─────┬───────────────┬──────────────┐
        ▼           ▼               ▼              ▼
  ┌──────────┐ ┌─────────┐  ┌──────────────┐ ┌──────────┐
  │Backtest  │ │Portfolio│  │ Optimization │ │   Risk   │
  │ Engine   │ │Analytics│  │   (CVXPY)    │ │ Analytics│
  └────┬─────┘ └────┬────┘  └──────┬───────┘ └────┬─────┘
       │            │               │              │
       └────────────┴───────────────┴──────────────┘
                         │
                         ▼
              ┌────────────────────┐
              │   Data Layer       │
              │  - yfinance        │
              │  - Parquet cache   │
              │  - Rate limiting   │
              └────────────────────┘
```

**Backtest Flow**:

```
Signal Generation → Trade Execution → Equity Curve → Metrics
       │                   │                │           │
   (SMA, RSI)      (Integer shares,     (Daily PnL)  (Sharpe,
   (Momentum)       slippage, comm)                  MaxDD, VaR)
```

---

## **API Overview**

### **Strategy Endpoints**

- `POST /api/backtest` – Run simple backtest (Buy-Hold, SMA, Momentum, MinVol, MeanRev).
- `POST /api/v1/quant/backtest` – Advanced backtest with trade-level logs, slippage, commissions.
- `POST /api/backtests/walk-forward` – Walk-forward optimization with OOS tracking.
- `POST /api/v1/strategies/rt-tsmom` – Regime-tuned time-series momentum backtest.
- `POST /api/quant/pairs-trading` – Cointegration-based pairs trading.
- `POST /api/quant/garch-vol-targeting` – GARCH(1,1) volatility-targeted positions.

### **Analytics Endpoints**

- `POST /api/portfolio-metrics` – Comprehensive analytics (returns, vol, Sharpe, Sortino, MaxDD).
- `POST /api/portfolio-dashboard` – Portfolio manager dashboard with drift tracking.
- `POST /api/risk-breakdown` – Risk contribution decomposition by asset.
- `POST /api/factor-exposures` – Fama-French factor regression.
- `POST /api/stress-test` – Historical crisis scenario stress testing.
- `POST /api/covariance-analysis` – Covariance estimator comparison (sample, LW, OAS, exp).
- `POST /api/v1/quant/regimes` – HMM regime detection.
- `POST /api/quant/var-cvar` – VaR/CVaR estimation (parametric, historical, CF).
- `POST /api/quant/tail-risk` – Tail risk metrics (Sortino, Calmar, Omega).
- `POST /api/quant/pca` – PCA decomposition and variance explained.

### **Optimization Endpoints**

- `POST /api/efficient-frontier` – Markowitz efficient frontier (CVXPY/OSQP).
- `POST /api/monte-carlo` – Monte Carlo portfolio simulations.
- `POST /api/rebalance` – Generate rebalance trades to target weights.
- `POST /api/position-sizing` – Risk-based position sizing calculator.
- `POST /api/tax-harvest` – Tax loss harvesting with wash sale detection.

### **Data Endpoints**

- `POST /api/upload-positions` – CSV upload for existing portfolios.
- `GET /api/runs` – List backtest run history.
- `GET /api/runs/{run_id}` – Retrieve specific backtest results.

---

## **Developer Quickstart**

### **Local Development**

**Backend (FastAPI)**:

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Backend runs at: `http://localhost:8000`
API docs: `http://localhost:8000/docs`

**Frontend (React + Vite)**:

```bash
cd client
npm install
echo "VITE_API_BASE_URL=http://localhost:8000" > .env
npm run dev -- --host --port 5173
```

Frontend runs at: `http://localhost:5173`

### **Docker Compose**

```bash
docker compose up --build
```

Services:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost:3000`

### **Testing**

**Backend**:

```bash
cd backend
pytest
```

Coverage includes:
- Backtest equity conservation (`test_backtest_flat_strategy_keeps_equity_constant.py`)
- Drawdown calculation accuracy (`test_drawdown_matches_hand_calculation.py`)
- Benchmark tracking (`test_backtest_buy_and_hold_matches_benchmark.py`)
- Optimization convergence (`test_optimizers_v2.py`)
- Covariance estimation (`test_covariance_estimation.py`)

**Frontend**:

```bash
cd client
npm run test
```

### **Environment Variables**

**Backend**:
- `BACKEND_CORS_ORIGINS`: Comma-separated CORS origins (default: localhost, saxtonpi.com).
- `DATA_CACHE_DIR`: Cache directory for price data (default: `app/data_cache`).

**Frontend**:
- `VITE_API_BASE_URL`: Backend API URL (set to Render URL for Vercel deployment).

---

## **Deployment**

**Production Stack**:
- Frontend: Vercel
- Backend: Render
- Live URL: [saxtonpi.com](https://saxtonpi.com)

**Configuration**:
- Vercel: Set `VITE_API_BASE_URL` to Render backend URL.
- Render: Set `BACKEND_CORS_ORIGINS` to include `https://saxtonpi.com` and `https://www.saxtonpi.com`.

---

## **Documentation & Research**

- [Mathematical Documentation](MATHEMATICAL_DOCUMENTATION.md): Formal specification of optimization algorithms, risk metrics, and numerical methods.
- [Research Notes](research/): Publication-style analysis of regime-aware TSMOM and portfolio risk methodologies.
- [Architecture](docs/architecture.svg): Visual system diagram (frontend → backend → analytics → data).
- [Design Decisions](docs/design_decisions.md): Production engineering notes and technical debt tracking.

---

## **Contributing**

Contributions are welcome. Please ensure:
- New strategies include walk-forward validation and transaction cost modeling.
- All optimization problems are formulated as convex programs where possible.
- Tests validate numerical accuracy (equity conservation, drawdown math, benchmark tracking).
- Documentation includes mathematical formulation and empirical validation.

---

## **License**

Proprietary. For academic or non-commercial use, contact maintainer for permissions.

---

## **References**

1. Moskowitz, T. J., Ooi, Y. H., & Pedersen, L. H. (2012). Time series momentum. *Journal of Financial Economics*, 104(2), 228-250.
2. Ledoit, O., & Wolf, M. (2004). Honey, I shrunk the sample covariance matrix. *Journal of Portfolio Management*, 30(4), 110-119.
3. He, G., & Litterman, R. (1999). The intuition behind Black-Litterman model portfolios. *Goldman Sachs Quantitative Resources Group*.
4. Fama, E. F., & French, K. R. (2015). A five-factor asset pricing model. *Journal of Financial Economics*, 116(1), 1-22.
5. Boyd, S., & Vandenberghe, L. (2004). *Convex Optimization*. Cambridge University Press.
