import { useState } from "react";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const MathEnginePage = () => {
  const [activeTab, setActiveTab] = useState("overview");

  // Calculation formulas extracted from mathematical documentation
  const calculations = {
    optimization: [
      {
        name: "Markowitz Mean-Variance",
        description: "Quadratic programming to minimize portfolio variance",
        formula: "minimize w^T Σ w subject to μ^T w ≥ r_target, 1^T w = 1, 0 ≤ w ≤ cap",
        components: [
          "w ∈ ℝⁿ: Portfolio weights vector",
          "Σ ∈ ℝⁿˣⁿ: Covariance matrix of returns",
          "μ ∈ ℝⁿ: Expected returns vector",
          "r_target: Target portfolio return",
          "cap: Maximum weight per asset (concentration limit)"
        ],
        solver: "CVXPY with OSQP",
        complexity: "O(n³) for dense matrices, O(n²) for sparse"
      },
      {
        name: "Maximum Sharpe Ratio",
        description: "Reformulated as convex problem via substitution",
        formula: "maximize μ^T y subject to y^T Σ y ≤ 1, 1^T y = κ, y ≥ 0",
        components: [
          "y = w / (1^T w): Normalized weights",
          "κ = 1 / (1^T w): Scaling factor",
          "Recover weights: w = y / κ"
        ],
        solver: "CVXPY with Clarabel"
      },
      {
        name: "Risk Parity",
        description: "Equal risk contribution from each asset",
        formula: "minimize Σ_i (w_i (Σw)_i - 1/n)² subject to 1^T w = 1, w ≥ 0",
        components: [
          "(Σw)ᵢ: Marginal risk contribution of asset i",
          "w_i (Σw)ᵢ: Component risk contribution of asset i",
          "Target: RC_i = w_i * (Σw)_i = constant for all i"
        ],
        implementation: "optimizers_v2.py:risk_parity_weights_cvxpy()"
      },
      {
        name: "Minimum Variance Portfolio",
        description: "Minimize portfolio variance subject to constraints",
        formula: "minimize w^T Σ w subject to 1^T w = 1, 0 ≤ w ≤ cap",
        analyticalSolution: "w* = Σ⁻¹ 1 / (1^T Σ⁻¹ 1) [unconstrained]",
        implementation: "optimizers_v2.py:min_variance_weights_cvxpy()"
      }
    ],
    covariance: [
      {
        name: "Sample Covariance",
        description: "Baseline estimator - unbiased but high variance",
        formula: "Σ̂_sample = (1/T) Σ_{t=1}^T (r_t - μ̂)(r_t - μ̂)^T",
        properties: [
          "Unbiased: E[Σ̂_sample] = Σ",
          "High variance when N is large relative to T",
          "Can be ill-conditioned (large condition number)"
        ]
      },
      {
        name: "Ledoit-Wolf Shrinkage",
        description: "Reduces estimation error and guarantees positive definiteness",
        formula: "Σ̂_LW = δ * F + (1 - δ) * Σ̂_sample",
        components: [
          "F: Shrinkage target (constant correlation model)",
          "δ ∈ [0, 1]: Shrinkage intensity (analytically optimal)",
          "F_ij = σ̂_i² if i=j, ρ̄ * σ̂_i * σ̂_j if i≠j"
        ],
        shrinkageTarget: "δ* = argmin E[||Σ̂_LW - Σ||²_F] computed analytically",
        useCases: [
          "N > 30 assets",
          "T < 10 * N observations",
          "High-frequency rebalancing"
        ],
        implementation: "covariance_estimation.py:ledoit_wolf_shrinkage()"
      },
      {
        name: "Condition Number",
        description: "Measure of numerical stability",
        formula: "κ(Σ) = λ_max / λ_min",
        interpretation: [
          "κ < 10: Well-conditioned",
          "κ < 100: Acceptable",
          "κ < 1000: Ill-conditioned (use shrinkage!)",
          "κ > 1000: Severely ill-conditioned"
        ],
        impact: "High κ → small eigenvalues → numerical instability in optimization"
      }
    ],
    factorModels: [
      {
        name: "Fama-French 5-Factor Model",
        description: "Multi-factor regression for risk attribution",
        formula: "R_{i,t} - R_{f,t} = α_i + β_mkt(R_m,t - R_f,t) + β_smb SMB_t + β_hml HML_t + β_rmw RMW_t + β_cma CMA_t + ε_{i,t}",
        factors: [
          "Mkt-RF: Market excess return (systematic risk, ~market beta)",
          "SMB: Small Minus Big (size premium, ~2-3% annualized)",
          "HML: High Minus Low (value premium, ~3-4% annualized)",
          "RMW: Robust Minus Weak (profitability premium, ~2-3%)",
          "CMA: Conservative Minus Aggressive (investment premium, ~2-3%)"
        ],
        interpretation: [
          "α (alpha): Excess return not explained by factors",
          "β (beta): Factor loading (sensitivity to factor)",
          "t-statistic: t_j = β̂_j / SE(β̂_j) for hypothesis testing"
        ],
        implementation: "factor_models.py:fama_french_5factor_regression()"
      },
      {
        name: "Variance Decomposition",
        description: "Break down portfolio variance into factor vs idiosyncratic",
        formula: "Var(R_i) = Σ_j Σ_k β_ij β_ik Cov(F_j, F_k) + Var(ε_i) = Factor Variance + Idio Variance",
        components: [
          "MC_j = β_j * (Cov(F) @ β)_j: Marginal contribution of factor j",
          "CC_j = w_j * MC_j: Component contribution",
          "% Factor Risk = (Factor Variance / Total Variance) * 100"
        ],
        implementation: "factor_models.py:portfolio_factor_decomposition()"
      }
    ],
    blackLitterman: [
      {
        name: "Black-Litterman Model",
        description: "Combines prior returns with investor views",
        posteriorReturns: "E[R | P, Q] = [(τΣ)⁻¹ + P^T Ω⁻¹ P]⁻¹ [(τΣ)⁻¹ μ_prior + P^T Ω⁻¹ Q]",
        posteriorCovariance: "Cov[R | P, Q] = [(τΣ)⁻¹ + P^T Ω⁻¹ P]⁻¹",
        parameters: [
          "μ_prior: Prior expected returns (equilibrium or historical)",
          "Σ: Covariance matrix",
          "τ: Uncertainty in prior (typically 0.01 - 0.05)",
          "P: Pick matrix (views on assets or portfolios)",
          "Q: View vector (expected returns per views)",
          "Ω: Diagonal matrix of view uncertainties (confidence)"
        ],
        example: "View: AAPL returns 15% next year → P=[1,0,0,...], Q=[0.15], Ω=[0.02²]",
        implementation: "optimizers_v2.py:black_litterman()"
      }
    ],
    riskMetrics: [
      {
        name: "Value at Risk (VaR)",
        description: "Percentile-based loss metric",
        parametricVaR: "VaR_α = μ - σ * Φ⁻¹(α)",
        historicalVaR: "VaR_α = -Percentile(returns, α * 100)",
        components: [
          "α: Confidence level (e.g., 0.05 for 95% VaR)",
          "Φ⁻¹: Inverse standard normal CDF",
          "μ, σ: Portfolio mean and std dev"
        ]
      },
      {
        name: "Conditional Value at Risk (CVaR)",
        description: "Expected loss given that loss exceeds VaR (coherent)",
        formula: "CVaR_α = E[R | R ≤ -VaR_α]",
        properties: [
          "Coherent risk measure (unlike VaR)",
          "Convex → can be used in optimization",
          "Accounts for tail risk beyond VaR"
        ]
      }
    ],
    annualization: [
      {
        name: "Returns Annualization",
        daily2annual: "r_annual = (1 + r_daily)^252 - 1",
        continuouslyCompounded: "r_annual = r_daily * 252"
      },
      {
        name: "Volatility Annualization",
        daily2annual: "σ_annual = σ_daily * √252"
      },
      {
        name: "Covariance Annualization",
        daily2annual: "Σ_annual = Σ_daily * 252"
      },
      {
        name: "Sharpe Ratio Annualization",
        formula: "Sharpe_annual = (μ_annual - r_f) / σ_annual = Sharpe_daily * √252"
      }
    ]
  };

  const renderCalculations = () => {
    let items = [];
    switch (activeTab) {
      case "optimization":
        items = calculations.optimization;
        break;
      case "covariance":
        items = calculations.covariance;
        break;
      case "factorModels":
        items = calculations.factorModels;
        break;
      case "blackLitterman":
        items = calculations.blackLitterman;
        break;
      case "riskMetrics":
        items = calculations.riskMetrics;
        break;
      case "annualization":
        items = calculations.annualization;
        break;
      default:
        items = [];
    }

    return (
      <div className="space-y-4">
        {items.map((item, idx) => (
          <Card key={idx} className="bg-slate-900/40 border border-slate-800">
            <div>
              <h3 className="font-semibold text-slate-100 text-lg">{item.name}</h3>
              {item.description && (
                <p className="text-sm text-slate-400 mt-2">{item.description}</p>
              )}

              {item.formula && (
                <div className="mt-3 p-3 bg-slate-950 rounded border border-slate-700">
                  <p className="font-mono text-xs text-amber-300">{item.formula}</p>
                </div>
              )}

              {item.daily2annual && (
                <div className="mt-3 p-3 bg-slate-950 rounded border border-slate-700">
                  <p className="font-mono text-xs text-amber-300">{item.daily2annual}</p>
                </div>
              )}

              {item.continuouslyCompounded && (
                <div className="mt-2 p-3 bg-slate-950 rounded border border-slate-700">
                  <p className="font-mono text-xs text-amber-300">{item.continuouslyCompounded}</p>
                </div>
              )}

              {item.posteriorReturns && (
                <>
                  <div className="mt-3 p-3 bg-slate-950 rounded border border-slate-700">
                    <p className="text-xs text-slate-300 mb-1">Posterior Expected Returns:</p>
                    <p className="font-mono text-xs text-amber-300">{item.posteriorReturns}</p>
                  </div>
                  <div className="mt-2 p-3 bg-slate-950 rounded border border-slate-700">
                    <p className="text-xs text-slate-300 mb-1">Posterior Covariance:</p>
                    <p className="font-mono text-xs text-amber-300">{item.posteriorCovariance}</p>
                  </div>
                </>
              )}

              {item.parametricVaR && (
                <>
                  <div className="mt-3 p-3 bg-slate-950 rounded border border-slate-700">
                    <p className="text-xs text-slate-300 mb-1">Parametric VaR (Normal):</p>
                    <p className="font-mono text-xs text-amber-300">{item.parametricVaR}</p>
                  </div>
                  <div className="mt-2 p-3 bg-slate-950 rounded border border-slate-700">
                    <p className="text-xs text-slate-300 mb-1">Historical VaR:</p>
                    <p className="font-mono text-xs text-amber-300">{item.historicalVaR}</p>
                  </div>
                </>
              )}

              {item.components && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-300">Components:</p>
                  <ul className="mt-2 space-y-1">
                    {item.components.map((comp, i) => (
                      <li key={i} className="text-xs text-slate-400">
                        • <span className="font-mono text-amber-300">{comp}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.properties && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-300">Properties:</p>
                  <ul className="mt-2 space-y-1">
                    {item.properties.map((prop, i) => (
                      <li key={i} className="text-xs text-slate-400">
                        • {prop}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.factors && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-300">Factors:</p>
                  <ul className="mt-2 space-y-1">
                    {item.factors.map((factor, i) => (
                      <li key={i} className="text-xs text-slate-400">
                        • {factor}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.interpretation && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-300">Interpretation:</p>
                  <ul className="mt-2 space-y-1">
                    {item.interpretation.map((interp, i) => (
                      <li key={i} className="text-xs text-slate-400">
                        • {interp}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.useCases && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-slate-300">Use Cases:</p>
                  <ul className="mt-2 space-y-1">
                    {item.useCases.map((useCase, i) => (
                      <li key={i} className="text-xs text-slate-400">
                        • {useCase}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {item.impact && (
                <div className="mt-3 p-2 bg-slate-950/50 rounded">
                  <p className="text-xs text-slate-300">
                    <span className="font-semibold">Impact:</span> {item.impact}
                  </p>
                </div>
              )}

              {item.shrinkageTarget && (
                <div className="mt-3 p-3 bg-slate-950 rounded border border-slate-700">
                  <p className="text-xs text-slate-300 mb-1">Optimal Shrinkage (Ledoit & Wolf, 2004):</p>
                  <p className="font-mono text-xs text-amber-300">{item.shrinkageTarget}</p>
                </div>
              )}

              {item.analyticalSolution && (
                <div className="mt-3 p-3 bg-slate-950 rounded border border-slate-700">
                  <p className="text-xs text-slate-300 mb-1">Analytical Solution [unconstrained]:</p>
                  <p className="font-mono text-xs text-amber-300">{item.analyticalSolution}</p>
                </div>
              )}

              {item.example && (
                <div className="mt-3 p-2 bg-slate-950/50 rounded border border-slate-700">
                  <p className="text-xs text-slate-300">
                    <span className="font-semibold">Example:</span> {item.example}
                  </p>
                </div>
              )}

              {item.implementation && (
                <div className="mt-3">
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold">Implementation:</span>{" "}
                    <span className="font-mono text-blue-400">{item.implementation}</span>
                  </p>
                </div>
              )}

              {item.solver && (
                <div className="mt-3">
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold">Solver:</span> {item.solver}
                  </p>
                </div>
              )}

              {item.complexity && (
                <div className="mt-1">
                  <p className="text-xs text-slate-400">
                    <span className="font-semibold">Complexity:</span> {item.complexity}
                  </p>
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    );
  };

  return (
    <PageShell
      title="Mathematical Engine"
      subtitle="Under the hood, SaxtonPI is powered by a portfolio analytics engine written in Python using NumPy and Pandas."
    >
      <div className="page-layout" style={{ gap: "1.25rem" }}>
        {/* Tabs Navigation */}
        <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-2 text-sm font-medium transition ${
              activeTab === "overview"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("calculations")}
            className={`px-3 py-2 text-sm font-medium transition ${
              activeTab === "calculations"
                ? "text-amber-400 border-b-2 border-amber-400"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Calculations
          </button>
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            <Card className="bg-slate-900/60 border border-slate-800">
              <div>
                <p className="label-sm">Overview</p>
                <h2 className="section-title">Mathematical Engine Overview</h2>
                <p className="muted" style={{ marginTop: "12px" }}>
                  Under the hood, SaxtonPI is powered by a portfolio analytics engine written in Python using NumPy and Pandas. For any set of assets and weights, the backend:
                </p>
                <ul className="simple-list" style={{ marginTop: "12px" }}>
                  <li>Builds daily return series from price data and annualizes them.</li>
                  <li>Estimates the full covariance and correlation matrices of returns.</li>
                  <li>Derives portfolio-level risk statistics such as volatility, drawdowns, and diversification measures.</li>
                </ul>
                <p className="muted" style={{ marginTop: "12px" }}>
                  These calculations are exposed through a FastAPI-powered "Portfolio Quant API" that the frontend calls in real time, so every chart and widget is backed by the same consistent math.
                </p>
              </div>
            </Card>

            <div>
              <div className="section-header">
                <div>
                  <p className="label-sm">Core analytics</p>
                  <h2 className="section-title">Portfolio Risk & Diversification Analytics</h2>
                </div>
              </div>
              <Card>
                <p className="muted">
                  Given a matrix of historical returns, SaxtonPI:
                </p>
                <ul className="simple-list" style={{ marginTop: "12px" }}>
                  <li>
                    Constructs the annualized covariance matrix <span style={{ fontStyle: "italic" }}>Σ</span>.
                  </li>
                  <li>
                    Computes portfolio variance as <span style={{ fontStyle: "italic" }}>w<sup>⊤</sup>Σw</span>, where{" "}
                    <span style={{ fontStyle: "italic" }}>w</span> is the vector of portfolio weights.
                  </li>
                  <li>
                    Derives portfolio volatility as <span style={{ fontStyle: "italic" }}>√(w<sup>⊤</sup>Σw)</span>.
                  </li>
                  <li>Exposes both the covariance and correlation matrices for inspection.</li>
                </ul>
                <p className="muted" style={{ marginTop: "16px" }}>
                  To understand where risk actually comes from, the engine decomposes total variance into asset-level contributions using:
                </p>
                <ul className="simple-list" style={{ marginTop: "12px" }}>
                  <li>
                    <span className="font-semibold text-slate-100">Marginal contribution of asset i:</span> the i-th element of{" "}
                    <span style={{ fontStyle: "italic" }}>Σw</span>.
                  </li>
                  <li>
                    <span className="font-semibold text-slate-100">Component contribution of asset i:</span>{" "}
                    <span style={{ fontStyle: "italic" }}>w<sub>i</sub>(Σw)<sub>i</sub></span>.
                  </li>
                </ul>
                <p className="muted" style={{ marginTop: "16px" }}>
                  From these, SaxtonPI reports percentage contributions to risk, highlighting which positions dominate portfolio volatility. It also computes diversification metrics, such as a diversification ratio based on the relationship between individual asset volatilities and overall portfolio volatility.
                </p>
              </Card>
            </div>

            <div>
              <div className="section-header">
                <div>
                  <p className="label-sm">Factor models</p>
                  <h2 className="section-title">Factor Modeling & Regression</h2>
                </div>
              </div>
              <Card>
                <p className="muted">
                  SaxtonPI includes a factor-model layer that maps raw tickers to predefined factor proxies (e.g., growth, value, or other styles) and computes factor return series from their price histories.
                </p>
                <p className="muted" style={{ marginTop: "12px" }}>
                  For a given portfolio, the backend:
                </p>
                <ul className="simple-list" style={{ marginTop: "12px" }}>
                  <li>Runs a time-series regression of portfolio returns on factor returns.</li>
                  <li>
                    Estimates factor loadings (betas), alpha (intercept), and goodness-of-fit statistics such as{" "}
                    <span style={{ fontStyle: "italic" }}>R²</span>.
                  </li>
                  <li>
                    Tracks residuals and residual volatility, making it clear how much risk is explained by the factor model versus idiosyncratic.
                  </li>
                </ul>
                <p className="muted" style={{ marginTop: "16px" }}>
                  The result is a factor exposure report that quantifies how sensitive the portfolio is to each underlying driver.
                </p>
              </Card>
            </div>

            <div>
              <div className="section-header">
                <div>
                  <p className="label-sm">Optimization</p>
                  <h2 className="section-title">Portfolio Optimization: Risk Parity, Minimum Variance, Black–Litterman</h2>
                </div>
              </div>
              <Card>
                <p className="muted">
                  On top of the risk engine, SaxtonPI implements several classic portfolio construction techniques:
                </p>
                <div className="flex flex-col gap-4" style={{ marginTop: "16px" }}>
                  <div>
                    <p className="font-semibold text-slate-100">Risk Parity</p>
                    <ul className="simple-list" style={{ marginTop: "8px" }}>
                      <li>
                        Searches for weights <span style={{ fontStyle: "italic" }}>w</span> such that each component{" "}
                        <span style={{ fontStyle: "italic" }}>w<sub>i</sub>(Σw)<sub>i</sub></span> contributes roughly equally to total variance.
                      </li>
                      <li>Highlights when risk is concentrated in a few names versus spread across the book.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100">Minimum-Variance Portfolio</p>
                    <ul className="simple-list" style={{ marginTop: "8px" }}>
                      <li>
                        Uses the estimated covariance matrix to minimize <span style={{ fontStyle: "italic" }}>w<sup>⊤</sup>Σw</span> subject to constraints (e.g., non-negativity, max position caps, fully invested).
                      </li>
                      <li>Produces tightly controlled, low-volatility portfolios.</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-100">Black–Litterman Allocation</p>
                    <ul className="simple-list" style={{ marginTop: "8px" }}>
                      <li>Combines implied equilibrium returns with user-specified views.</li>
                      <li>
                        Takes annualized mean returns and the covariance matrix, applies a Black–Litterman update, and outputs a posterior return vector and candidate allocation.
                      </li>
                    </ul>
                  </div>
                </div>
                <p className="muted" style={{ marginTop: "16px" }}>
                  These optimizers run directly off historical returns and feed into an optimizer summary endpoint that returns the different allocations side by side.
                </p>
              </Card>
            </div>

            <div>
              <div className="section-header">
                <div>
                  <p className="label-sm">Strategy research</p>
                  <h2 className="section-title">Rule-Based Strategy & Backtesting Framework</h2>
                </div>
              </div>
              <Card>
                <p className="muted">
                  SaxtonPI also includes a rule-based backtesting engine for tactical strategies. The backend:
                </p>
                <ul className="simple-list" style={{ marginTop: "12px" }}>
                  <li>
                    Computes technical indicators such as:
                    <ul className="simple-list" style={{ marginTop: "8px", marginLeft: "16px" }}>
                      <li>Moving averages / exponential moving averages</li>
                      <li>Band-style indicators (e.g., Bollinger-style ranges)</li>
                      <li>Rate of change</li>
                      <li>Realized volatility</li>
                    </ul>
                  </li>
                  <li style={{ marginTop: "8px" }}>
                    Defines strategies via pluggable rule sets, e.g.:
                    <ul className="simple-list" style={{ marginTop: "8px", marginLeft: "16px" }}>
                      <li>"Go long when short-term MA crosses above long-term MA and realized volatility is below a threshold."</li>
                    </ul>
                  </li>
                  <li style={{ marginTop: "8px" }}>
                    Applies risk controls such as stop-loss and take-profit rules.
                  </li>
                  <li>
                    Simulates position changes through time, producing an equity curve and performance summary (returns, volatility, drawdowns).
                  </li>
                </ul>
              </Card>
            </div>

            <div>
              <div className="section-header">
                <div>
                  <p className="label-sm">Data infrastructure</p>
                  <h2 className="section-title">Data Handling, Resampling & Return Construction</h2>
                </div>
              </div>
              <Card>
                <p className="muted">
                  All analytics start from clean, consistent return streams. SaxtonPI:
                </p>
                <ul className="simple-list" style={{ marginTop: "12px" }}>
                  <li>Pulls historical price data and converts it into daily returns.</li>
                  <li>
                    Resamples to other horizons (weekly, monthly, etc.) using compound returns{" "}
                    <span style={{ fontStyle: "italic" }}>(1+r₁)(1+r₂)⋯(1+rₙ)−1</span>.
                  </li>
                  <li>
                    Annualizes volatility and covariance using standard market conventions (e.g. scaling by{" "}
                    <span style={{ fontStyle: "italic" }}>√252</span> for daily data).
                  </li>
                  <li>
                    Includes caching and fallback logic for price histories and factor series so analytics remain robust even when external data vendors are slow or temporarily unavailable.
                  </li>
                </ul>
              </Card>
            </div>
          </>
        )}

        {/* Calculations Tab */}
        {activeTab === "calculations" && (
          <>
            {/* Calculation Subtabs */}
            <div className="flex flex-wrap gap-2 bg-slate-950 rounded p-2 border border-slate-800">
              {[
                { key: "optimization", label: "Optimization" },
                { key: "covariance", label: "Covariance" },
                { key: "factorModels", label: "Factor Models" },
                { key: "blackLitterman", label: "Black-Litterman" },
                { key: "riskMetrics", label: "Risk Metrics" },
                { key: "annualization", label: "Annualization" }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(`calculations-${tab.key}`)}
                  className={`px-2 py-1 text-xs font-medium rounded transition ${
                    activeTab === `calculations-${tab.key}`
                      ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      : "text-slate-400 hover:text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Render selected calculation subtab */}
            {activeTab.startsWith("calculations-") && (
              <>
                {(() => {
                  const subTab = activeTab.replace("calculations-", "");
                  if (subTab === "optimization")
                    return renderCalculations();
                  if (subTab === "covariance") {
                    setActiveTab("covariance");
                    return renderCalculations();
                  }
                  if (subTab === "factorModels") {
                    setActiveTab("factorModels");
                    return renderCalculations();
                  }
                  if (subTab === "blackLitterman") {
                    setActiveTab("blackLitterman");
                    return renderCalculations();
                  }
                  if (subTab === "riskMetrics") {
                    setActiveTab("riskMetrics");
                    return renderCalculations();
                  }
                  if (subTab === "annualization") {
                    setActiveTab("annualization");
                    return renderCalculations();
                  }
                })()}
              </>
            )}

            {/* Default show optimization if calculations tab selected but no subtab */}
            {activeTab === "calculations" && (
              <>
                <p className="text-slate-400 text-center py-8">Select a calculation category above to view formulas</p>
              </>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
};

export default MathEnginePage;
