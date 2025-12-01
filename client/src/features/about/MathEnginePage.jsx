import { useState } from "react";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import MathFormulaCard from "../../components/math/MathFormulaCard";

const MathEnginePage = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [activeCategory, setActiveCategory] = useState("optimization");

  // ============================================================================
  // CALCULATIONS DATA - Structured formula configs for all categories
  // ============================================================================

  const CALC_SECTIONS = {
    optimization: [
      {
        title: "Minimum-Variance Portfolio",
        formula: "minimize  w^T Σ w  subject to  1^T w = 1,  w ≥ 0",
        description:
          "Chooses weights that minimize total portfolio variance under fully-invested, long-only constraints.",
        bullets: [
          "Used by the Efficient Frontier view to plot minimum-variance portfolios.",
          "Produces the leftmost point of the efficient frontier (lowest volatility).",
          "Often exhibits extreme concentration in one or two low-volatility assets.",
        ],
        implementation: "optimizers_v2.py:min_variance_weights_cvxpy()",
        solver: "CVXPY with OSQP",
      },
      {
        title: "Maximum Sharpe Ratio Portfolio",
        formula:
          "maximize  μ^T y  subject to  y^T Σ y ≤ 1,  1^T y = κ,  y ≥ 0",
        description:
          "Reformulated as convex problem via substitution. Finds the tangency point of the capital allocation line.",
        bullets: [
          "Balances return and risk to maximize risk-adjusted performance.",
          "Used to initialize the Efficient Frontier at the high-return end.",
          "Solves via change of variables: y = w / (1^T w), then recover w = y / κ.",
        ],
        implementation: "optimizers_v2.py:max_sharpe_weights_cvxpy()",
        solver: "CVXPY with Clarabel",
      },
      {
        title: "Risk Parity Allocation",
        formula:
          "minimize  Σ_i (w_i (Σw)_i - 1/n)²  subject to  1^T w = 1,  w ≥ 0",
        description:
          "Equalizes each asset's contribution to total portfolio variance.",
        bullets: [
          "Each position contributes 1/n of the portfolio's total risk.",
          "Reveals when a few assets dominate risk versus when risk is well-distributed.",
          "Useful for allocating across diversified pools (equities, bonds, alternatives).",
        ],
        implementation: "optimizers_v2.py:risk_parity_weights_cvxpy()",
      },
    ],
    covariance: [
      {
        title: "Return Series Construction",
        formula: "r_t = ln(P_t / P_{t-1})",
        description:
          "Converts daily prices to log-returns, which are approximately additive over time.",
        bullets: [
          "Log-returns avoid negative price issues and allow for statistical normality.",
          "Returns are aligned with portfolio construction and risk metrics throughout SaxtonPI.",
        ],
      },
      {
        title: "Sample Covariance",
        formula: "Σ̂_sample = (1/T) Σ_{t=1}^T (r_t - μ̂)(r_t - μ̂)^T",
        description:
          "Baseline unbiased covariance estimator. High variance when N > T.",
        bullets: [
          "Unbiased: E[Σ̂_sample] = Σ_true",
          "Large N relative to T produces ill-conditioned matrices.",
          "Can be singular or near-singular when T < N.",
        ],
        implementation: "covariance_estimation.py:sample_covariance()",
      },
      {
        title: "Ledoit-Wolf Shrinkage",
        formula: "Σ̂_LW = δ * F + (1 - δ) * Σ̂_sample",
        description:
          "Shrinks sample covariance toward a structured target to reduce estimation error.",
        bullets: [
          "Target F: constant-correlation model (ρ̄ · σ_i · σ_j off-diagonal).",
          "Shrinkage coefficient δ analytically optimized to minimize E[||Σ̂_LW - Σ||²_F].",
          "Recommended for N > 30 assets or T < 10N observations.",
          "Always positive-definite and numerically stable.",
        ],
        implementation: "covariance_estimation.py:ledoit_wolf_shrinkage()",
      },
      {
        title: "Annualized Covariance",
        formula: "Σ_annual = Σ_daily · 252",
        description:
          "Scales daily covariance by trading days per year to match annualized volatility and returns.",
        bullets: [
          "Used in all portfolio construction and risk calculations.",
          "252 is the standard market convention for equity trading days.",
        ],
      },
      {
        title: "Condition Number",
        formula: "κ(Σ) = λ_max / λ_min",
        description:
          "Measures numerical stability of a matrix. High κ → ill-conditioned → unstable optimization.",
        bullets: [
          "κ < 10: Well-conditioned",
          "κ < 100: Acceptable",
          "κ < 1000: Ill-conditioned; consider regularization or shrinkage",
          "κ > 1000: Severely ill-conditioned; shrinkage is essential",
        ],
      },
    ],
    factors: [
      {
        title: "Fama-French 5-Factor Model",
        formula:
          "R_{i,t} - R_f = α + β_mkt(R_m - R_f) + β_smb·SMB + β_hml·HML + β_rmw·RMW + β_cma·CMA + ε_t",
        description:
          "Multi-factor regression decomposing portfolio returns into systematic and idiosyncratic components.",
        bullets: [
          "Market (MKT): Systematic equity risk, ~all beta.",
          "Size (SMB): Small Minus Big premium, small-cap outperformance tendency.",
          "Value (HML): High Minus Low premium, value outperformance tendency.",
          "Profitability (RMW): Robust Minus Weak; profitable firms tend to outperform.",
          "Investment (CMA): Conservative Minus Aggressive; low-investment firms outperform.",
          "α: Unexplained alpha; large α may signal skill or data-fitting.",
        ],
        implementation: "factor_models.py:fama_french_5factor_regression()",
      },
      {
        title: "Factor Variance Decomposition",
        formula:
          "Var(R) = Σ_j β_j (Cov(F))_j β_j^T + Var(ε) = Factor Var + Idio Var",
        description:
          "Breaks down portfolio risk into factor-driven versus idiosyncratic (unexplained) components.",
        bullets: [
          "Shows what fraction of portfolio volatility is explained by known factors.",
          "Used in Risk & Diagnostics to visualize factor risk contribution.",
          "High idiosyncratic risk may signal concentration or unique positioning.",
        ],
        implementation: "factor_models.py:portfolio_factor_decomposition()",
      },
    ],
    blackLitterman: [
      {
        title: "Black-Litterman Model",
        formula:
          "μ_BL = Σ_BL · [ (τΣ)^{-1} μ_prior + P^T Ω^{-1} Q ]",
        description:
          "Combines an equilibrium prior with investor views to produce posterior expected returns.",
        bullets: [
          "μ_prior: Prior return estimates (e.g., market-implied from reverse optimization).",
          "τ: Prior uncertainty (typically 0.01–0.05); lower τ → strong conviction in prior.",
          "P: Pick matrix encoding which assets/factors your views concern.",
          "Q: View vector, your expected returns for the picked positions.",
          "Ω: Diagonal confidence in each view; lower values = higher confidence.",
          "Posterior Σ_BL same as input Σ; only expected returns updated.",
        ],
        implementation: "optimizers_v2.py:black_litterman()",
      },
    ],
    riskMetrics: [
      {
        title: "Portfolio Variance & Volatility",
        formula: "σ_p² = w^T Σ w,    σ_p = √(w^T Σ w)",
        description:
          "Core risk metric used throughout SaxtonPI for performance diagnostics and risk reports.",
        bullets: [
          "Σ: Annualized covariance matrix.",
          "w: Portfolio weights vector.",
          "σ_p: Annualized standard deviation of portfolio returns.",
        ],
      },
      {
        title: "Sharpe Ratio",
        formula: "Sharpe = (μ_p - r_f) / σ_p",
        description:
          "Risk-adjusted return metric: excess return per unit of risk. Higher is better.",
        bullets: [
          "μ_p: Portfolio annualized return.",
          "r_f: Risk-free rate (typically 0 for simplicity in backtest context).",
          "σ_p: Portfolio annualized volatility.",
          "Used in Efficient Frontier and Risk & Diagnostics.",
        ],
      },
      {
        title: "Sortino Ratio",
        formula: "Sortino = (μ_p - r_f) / σ_downside",
        description:
          "Like Sharpe, but penalizes only downside volatility (negative returns).",
        bullets: [
          "σ_downside: Annualized std dev of returns below zero.",
          "Prefers strategies with low downside risk but high upside capture.",
          "Reported in Risk & Diagnostics for balanced view of return quality.",
        ],
      },
      {
        title: "Maximum Drawdown",
        formula: "DD_max = min_t (Eq_t / max_{s ≤ t} Eq_s - 1)",
        description:
          "Largest peak-to-trough decline in portfolio equity curve. Key risk metric.",
        bullets: [
          "Eq_t: Cumulative equity at time t.",
          "Captures worst-case loss an investor would have experienced.",
          "Used in Risk & Diagnostics and stress testing views.",
        ],
      },
      {
        title: "Value at Risk (VaR)",
        formula:
          "Parametric: VaR_α = μ - σ·Φ^{-1}(α)  |  Historical: VaR_α = Percentile(returns, α)",
        description: "Tail risk metric: the α-quantile of the return distribution.",
        bullets: [
          "α: Confidence level; e.g., 0.05 for 95% VaR.",
          "Parametric assumes normality; historical is model-free.",
          "Reported for α = 0.05 (95% confidence) in stress testing.",
        ],
      },
      {
        title: "Conditional Value at Risk (CVaR)",
        formula: "CVaR_α = E[R | R ≤ VaR_α]",
        description:
          "Expected loss given that loss exceeds VaR; coherent risk measure.",
        bullets: [
          "Unlike VaR, CVaR is subadditive and can be optimized directly.",
          "Better captures tail risk when losses exceed VaR threshold.",
          "Convex → can be used in constrained portfolio optimization.",
        ],
      },
    ],
    annualization: [
      {
        title: "Returns Annualization",
        formula: "r_annual = (1 + r_daily)^252 - 1",
        description:
          "Compound daily returns to annualized return assuming 252 trading days.",
        bullets: [
          "Used to convert daily backtest returns to CAGR.",
          "Accounts for compounding effect of daily returns.",
        ],
      },
      {
        title: "Volatility Annualization",
        formula: "σ_annual = σ_daily · √252",
        description: "Scale daily volatility to annual scale.",
        bullets: [
          "Assumes returns are independent and identically distributed.",
          "√252 ≈ 15.87; standard market convention.",
        ],
      },
      {
        title: "Covariance Annualization",
        formula: "Σ_annual = Σ_daily · 252",
        description: "Scale daily covariance to annual scale by multiplying by trading days.",
        bullets: [
          "Used to construct portfolio risk matrices from daily data.",
          "Ensures consistency with annualized return and volatility.",
        ],
      },
      {
        title: "Sharpe Ratio Annualization",
        formula: "Sharpe_annual = Sharpe_daily · √252",
        description: "Convert daily Sharpe to annualized Sharpe.",
        bullets: [
          "Simpler than recalculating from annualized parameters.",
          "Useful for reporting backtests with daily signals.",
        ],
      },
    ],
  };

  // ============================================================================
  // TAB STYLES & CONTROLS
  // ============================================================================

  const TabButton = ({ isActive, onClick, children }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
        isActive
          ? "bg-amber-500/80 text-white shadow-md"
          : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );

  const CategoryButton = ({ isActive, onClick, children }) => (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
        isActive
          ? "bg-amber-500/60 text-white border border-amber-400"
          : "bg-slate-900 text-slate-400 border border-slate-700 hover:border-slate-600 hover:text-slate-300"
      }`}
    >
      {children}
    </button>
  );

  // ============================================================================
  // RENDER SECTIONS
  // ============================================================================

  const renderOverview = () => (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Engine Overview */}
      <Card className="bg-slate-900/60 border border-slate-800">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Overview
          </p>
          <h2 className="text-2xl font-bold text-slate-100 mt-2">
            Mathematical Engine
          </h2>
          <p className="text-slate-300 mt-4">
            SaxtonPI is powered by a quantitative analytics engine written in Python. It computes portfolio risk, optimization, factor attribution, and stress testing—all in real time. Every chart, widget, and recommendation is backed by this same consistent mathematical foundation.
          </p>
        </div>
      </Card>

      {/* Core Analytics */}
      <div>
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Core Analytics
          </p>
          <h3 className="text-xl font-bold text-slate-100 mt-1">
            Portfolio Risk & Diversification
          </h3>
        </div>
        <Card>
          <div className="space-y-4">
            <p className="text-slate-300">
              For any set of assets and historical returns, SaxtonPI:
            </p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Constructs return series:</strong> Converts daily prices to log-returns and annualizes covariance to match market conventions (×252).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Computes risk metrics:</strong> Volatility (σ_p = √w^T Σ w), drawdowns, Sharpe ratio, Sortino ratio, and tail risk (VaR, CVaR).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Decomposes risk:</strong> Shows which positions contribute most to portfolio volatility via marginal and component contribution analysis.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Reports correlation:</strong> Exposes covariance and correlation matrices to detect diversification breaks and regime shifts.
                </span>
              </li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Covariance Estimation */}
      <div>
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Data Quality
          </p>
          <h3 className="text-xl font-bold text-slate-100 mt-1">
            Robust Covariance Estimation
          </h3>
        </div>
        <Card>
          <div className="space-y-4">
            <p className="text-slate-300">
              High-dimensional covariance matrices are notoriously noisy. SaxtonPI applies:
            </p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Ledoit-Wolf shrinkage:</strong> Blends sample covariance with a structured target to reduce estimation error and guarantee positive-definiteness.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Condition number monitoring:</strong> Detects ill-conditioned matrices (κ {'>'} 1000) that would break optimization solvers.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Data validation:</strong> Caches price histories, handles missing data, and falls back gracefully when external vendors are slow.
                </span>
              </li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Optimization */}
      <div>
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Portfolio Construction
          </p>
          <h3 className="text-xl font-bold text-slate-100 mt-1">
            Optimization: Risk Parity, Min Variance, Black–Litterman
          </h3>
        </div>
        <Card>
          <div className="space-y-4">
            <p className="text-slate-300">
              SaxtonPI implements multiple classic portfolio optimization strategies:
            </p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Risk Parity:</strong> Equal risk contribution from each asset; highlights when risk is concentrated.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Minimum Variance:</strong> Minimizes portfolio volatility subject to constraints (long-only, fully invested, position caps).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Black–Litterman:</strong> Blends equilibrium returns with your views to generate posterior allocations with built-in uncertainty estimates.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Maximum Sharpe:</strong> Tangency portfolio maximizing risk-adjusted returns; plotted on the efficient frontier.
                </span>
              </li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Factor Models */}
      <div>
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Risk Attribution
          </p>
          <h3 className="text-xl font-bold text-slate-100 mt-1">
            Factor Models & Regression Analysis
          </h3>
        </div>
        <Card>
          <div className="space-y-4">
            <p className="text-slate-300">
              SaxtonPI decomposes portfolio returns and risks into systematic (factor-driven) versus idiosyncratic (skill-based) components using Fama-French factors:
            </p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Fama-French 5-factor model:</strong> Market, Size, Value, Profitability, and Investment factors.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Factor betas & alpha:</strong> Shows how much of your return is explained by each factor and how much is unexplained (alpha).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Variance decomposition:</strong> Reveals the fraction of risk driven by factors versus unique idiosyncratic positioning.
                </span>
              </li>
            </ul>
          </div>
        </Card>
      </div>

      {/* Data Infrastructure */}
      <div>
        <div className="mb-4">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
            Backend Infrastructure
          </p>
          <h3 className="text-xl font-bold text-slate-100 mt-1">
            Data Handling & API Architecture
          </h3>
        </div>
        <Card>
          <div className="space-y-4">
            <p className="text-slate-300">
              The mathematical engine runs as a FastAPI-powered "Portfolio Quant API" called in real time by the frontend:
            </p>
            <ul className="space-y-2 text-slate-400">
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Data fetching:</strong> Pulls price histories from yfinance concurrently and caches them for subsequent requests.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Analytics pipelining:</strong> Orchestrates covariance, factor, risk, and optimization computations in a single request.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Error handling & fallbacks:</strong> Gracefully handles missing data, extreme correlations, and solver edge cases.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="text-amber-400 font-semibold flex-shrink-0">•</span>
                <span>
                  <strong className="text-slate-100">Rate limiting & performance:</strong> Protects expensive endpoints (optimization, backtesting) with sliding-window rate limits.
                </span>
              </li>
            </ul>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderCalculations = () => (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Category Selection */}
      <div className="space-y-3">
        <p className="text-sm text-slate-400 font-medium">Select a calculation category:</p>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "optimization", label: "Optimization" },
            { key: "covariance", label: "Covariance" },
            { key: "factors", label: "Factor Models" },
            { key: "blackLitterman", label: "Black–Litterman" },
            { key: "riskMetrics", label: "Risk Metrics" },
            { key: "annualization", label: "Annualization" },
          ].map((cat) => (
            <CategoryButton
              key={cat.key}
              isActive={activeCategory === cat.key}
              onClick={() => setActiveCategory(cat.key)}
            >
              {cat.label}
            </CategoryButton>
          ))}
        </div>
      </div>

      {/* Formula Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {CALC_SECTIONS[activeCategory]?.map((item, idx) => (
          <MathFormulaCard
            key={idx}
            title={item.title}
            formula={item.formula}
            description={item.description}
            bullets={item.bullets}
            implementation={item.implementation}
            solver={item.solver}
            complexity={item.complexity}
          />
        ))}
      </div>
    </div>
  );

  return (
    <PageShell
      title="Mathematical Engine"
      subtitle="Quantitative analytics powering SaxtonPI: covariance estimation, optimization, factor models, and risk metrics."
    >
      <div className="space-y-8">
        {/* Main Tab Navigation */}
        <div className="flex gap-3 px-6">
          <TabButton
            isActive={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
          >
            Overview
          </TabButton>
          <TabButton
            isActive={activeTab === "calculations"}
            onClick={() => setActiveTab("calculations")}
          >
            Calculations
          </TabButton>
        </div>

        {/* Tab Content */}
        {activeTab === "overview" && renderOverview()}
        {activeTab === "calculations" && renderCalculations()}
      </div>
    </PageShell>
  );
};

export default MathEnginePage;
