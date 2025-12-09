# **Portfolio Risk Measurement & Guardrails**

**Methods, Assumptions, and Practical Considerations**

**Authors**: Saxton PI Quantitative Research Team
**Date**: December 2025
**Version**: 1.0

---

## **1. Executive Summary**

This document provides a comprehensive overview of risk measurement and control methodologies implemented in the SaxtonPI/SaxtonAlgo quantitative analytics platform. We detail the mathematical foundations, distributional assumptions, and practical limitations of risk metrics used for portfolio construction and monitoring. The methods range from classical parametric approaches (Sharpe ratio, volatility, VaR) to robust non-parametric techniques (historical VaR, bootstrap resampling) and higher-moment adjustments (Cornish-Fisher expansion). We discuss the trade-offs between computational efficiency, statistical accuracy, and interpretability for portfolio managers. Risk controls include volatility targeting, regime-dependent position sizing, and drawdown-aware allocation adjustments. The document concludes with recommendations for enhancing risk models through extreme value theory (EVT), GARCH-based conditional volatility, and stress testing frameworks. This work is intended for quantitative researchers, portfolio managers, and risk officers evaluating systematic investment strategies.

---

## **2. Risk Measures Implemented in SaxtonAlgo/SaxtonPI**

### **2.1 Volatility and Downside Deviation**

#### **2.1.1 Annualized Volatility**

**Definition**:
\[
\sigma_{\text{annual}} = \sqrt{252} \times \sigma_{\text{daily}},
\]
where \(\sigma_{\text{daily}}\) is the standard deviation of daily returns, and 252 is the approximate number of trading days per year.

**Calculation** (Sample Estimator):
\[
\hat{\sigma}_{\text{daily}} = \sqrt{\frac{1}{T-1}\sum_{t=1}^T (r_t - \bar{r})^2},
\]
where \(r_t\) is the return at time \(t\), \(\bar{r}\) is the mean return, and \(T\) is the number of observations.

**Assumptions**:
- Returns are independently and identically distributed (i.i.d.).
- Constant volatility (homoskedasticity).
- No serial correlation in returns.

**Violations**:
- **Volatility clustering**: Empirical returns exhibit GARCH effects (high volatility follows high volatility). Sample standard deviation underestimates risk during calm periods and overestimates during crises.
- **Fat tails**: Return distribution has higher kurtosis than normal; realized extreme losses exceed predictions based on \(\sigma\).

**Usage**: Volatility is the primary input to mean-variance optimization, Sharpe ratio calculation, and volatility targeting.

#### **2.1.2 Downside Deviation**

**Definition**:
\[
\sigma_{\text{downside}} = \sqrt{\frac{1}{T_{\text{down}}}\sum_{t: r_t < \tau} (r_t - \tau)^2},
\]
where \(\tau\) is the threshold (typically 0% or risk-free rate), and \(T_{\text{down}}\) is the number of observations below \(\tau\).

**Rationale**: Investors care more about downside volatility than upside volatility. Downside deviation penalizes only negative deviations from threshold.

**Assumptions**:
- Threshold \(\tau\) is economically meaningful (e.g., 0% for absolute loss aversion, \(r_f\) for relative loss aversion).
- Returns below threshold are more relevant for risk assessment than returns above threshold.

**Limitations**:
- Sensitive to threshold choice: \(\tau = 0\%\) vs \(\tau = r_f\) can yield different rankings.
- Sample size for downside observations may be small (20–30% of total sample), leading to high estimation error.

**Usage**: Input to Sortino ratio (see Section 2.2.2).

---

### **2.2 Sharpe and Sortino Ratios**

#### **2.2.1 Sharpe Ratio**

**Definition**:
\[
\text{Sharpe} = \frac{\bar{r}_p - r_f}{\sigma_p},
\]
where \(\bar{r}_p\) is the mean portfolio return, \(r_f\) is the risk-free rate, and \(\sigma_p\) is the portfolio standard deviation.

**Interpretation**: Risk-adjusted return per unit of total volatility. Higher Sharpe indicates better risk-adjusted performance.

**Statistical Significance**:
\[
t_{\text{Sharpe}} = \text{Sharpe} \times \sqrt{T},
\]
where \(T\) is the number of observations. For \(t > 2\) (p < 0.05), Sharpe is statistically significant.

**Assumptions**:
- Returns are normally distributed (or distribution is fully characterized by mean and variance).
- Investors are mean-variance optimizers (quadratic utility).
- No serial correlation in returns.

**Violations**:
- **Fat tails**: Normal distribution underestimates tail risk; Sharpe ratio overestimates risk-adjusted returns in presence of negative skewness and excess kurtosis.
- **Serial correlation**: Positive autocorrelation inflates Sharpe; overlapping return periods (e.g., 12-month momentum) violate i.i.d. assumption.

**Limitations**:
- Treats upside and downside volatility symmetrically; penalizes strategies with high upside volatility.
- Not robust to outliers; single extreme return can distort Sharpe.

**Usage**: Primary metric for strategy selection and comparison in SaxtonPI backtesting module.

#### **2.2.2 Sortino Ratio**

**Definition**:
\[
\text{Sortino} = \frac{\bar{r}_p - \tau}{\sigma_{\text{downside}}},
\]
where \(\tau\) is the threshold (typically 0% or \(r_f\)).

**Interpretation**: Risk-adjusted return per unit of downside risk. Preferred by investors with loss aversion.

**Advantages**:
- Distinguishes upside and downside volatility.
- More intuitive for risk-averse investors.

**Limitations**:
- Sensitive to threshold choice.
- Estimation error higher than Sharpe due to smaller sample size for downside deviations.

**Usage**: Secondary metric for strategy evaluation; particularly useful for asymmetric strategies (options, tail hedging).

---

### **2.3 Maximum Drawdown and Drawdown Distributions**

#### **2.3.1 Maximum Drawdown (MaxDD)**

**Definition**:
\[
\text{MaxDD} = \max_{t \in [0,T]} \left( \frac{P_{\max}^{[0,t]} - P_t}{P_{\max}^{[0,t]}} \right),
\]
where \(P_t\) is the portfolio value at time \(t\), and \(P_{\max}^{[0,t]}\) is the running maximum portfolio value from inception to \(t\).

**Interpretation**: Largest peak-to-trough decline in portfolio value. Measures worst-case realized loss.

**Calculation** (Algorithmic):
1. Compute running maximum: \(M_t = \max(P_0, P_1, \ldots, P_t)\).
2. Compute drawdown series: \(DD_t = (M_t - P_t) / M_t\).
3. Maximum drawdown: \(\text{MaxDD} = \max(DD_t)\).

**Properties**:
- Path-dependent: MaxDD depends on entire return sequence, not just distribution.
- Increases with time horizon: longer backtests exhibit larger MaxDD.
- Asymmetric: MaxDD is always non-negative; no "maximum drawup" analog.

**Limitations**:
- Single statistic; does not capture frequency or duration of drawdowns.
- Sensitive to sample period; different start/end dates yield different MaxDD.
- No probabilistic interpretation; cannot compute confidence intervals without bootstrap.

**Usage**: Key risk metric for strategy evaluation. Strategies with MaxDD >25% (unlevered) or >40% (levered) flagged as high-risk.

#### **2.3.2 Drawdown Duration**

**Definition**: Number of periods from peak to recovery (i.e., return to prior peak).

**Calculation**:
1. Identify peak: \(t^* = \arg\max_{t \le t'} P_t\).
2. Identify trough: \(t_{\text{trough}} = \arg\min_{t^* \le t \le t_{\text{recovery}}} P_t\).
3. Identify recovery: \(t_{\text{recovery}} = \min\{t > t_{\text{trough}} : P_t \ge P_{t^*}\}\).
4. Duration: \(\Delta t = t_{\text{recovery}} - t^*\).

**Interpretation**: Time required to recover from drawdown. Long durations indicate persistent underperformance.

**Empirical Observations** (SaxtonPI Strategies):
- Typical drawdown duration: 3–12 months for momentum strategies.
- Crisis drawdowns (2008, 2020): 12–24 months recovery.

**Usage**: Monitor drawdown duration for strategy viability; >24 months may indicate structural break.

#### **2.3.3 Average Drawdown**

**Definition**: Mean of all drawdown magnitudes over sample period.

\[
\text{AvgDD} = \frac{1}{T}\sum_{t=1}^T DD_t.
\]

**Interpretation**: Expected magnitude of drawdown at any given time. Provides central tendency of loss distribution.

**Usage**: Complement to MaxDD; strategies with high MaxDD but low AvgDD are exposed to rare tail events.

---

### **2.4 Value at Risk (VaR) and Conditional VaR (CVaR)**

#### **2.4.1 Parametric VaR**

**Definition**:
\[
\text{VaR}_{\alpha} = \mu - \sigma \Phi^{-1}(\alpha),
\]
where \(\mu\) is the mean return, \(\sigma\) is the standard deviation, \(\Phi^{-1}\) is the inverse normal CDF, and \(\alpha\) is the confidence level (e.g., 0.05 for 95% VaR).

**Interpretation**: Maximum expected loss over a given time horizon at confidence level \(\alpha\). Example: 95% daily VaR = -2.5% means losses exceed 2.5% on 5% of days.

**Assumptions**:
- Returns are normally distributed.
- Constant mean and variance (i.i.d. returns).

**Violations**:
- **Fat tails**: Normal distribution underestimates tail risk; realized losses exceed VaR more frequently than predicted (e.g., 10% of days vs 5%).
- **Volatility clustering**: Constant \(\sigma\) assumption violated; VaR underestimates risk during high-vol regimes.

**Advantages**:
- Fast computation.
- Interpretable for risk managers.

**Limitations**:
- Fails to capture tail risk beyond \(\alpha\) quantile.
- Not subadditive (VaR of portfolio can exceed sum of VaRs of components).

**Usage**: Regulatory compliance (Basel III); daily risk monitoring.

#### **2.4.2 Historical VaR**

**Definition**:
\[
\text{VaR}_{\alpha} = -\text{Percentile}(r, \alpha),
\]
where returns \(r\) are empirical historical returns.

**Interpretation**: Empirical \(\alpha\)-quantile of return distribution. Non-parametric; makes no distributional assumptions.

**Advantages**:
- Captures true distribution (including fat tails, skewness).
- No model risk (no assumptions about distribution).

**Limitations**:
- Requires large sample size (>250 observations for stable 5% VaR estimate).
- Backward-looking; does not adapt to regime shifts.
- Sensitive to outliers; single extreme event can distort VaR.

**Usage**: Complement to parametric VaR; compare estimates to assess normality assumption.

#### **2.4.3 Cornish-Fisher VaR**

**Definition**:
\[
\text{VaR}_{\text{CF}} = \mu + \sigma \left[ z_\alpha + \frac{\gamma_1}{6}(z_\alpha^2 - 1) + \frac{\gamma_2}{24}(z_\alpha^3 - 3z_\alpha) - \frac{\gamma_1^2}{36}(2z_\alpha^3 - 5z_\alpha) \right],
\]
where \(\gamma_1\) is skewness, \(\gamma_2\) is excess kurtosis, and \(z_\alpha = \Phi^{-1}(\alpha)\).

**Interpretation**: Adjusts parametric VaR for higher moments (skewness, kurtosis). Accounts for non-normality.

**Advantages**:
- More accurate than parametric VaR for fat-tailed distributions.
- Computationally efficient (closed-form).

**Limitations**:
- Assumes skewness and kurtosis are time-invariant.
- Can produce nonsensical results for extreme parameter values (e.g., very high kurtosis).
- Not subadditive.

**Usage**: Enhanced VaR estimate for strategies with known negative skewness (e.g., selling options, carry trades).

#### **2.4.4 Conditional VaR (CVaR / Expected Shortfall)**

**Definition**:
\[
\text{CVaR}_{\alpha} = E[R \mid R \le -\text{VaR}_{\alpha}],
\]
i.e., expected loss conditional on loss exceeding VaR.

**Interpretation**: Average loss in worst \(\alpha \times 100\%\) of cases. Example: 95% CVaR = -3.5% means average loss in worst 5% of days is 3.5%.

**Advantages**:
- **Coherent risk measure**: satisfies subadditivity, monotonicity, positive homogeneity, translation invariance.
- Captures tail risk beyond VaR.
- Preferred by regulators and academics over VaR.

**Calculation** (Historical):
\[
\text{CVaR}_{\alpha} = -\frac{1}{T_{\alpha}}\sum_{t: r_t \le -\text{VaR}_{\alpha}} r_t,
\]
where \(T_{\alpha}\) is the number of observations in the tail.

**Limitations**:
- Requires larger sample size than VaR for stable estimates.
- More sensitive to outliers.

**Usage**: Primary tail risk metric in SaxtonPI risk analytics module. Reported at 95% and 99% confidence levels.

---

### **2.5 Additional Risk Metrics**

#### **2.5.1 Calmar Ratio**

**Definition**:
\[
\text{Calmar} = \frac{\text{CAGR}}{\text{MaxDD}}.
\]

**Interpretation**: Reward per unit of worst-case loss. Higher values indicate better risk-adjusted returns.

**Usage**: Preferred by CTA and hedge fund managers; emphasizes drawdown control over volatility.

#### **2.5.2 Omega Ratio**

**Definition**:
\[
\Omega(\tau) = \frac{\int_{\tau}^{\infty} [1 - F(r)] dr}{\int_{-\infty}^{\tau} F(r) dr},
\]
where \(F(r)\) is the cumulative distribution function of returns, and \(\tau\) is the threshold (typically 0%).

**Interpretation**: Ratio of probability-weighted gains to losses relative to threshold. Incorporates all moments of return distribution.

**Advantages**:
- Distribution-free; captures skewness, kurtosis, and tail risk.
- Economically intuitive.

**Limitations**:
- Computationally intensive.
- Sensitive to threshold choice.

**Usage**: Evaluated for strategies with asymmetric payoffs (options, tail hedging).

---

## **3. Analytical Methods**

### **3.1 Parametric vs Non-Parametric Approaches**

| Feature                  | Parametric (Normal)              | Non-Parametric (Historical)       |
|--------------------------|----------------------------------|-----------------------------------|
| **Assumptions**          | Normal distribution, i.i.d.      | No distributional assumptions     |
| **Advantages**           | Fast, interpretable, robust to small samples | Captures true distribution, no model risk |
| **Limitations**          | Underestimates tail risk         | Requires large sample, backward-looking |
| **Best Use Case**        | Daily risk monitoring, optimization | Stress testing, fat-tailed strategies |

**Recommendation**: Use parametric methods for rapid calculation; validate with non-parametric methods. If parametric VaR significantly differs from historical VaR (>20%), apply Cornish-Fisher adjustment or investigate distributional violations.

---

### **3.2 Long-Memory Considerations**

**Empirical Observation**: Asset returns exhibit long-memory (long-range dependence) in:
- **Volatility**: GARCH effects; volatility clusters persist for weeks to months.
- **Trading volume**: Autocorrelation in volume up to 50 lags.
- **Realized variance**: Fractional integration (d ≈ 0.4–0.5).

**Implications**:
- **Volatility forecasting**: Short-term (1-day) volatility better predicted by GARCH than rolling historical.
- **Risk measurement**: Sample variance underestimates long-run risk if estimated over short windows.

**Mitigation**:
- Use exponential weighting for covariance estimation (see Section 3.3.3).
- GARCH(1,1) for conditional volatility forecasts (see Section 6.2).
- Extend VaR horizon to multi-day (e.g., 10-day VaR for regulatory compliance).

---

### **3.3 Serial Correlation in Returns**

**Sources of Serial Correlation**:
1. **Bid-ask bounce**: Intraday prices oscillate between bid and ask; induces negative autocorrelation at high frequency.
2. **Non-synchronous trading**: Illiquid assets price with lag; induces positive autocorrelation.
3. **Momentum**: Persistent trends (1–12 months) induce positive autocorrelation.
4. **Mean reversion**: Long-term (3–5 years) negative autocorrelation.

**Impact on Risk Measurement**:
- **Positive autocorrelation**: Underestimates multi-period volatility. Correction:
  \[
  \sigma_{T\text{-day}} = \sqrt{T \times (1 + 2\sum_{k=1}^{T-1}(1 - k/T)\rho_k)} \times \sigma_{\text{1-day}},
  \]
  where \(\rho_k\) is the autocorrelation at lag \(k\).
- **Negative autocorrelation**: Overestimates multi-period volatility.

**Testing**:
- Ljung-Box test for serial correlation.
- ACF/PACF plots.

**Usage**: Adjust volatility estimates for momentum strategies (positive autocorrelation) and mean-reversion strategies (negative autocorrelation).

---

## **4. Model Limitations**

### **4.1 Distribution Assumptions**

**Stylized Facts of Return Distributions**:
1. **Fat tails**: Excess kurtosis (typically 3–10 vs 0 for normal).
2. **Negative skewness**: Asymmetry; large negative returns more frequent than large positive.
3. **Volatility clustering**: GARCH effects; high volatility persists.
4. **Time-varying correlation**: Correlations increase during crises (contagion).

**Parametric Model Violations**:
- **Normal distribution**: Underestimates VaR and CVaR by 20–50% in tail events.
- **Constant volatility**: Sample \(\sigma\) averaged over calm and crisis periods; underestimates risk in crises.

**Robustness Checks**:
- Compare parametric vs historical VaR/CVaR; if difference >20%, distribution is non-normal.
- Jarque-Bera test for normality.
- Shapiro-Wilk test for small samples.

---

### **4.2 Tail Risk Misestimation**

**Problem**: Parametric models assume thin-tailed distributions; underestimate probability and magnitude of extreme losses.

**Evidence**:
- 2008 GFC: SPY daily returns -9% (6σ event under normality; probability \(10^{-9}\)).
- 2020 March 12: SPY -12% (8σ event; probability \(10^{-15}\)).
- Empirical frequency of 5σ+ events: ~1 per 10 years (vs 1 per 3.5 million days under normality).

**Mitigation**:
- **Cornish-Fisher VaR**: Adjust for skewness and kurtosis (implemented in SaxtonPI).
- **EVT**: Model tail with Generalized Pareto Distribution (future work; see Section 6.3).
- **Stress Testing**: Simulate portfolio under historical crisis scenarios (implemented; see Section 5.1).

---

### **4.3 Volatility Clustering**

**GARCH Effects**: Returns exhibit periods of high and low volatility. Sample standard deviation averages over these regimes; underestimates risk during crises.

**Empirical Evidence**:
- Autocorrelation in squared returns: \(\rho(r_t^2, r_{t-1}^2) \approx 0.1\text{–}0.3\) for equities.
- GARCH(1,1) captures 80–90% of volatility predictability.

**Impact on Risk Models**:
- VaR underestimates risk during high-vol regimes (e.g., 2020 March).
- Volatility targeting with static \(\sigma\) lags regime shifts by 60 days (rolling window).

**Mitigation**:
- GARCH(1,1) for conditional volatility forecasts (future work; see Section 6.2).
- Exponential weighting for covariance (60-day halflife; implemented in SaxtonPI).

---

## **5. Risk Controls in Practice**

### **5.1 Volatility Targeting**

**Mechanism**: Scale portfolio leverage to maintain constant ex-ante volatility.

\[
L_t = \frac{\sigma_{\text{target}}}{\hat{\sigma}_t}, \quad w_t^{\text{scaled}} = L_t \cdot w_t^{\text{base}}.
\]

**Implementation** (SaxtonPI):
- **Target Vol**: 10% annualized (adjustable via API parameter).
- **Volatility Estimate**: Rolling 60-day realized volatility (default) or GARCH(1,1) forecast (optional).
- **Rebalance Frequency**: Monthly or when realized vol deviates >20% from target.
- **Leverage Cap**: 2x for momentum/carry strategies, 3x for GARCH strategies.
- **Volatility Floor**: 5% annualized to prevent excessive leverage in low-vol regimes.

**Empirical Impact**:
- Sharpe ratio improvement: +10–30% (Moreira & Muir, 2017).
- Drawdown reduction: -20–40% during crisis periods (2008, 2020).

**Limitations**:
- Backward-looking volatility estimate lags regime shifts.
- Rebalancing costs: high turnover during volatile periods.

**Future Enhancements**: GARCH-based conditional volatility (see Section 6.2).

---

### **5.2 Exposure Limits**

**Position Concentration**:
- Maximum weight per asset: 35% (adjustable; default for 10–20 asset portfolios).
- Minimum position size: 2% (avoid excessive fragmentation).

**Sector Exposure**:
- Maximum sector weight: 40% of gross exposure.
- For sector-neutral strategies: net sector exposure <5%.

**Gross Leverage**:
- Long-only: \(\sum w_i \le 1.0\) (no leverage).
- Long/short: \(|\sum w_i^+ + \sum w_i^-| \le 2.0\) (130/30 or 150/50 strategies).

**Implementation**: Enforced in portfolio optimization module (`/backend/app/optimizers_v2.py`) via CVXPY constraints.

---

### **5.3 Regime Scaling**

**Regime Definition** (SaxtonPI Default):
- **Risk-On**: SPY > SMA(200).
- **Risk-Off**: SPY ≤ SMA(200).

**Alternative Regime Indicators**:
- **VIX Terciles**: Low (<15), Mid (15–25), High (>25).
- **HMM**: 2-state Hidden Markov Model (bull/bear) using returns, volatility, correlation.

**Exposure Adjustment**:
- **Risk-Off**: Reduce gross exposure by 50%.
- **High VIX (>25)**: Cap leverage at 1x (no scaling above 1x).
- **Crisis Regime**: Liquidate momentum positions; hold only minimum-variance portfolio.

**Empirical Evidence**:
- Drawdown reduction: 30–50% during 2008, 2020, 2022 crises.
- Cost of false positives: forgone upside (~3% per quarter, 18% of Risk-Off periods).

**Implementation**: Regime filter applied in RT-TSMOM strategy (`/backend/app/strategies/rt_tsmom.py`).

---

### **5.4 Position Sizing Policies**

#### **5.4.1 Equal Weight**

\[
w_i = \frac{1}{N}.
\]

**Advantages**: Simple, no estimation error.

**Limitations**: Ignores risk differences across assets; high-vol assets dominate portfolio risk.

#### **5.4.2 Risk-Based Sizing** (Inverse Volatility)

\[
w_i = \frac{1/\sigma_i}{\sum_j 1/\sigma_j}.
\]

**Advantages**: Equalizes marginal risk contributions.

**Limitations**: Assumes zero correlation; underweights high-return, high-vol assets.

#### **5.4.3 Optimization-Based**

**Mean-Variance**:
\[
\min_w w^T \Sigma w \quad \text{s.t.} \quad \mu^T w \ge r_{\text{target}}, \; \mathbf{1}^T w = 1, \; 0 \le w \le \text{cap}.
\]

**Risk Parity**:
\[
\text{RC}_i = w_i (\Sigma w)_i = \frac{1}{N} w^T \Sigma w.
\]

**Advantages**: Incorporates correlations; maximizes risk-adjusted returns.

**Limitations**: Sensitive to estimation error in \(\mu\) and \(\Sigma\); requires regularization (shrinkage).

**Implementation**: CVXPY-based convex optimization in SaxtonPI (`/backend/app/optimizers_v2.py`).

---

### **5.5 Drawdown-Aware Allocation**

**Conditional Position Sizing**:
- **Drawdown <10%**: Normal sizing (100% of target allocation).
- **Drawdown 10–20%**: Reduce new positions by 25%.
- **Drawdown >20%**: Halt new positions; only rebalance existing holdings.

**Recovery Heuristic**: Resume normal sizing after equity recovers to within 5% of prior peak.

**Rationale**: Prevents "digging deeper" during losing streaks; preserves capital for recovery.

**Status**: Under research validation; not yet implemented in production code.

---

## **6. Recommendations for Further Development**

### **6.1 Extreme Value Theory (EVT)**

**Objective**: Model tail distribution using Generalized Pareto Distribution (GPD).

**Method**:
1. Define threshold \(u\) (e.g., 95th percentile of losses).
2. Fit GPD to exceedances: \(P(X > x \mid X > u)\).
3. Estimate tail VaR and CVaR.

**Advantages**:
- Asymptotically justified for tail modeling.
- More accurate than Cornish-Fisher for extreme quantiles (>99%).

**Challenges**:
- Requires choice of threshold \(u\); results sensitive to threshold.
- Small sample size for tail observations (5% of data for 95% threshold).

**Implementation Plan**: Add EVT module to `/backend/app/quant/risk_analytics.py`; expose via `POST /api/quant/evt-var` endpoint.

---

### **6.2 GARCH-Based Conditional Volatility**

**Objective**: Forecast volatility using GARCH(1,1) instead of rolling historical.

**Model**:
\[
\sigma_t^2 = \omega + \alpha r_{t-1}^2 + \beta \sigma_{t-1}^2.
\]

**Advantages**:
- Forward-looking; adapts quickly to regime shifts.
- Captures volatility clustering.

**Implementation Status**: Basic GARCH volatility targeting implemented in `/backend/app/quant/advanced_strategies.py` (`garch_vol_targeting` function). Not yet integrated into main optimization and portfolio construction pipelines.

**Roadmap**:
1. Integrate GARCH into covariance estimation (`/backend/app/analytics/covariance_estimation.py`).
2. Add multivariate GARCH (DCC-GARCH) for time-varying correlations.
3. Validate via walk-forward testing.

---

### **6.3 Enhanced Stress Testing**

**Current Implementation**: Historical scenarios (2008 GFC, 2020 COVID, 2022 rates) applied via fixed shocks to asset returns.

**Enhancements**:
1. **Reverse Stress Testing**: Identify scenarios that cause portfolio loss >20%; assess plausibility.
2. **Factor-Based Stress Testing**: Shock Fama-French factors (MKT, SMB, HML); propagate to portfolio via factor exposures.
3. **Correlation Breakdown**: Simulate scenarios where diversification fails (all correlations → 1).

**Implementation**: Extend `/backend/app/analytics/analytics.py` (`stress_test` function) to support user-defined factor shocks and correlation scenarios.

---

### **6.4 Bayesian Risk Forecasting**

**Objective**: Incorporate uncertainty quantification into risk estimates.

**Method**:
- Bayesian posterior for \(\mu\) and \(\Sigma\) given historical data.
- Sample from posterior; compute distribution of VaR, Sharpe, MaxDD.
- Report credible intervals (e.g., 90% CI for Sharpe: [0.4, 0.8]).

**Advantages**:
- Accounts for parameter uncertainty.
- More robust to small samples.

**Challenges**:
- Computationally intensive (MCMC or variational inference).
- Prior specification: subjective but influential.

**Implementation**: Research prototype; not prioritized for near-term production.

---

### **6.5 Machine Learning for Risk Prediction**

**Objective**: Forecast volatility, VaR, or drawdowns using ML models (Random Forest, LSTM).

**Features**:
- Lagged returns, volatility, volume.
- Macro indicators: VIX, term spread, credit spread.
- Sentiment: news sentiment scores, Twitter/Reddit activity.

**Advantages**:
- Potential for improved forecasting accuracy.
- Captures non-linear relationships.

**Risks**:
- Overfitting; model drift.
- Lack of interpretability (black box).
- Regulatory challenges (model validation, explainability).

**Validation**: Extensive walk-forward testing with 5+ years OOS; require improvement >10% in VaR accuracy to justify complexity.

**Status**: Exploratory research; not scheduled for production deployment.

---

## **7. Conclusion**

Risk measurement and control are foundational to systematic portfolio management. The SaxtonPI platform implements a comprehensive suite of risk metrics—ranging from classical measures (Sharpe, volatility, MaxDD) to advanced tail risk estimators (CVaR, Cornish-Fisher VaR)—with careful attention to distributional assumptions and practical limitations. Risk controls (volatility targeting, regime scaling, exposure limits) are designed to stabilize returns and mitigate drawdowns during adverse market conditions.

Key findings:

1. **Parametric methods** (normal VaR) are computationally efficient but underestimate tail risk by 20–50% during crises. **Non-parametric methods** (historical VaR, CVaR) are more robust but require large samples.

2. **Cornish-Fisher VaR** provides a practical middle ground, adjusting for skewness and kurtosis with minimal computational cost. Implemented in SaxtonPI and recommended for strategies with asymmetric payoffs.

3. **Volatility targeting** improves Sharpe ratios by 10–30% and reduces drawdowns by 20–40%, but effectiveness depends on forecast accuracy. GARCH-based conditional volatility offers potential improvements over rolling historical estimates.

4. **Regime-aware position sizing** (based on SPY vs SMA200 or HMM classification) reduces maximum drawdowns by 30–50% during crises, with modest cost (~3% forgone upside per quarter from false positives).

5. **Future enhancements**—including EVT for tail modeling, multivariate GARCH for time-varying correlations, and Bayesian risk forecasting—are under active research. These methods promise improved risk measurement but require rigorous validation to justify added complexity.

Risk management is inherently a trade-off between robustness, interpretability, and computational efficiency. The methods implemented in SaxtonPI prioritize **transparency** (no black-box models), **statistical rigor** (walk-forward validation, significance testing), and **practical usability** (fast computation, clear interpretation for portfolio managers). As markets evolve and new risk factors emerge, continuous refinement of risk models remains essential to maintaining systematic strategy performance.

---

## **8. References**

1. **Artzner, P., Delbaen, F., Eber, J. M., & Heath, D.** (1999). Coherent measures of risk. *Mathematical Finance*, 9(3), 203-228.

2. **McNeil, A. J., & Frey, R.** (2000). Estimation of tail-related risk measures for heteroscedastic financial time series: an extreme value approach. *Journal of Empirical Finance*, 7(3-4), 271-300.

3. **Engle, R. F.** (2002). Dynamic conditional correlation: A simple class of multivariate generalized autoregressive conditional heteroskedasticity models. *Journal of Business & Economic Statistics*, 20(3), 339-350.

4. **Moreira, A., & Muir, T.** (2017). Volatility-managed portfolios. *The Journal of Finance*, 72(4), 1611-1644.

5. **Ledoit, O., & Wolf, M.** (2004). Honey, I shrunk the sample covariance matrix. *Journal of Portfolio Management*, 30(4), 110-119.

6. **Cont, R.** (2001). Empirical properties of asset returns: stylized facts and statistical issues. *Quantitative Finance*, 1(2), 223-236.

7. **Rockafellar, R. T., & Uryasev, S.** (2000). Optimization of conditional value-at-risk. *Journal of Risk*, 2, 21-42.

8. **Giot, P., & Laurent, S.** (2003). Value-at-risk for long and short trading positions. *Journal of Applied Econometrics*, 18(6), 641-663.

9. **Christoffersen, P. F.** (1998). Evaluating interval forecasts. *International Economic Review*, 39(4), 841-862.

10. **Brownlees, C., & Gallo, G. M.** (2010). Comparison of volatility measures: a risk management perspective. *Journal of Financial Econometrics*, 8(1), 29-56.

---

## **Appendix A: Risk Metric Calculation Examples**

**Example Portfolio**: 60% SPY, 40% TLT (2010–2025).

| Metric                  | Value     |
|-------------------------|-----------|
| CAGR                    | 8.5%      |
| Annualized Volatility   | 10.2%     |
| Sharpe Ratio            | 0.78      |
| Sortino Ratio           | 1.14      |
| Max Drawdown            | -18.7%    |
| Calmar Ratio            | 0.45      |
| VaR (95%, parametric)   | -1.35%    |
| VaR (95%, historical)   | -1.52%    |
| CVaR (95%, historical)  | -2.28%    |
| Omega Ratio (0%)        | 1.26      |

**Interpretation**: Historical VaR exceeds parametric VaR by 12%, suggesting negative skewness or fat tails. CVaR 50% higher than VaR, indicating substantial tail risk. Sharpe and Sortino ratios both >0.75, indicating strong risk-adjusted performance.

---

## **Appendix B: Code References**

**Risk Analytics Module**: `/backend/app/quant/risk_analytics.py`

**Key Functions**:
- `calculate_var(returns, confidence=0.95, method='parametric')`: Parametric, historical, or Cornish-Fisher VaR.
- `calculate_cvar(returns, confidence=0.95)`: Conditional VaR (Expected Shortfall).
- `calculate_tail_risk_metrics(returns)`: Sortino, Calmar, Omega ratios.
- `pca_decomposition(returns)`: Principal component analysis for risk factor identification.

**Covariance Estimation**: `/backend/app/analytics/covariance_estimation.py`

**Key Functions**:
- `sample_covariance(returns)`: Sample covariance matrix.
- `ledoit_wolf_shrinkage(returns)`: Ledoit-Wolf shrinkage estimator.
- `exponential_covariance(returns, halflife=60)`: Exponentially-weighted covariance.

**Stress Testing**: `/backend/app/analytics/analytics.py`

**Key Functions**:
- `stress_test(portfolio, scenario)`: Apply historical crisis scenario (2008, 2020, 2022) or custom shock.

**API Endpoints**:
- `POST /api/quant/var-cvar`: VaR/CVaR estimation.
- `POST /api/quant/tail-risk`: Tail risk metrics (Sortino, Calmar, Omega).
- `POST /api/stress-test`: Historical stress testing.
- `POST /api/covariance-analysis`: Covariance estimator comparison.

---

**End of Research Note**
