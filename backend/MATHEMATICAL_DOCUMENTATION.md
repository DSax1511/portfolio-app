# Mathematical Documentation: SaxtonPI Quant Engine

## Overview

This document provides rigorous mathematical formulations for all quantitative methods implemented in the SaxtonPI backend. These techniques are production-grade implementations used at leading quantitative finance firms.

---

## 1. Portfolio Optimization

### 1.1 Markowitz Mean-Variance Optimization

**Problem Formulation:**

```
minimize    w^T Σ w
subject to  μ^T w ≥ r_target
            1^T w = 1
            0 ≤ w ≤ cap
```

Where:
- **w** ∈ ℝⁿ: Portfolio weights vector
- **Σ** ∈ ℝⁿˣⁿ: Covariance matrix of returns
- **μ** ∈ ℝⁿ: Expected returns vector
- **r_target**: Target portfolio return
- **cap**: Maximum weight per asset (concentration limit)

**Solution Method:**
- Quadratic programming via CVXPY
- Solver: OSQP (Operator Splitting Quadratic Program)
- Complexity: O(n³) for dense matrices, O(n²) for sparse
- Convergence: Guaranteed for convex QP

**Implementation:** `optimizers_v2.py:markowitz_frontier()`

---

### 1.2 Maximum Sharpe Ratio Portfolio

**Problem Formulation:**

The max Sharpe problem is non-convex in its natural form:

```
maximize    (μ^T w - r_f) / √(w^T Σ w)
```

**Reformulation (Convex):**

Via substitution y = w / (1^T w), κ = 1 / (1^T w):

```
maximize    μ^T y
subject to  y^T Σ y ≤ 1
            1^T y = κ
            y ≥ 0
```

Recover weights: **w** = **y** / κ

**Implementation:** Implicitly computed in efficient frontier by finding the point with maximum Sharpe ratio.

---

### 1.3 Risk Parity Optimization

**Objective:**

Equal risk contribution from each asset:

```
RC_i = w_i * (Σw)_i = constant for all i
```

**Convex Approximation:**

```
minimize    Σ_i (w_i (Σw)_i - 1/n)²
subject to  1^T w = 1
            w ≥ 0
```

Where:
- **(Σw)ᵢ**: Marginal risk contribution of asset i
- **w_i (Σw)ᵢ**: Component risk contribution of asset i

**Implementation:** `optimizers_v2.py:risk_parity_weights_cvxpy()`

---

### 1.4 Minimum Variance Portfolio

**Problem Formulation:**

```
minimize    w^T Σ w
subject to  1^T w = 1
            0 ≤ w ≤ cap
```

**Analytical Solution (unconstrained):**

```
w* = Σ⁻¹ 1 / (1^T Σ⁻¹ 1)
```

With box constraints, solved via QP.

**Implementation:** `optimizers_v2.py:min_variance_weights_cvxpy()`

---

## 2. Covariance Estimation

### 2.1 Sample Covariance (Baseline)

**Estimator:**

```
Σ̂_sample = (1/T) Σ_{t=1}^T (r_t - μ̂)(r_t - μ̂)^T
```

**Properties:**
- Unbiased: E[Σ̂_sample] = Σ
- High variance when N is large relative to T
- Can be ill-conditioned (large condition number)

---

### 2.2 Ledoit-Wolf Shrinkage

**Estimator:**

```
Σ̂_LW = δ * F + (1 - δ) * Σ̂_sample
```

Where:
- **F**: Shrinkage target (constant correlation model)
- **δ** ∈ [0, 1]: Shrinkage intensity (analytically optimal)

**Shrinkage Target (Constant Correlation):**

```
F_ij = {
    σ̂_i²                if i = j
    ρ̄ * σ̂_i * σ̂_j      if i ≠ j
}
```

Where ρ̄ is the average pairwise correlation.

**Optimal δ (Ledoit & Wolf, 2004):**

```
δ* = argmin E[||Σ̂_LW - Σ||²_F]
```

Computed analytically from sample statistics.

**Benefits:**
- Reduces estimation error (MSE)
- Guarantees positive definiteness
- Improves out-of-sample portfolio performance

**When to Use:**
- N > 30 assets
- T < 10 * N observations
- High-frequency rebalancing

**Implementation:** `covariance_estimation.py:ledoit_wolf_shrinkage()`

---

### 2.3 Condition Number

**Definition:**

```
κ(Σ) = λ_max / λ_min
```

Where λ_max and λ_min are the largest and smallest eigenvalues.

**Interpretation:**
- κ < 10: Well-conditioned
- κ < 100: Acceptable
- κ < 1000: Ill-conditioned (use shrinkage!)
- κ > 1000: Severely ill-conditioned

**Impact:**
- High κ → small eigenvalues → numerical instability
- Portfolio optimization very sensitive to covariance errors
- Shrinkage reduces condition number significantly

**Implementation:** `covariance_estimation.py:condition_number()`

---

## 3. Factor Models

### 3.1 Fama-French 5-Factor Model

**Regression Model:**

```
R_{i,t} - R_{f,t} = α_i + β_{mkt} (R_{m,t} - R_{f,t}) + β_{smb} SMB_t
                    + β_{hml} HML_t + β_{rmw} RMW_t + β_{cma} CMA_t + ε_{i,t}
```

**Factors:**

1. **Mkt-RF**: Market excess return
   - Systematic risk factor (market beta)
   - Measures exposure to overall market movements

2. **SMB** (Small Minus Big):
   - Size premium
   - Long small-cap, short large-cap
   - Historical premium: ~2-3% annualized

3. **HML** (High Minus Low):
   - Value premium
   - Long high book-to-market, short low book-to-market
   - Historical premium: ~3-4% annualized

4. **RMW** (Robust Minus Weak):
   - Profitability premium
   - Long high operating profitability, short low
   - Historical premium: ~2-3% annualized

5. **CMA** (Conservative Minus Aggressive):
   - Investment premium
   - Long conservative investment, short aggressive
   - Historical premium: ~2-3% annualized

**Interpretation:**

- **α** (alpha): Excess return not explained by factors
  - α > 0: Positive skill (outperformance)
  - α ≈ 0: Returns explained by factor exposure
  - α < 0: Underperformance even after adjusting for risk

- **β** (beta): Factor loading (sensitivity)
  - β > 1: More sensitive than average
  - β = 1: Average sensitivity
  - β < 1: Less sensitive than average

**Hypothesis Tests:**

For each coefficient:
```
H₀: β_j = 0 (no exposure to factor j)
H₁: β_j ≠ 0 (significant exposure)

t-statistic: t_j = β̂_j / SE(β̂_j)
p-value: P(|t| > |t_j|) under t-distribution with T - k - 1 degrees of freedom
```

**Implementation:** `factor_models.py:fama_french_5factor_regression()`

---

### 3.2 Variance Decomposition

**Total Variance:**

```
Var(R_i) = Σ_j Σ_k β_ij β_ik Cov(F_j, F_k) + Var(ε_i)
         = Factor Variance + Idiosyncratic Variance
```

**Factor Contribution:**

Marginal contribution of factor j to portfolio variance:
```
MC_j = β_j * (Cov(F) @ β)_j
```

Component contribution:
```
CC_j = w_j * MC_j
```

**Percentage Contributions:**

```
% Factor Risk = (Factor Variance / Total Variance) * 100
% Idiosyncratic Risk = (Idio Variance / Total Variance) * 100
```

**Implementation:** `factor_models.py:portfolio_factor_decomposition()`

---

## 4. Black-Litterman Model

**Posterior Expected Returns:**

```
E[R | P, Q] = [(τΣ)⁻¹ + P^T Ω⁻¹ P]⁻¹ [(τΣ)⁻¹ μ_prior + P^T Ω⁻¹ Q]
```

**Posterior Covariance:**

```
Cov[R | P, Q] = [(τΣ)⁻¹ + P^T Ω⁻¹ P]⁻¹
```

**Parameters:**

- **μ_prior**: Prior expected returns (from equilibrium or historical)
- **Σ**: Covariance matrix
- **τ**: Scalar indicating uncertainty in prior (typically 0.01 - 0.05)
- **P**: Pick matrix (views on specific assets or portfolios)
  - Absolute views: P is identity matrix rows
  - Relative views: P has +1 and -1 entries
- **Q**: View vector (expected returns according to investor views)
- **Ω**: Diagonal matrix of view uncertainties (confidence)

**Example:**

View: "AAPL will return 15% over the next year"
```
P = [1, 0, 0, ..., 0]  (first asset is AAPL)
Q = [0.15]
Ω = [0.02²]  (2% uncertainty)
```

**Implementation:** `optimizers_v2.py:black_litterman()`

---

## 5. Risk Metrics

### 5.1 Value at Risk (VaR)

**Parametric VaR (Normal Distribution):**

```
VaR_α = μ - σ * Φ⁻¹(α)
```

Where:
- **α**: Confidence level (e.g., 0.05 for 95% VaR)
- **Φ⁻¹**: Inverse standard normal CDF
- **μ**, **σ**: Portfolio mean and std dev

**Historical VaR:**

```
VaR_α = -Percentile(returns, α * 100)
```

### 5.2 Conditional Value at Risk (CVaR) / Expected Shortfall

**Definition:**

```
CVaR_α = E[R | R ≤ -VaR_α]
```

Expected loss given that loss exceeds VaR.

**Properties:**
- Coherent risk measure (unlike VaR)
- Convex → can be used in optimization
- Accounts for tail risk

---

## 6. Numerical Considerations

### 6.1 Positive Semi-Definiteness

**Check:**

```
Σ is PSD ⟺ all eigenvalues λ_i ≥ 0
```

**Fix (if violated):**

```
Σ_reg = Σ + ε * I
```

Where ε = 10⁻⁶ (small regularization).

### 6.2 Ill-Conditioned Matrices

**Problem:** Small eigenvalues → unstable optimization

**Solutions:**
1. Covariance shrinkage (Ledoit-Wolf)
2. Regularization: Σ + ε * I
3. Truncate small eigenvalues
4. Use robust estimators (MCD, OAS)

### 6.3 Numerical Stability in Regression

**Standard OLS:**

```
β = (X^T X)⁻¹ X^T y
```

**More Stable (QR Decomposition):**

```
X = QR
β = R⁻¹ Q^T y
```

**More Stable (SVD):**

```
X = UΣV^T
β = V Σ⁻¹ U^T y
```

---

## 7. Annualization Conventions

### 7.1 Returns

**Daily to Annual:**
```
r_annual = (1 + r_daily)^252 - 1
```

**Continuously Compounded:**
```
r_annual = r_daily * 252
```

### 7.2 Volatility

**Daily to Annual:**
```
σ_annual = σ_daily * √252
```

### 7.3 Covariance

**Daily to Annual:**
```
Σ_annual = Σ_daily * 252
```

### 7.4 Sharpe Ratio

**Annualized:**
```
Sharpe_annual = (μ_annual - r_f) / σ_annual
                = (μ_daily * 252) / (σ_daily * √252)
                = Sharpe_daily * √252
```

---

## 8. References

### Academic Papers

1. **Markowitz, H. (1952)**
   "Portfolio Selection"
   *Journal of Finance*, 7(1), 77-91.

2. **Ledoit, O., & Wolf, M. (2004)**
   "Honey, I Shrunk the Sample Covariance Matrix"
   *Journal of Portfolio Management*, 30(4), 110-119.

3. **Fama, E. F., & French, K. R. (2015)**
   "A Five-Factor Asset Pricing Model"
   *Journal of Financial Economics*, 116(1), 1-22.

4. **Black, F., & Litterman, R. (1992)**
   "Global Portfolio Optimization"
   *Financial Analysts Journal*, 48(5), 28-43.

### Industry Standards

- **CFA Institute**: *Portfolio Management in Practice* (2020)
- **GARP**: *Foundations of Risk Management* (2021)
- **AQR Capital**: White papers on factor investing

### Software Libraries

- **CVXPY**: Diamond & Boyd (2016), convex optimization modeling
- **scikit-learn**: Pedregosa et al. (2011), machine learning tools
- **SciPy**: Virtanen et al. (2020), scientific computing

---

## 9. Production Considerations

### 9.1 When to Use Each Method

| Method | Use Case | Assets | History | Frequency |
|--------|----------|--------|---------|-----------|
| Sample Cov | T >> N | < 20 | > 3 years | Monthly |
| Ledoit-Wolf | High dimension | 20-100 | 1-3 years | Weekly |
| Exponential | Time-varying | Any | > 1 year | Daily |
| Robust (MCD) | Outliers present | < 50 | > 2 years | Any |

### 9.2 Solver Selection

| Solver | Problem Type | Complexity | Accuracy |
|--------|--------------|------------|----------|
| OSQP | QP | Fast | Medium |
| Clarabel | SOCP | Medium | High |
| SCS | Cone | Fast | Medium |
| MOSEK* | All | Slow | Highest |

*Commercial solver (not included)

### 9.3 Validation Checklist

- [ ] Weights sum to 1.0 (within tolerance 10⁻⁶)
- [ ] All weights ≥ 0 (long-only) or within bounds
- [ ] Covariance matrix is PSD (all eigenvalues ≥ -10⁻⁸)
- [ ] Condition number < 1000 (use shrinkage if violated)
- [ ] Optimization converged ("optimal" or "optimal_inaccurate")
- [ ] No NaN or Inf values in outputs
- [ ] Portfolio variance ≥ 0
- [ ] Sharpe ratio is finite

---

**Last Updated:** 2025-11-30
**Maintained By:** SaxtonPI Development Team
