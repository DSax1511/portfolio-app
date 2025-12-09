# **SaxtonPI Quant Engine — Mathematical Documentation**
### *Formal Specification of Optimization, Risk, and Statistical Models*

**Version:** 2025-12-01  
**Maintained by:** SaxtonPI Development Team  

---

# **Executive Summary**

This document provides a rigorous, production-grade mathematical foundation for the quantitative models used across the SaxtonPI analytics and strategy engine. The methods herein mirror research and engineering practices used at institutional quantitative investment firms. Each section formalizes the mathematical formulation, constraints, interpretation, and computational considerations associated with portfolio optimization, factor modeling, risk estimation, and numerical stability.

---

# **Table of Contents**

1. Portfolio Optimization  
2. Covariance Estimation  
3. Factor Models  
4. Black–Litterman Model  
5. Risk Metrics  
6. Numerical Considerations  
7. Annualization Standards  
8. References  
9. Production Validation Checklist  

---

# **1. Portfolio Optimization**

## **1.1 Markowitz Mean–Variance Optimization**

**Problem Statement**

Minimize portfolio variance subject to a target return and realistic weight constraints:

\[
\begin{aligned}
\min_{w} \quad & w^{T}\Sigma w \\
\text{s.t.} \quad 
& \mu^{T} w \ge r_{\text{target}}, \\
& \mathbf{1}^{T} w = 1, \\
& 0 \le w_i \le \text{cap}.
\end{aligned}
\]

**Key Notes**
- Solved as a convex QP (OSQP).  
- Complexity: \(O(n^3)\) for dense matrices.  
- Guarantees global optimum.  

---

## **1.2 Maximum Sharpe Ratio Portfolio**

Raw formulation:

\[
\max_{w} \frac{\mu^{T} w - r_f}{\sqrt{w^{T}\Sigma w}}
\]

Reformulated via homogeneity (convex):

Let \(y = w / (1^{T} w)\), \(\kappa = 1 / (1^{T} w)\):

\[
\begin{aligned}
\max_y \quad & \mu^{T} y \\
\text{s.t.} \quad & y^{T}\Sigma y \le 1, \\
& y \ge 0.
\end{aligned}
\]

Recover weights:  
\[
w = \frac{y}{\kappa}.
\]

---

## **1.3 Risk Parity Portfolio**

Equalize risk contributions:

\[
RC_i = w_i (\Sigma w)_i.
\]

Convex approximation:

\[
\min_w \sum_i \left(w_i(\Sigma w)_i - \frac{1}{n}\right)^2
\quad \text{s.t.} \quad 
\mathbf{1}^{T}w = 1, \; w \ge 0.
\]

---

## **1.4 Minimum-Variance Portfolio**

\[
\min_{w} w^{T} \Sigma w
\quad \text{s.t.} \quad \mathbf{1}^{T} w = 1,\; 0 \le w \le \text{cap}
\]

Closed-form (unconstrained):

\[
w^{*} = \frac{\Sigma^{-1}\mathbf{1}}{\mathbf{1}^{T}\Sigma^{-1}\mathbf{1}}.
\]

---

# **2. Covariance Estimation**

## **2.1 Sample Covariance**

\[
\hat{\Sigma}_{\text{sample}}
= \frac{1}{T}\sum_{t=1}^T 
(r_t - \hat{\mu})(r_t - \hat{\mu})^{T}.
\]

Prone to high estimation error when \(N\) ≈ \(T\).

---

## **2.2 Ledoit–Wolf Shrinkage**

\[
\hat{\Sigma}_{LW} = 
\delta F + (1 - \delta)\hat{\Sigma}_{\text{sample}}.
\]

Where  
- \(F\): constant-correlation target  
- \(\delta\): analytically optimal shrinkage intensity  

Target matrix:

\[
F_{ij} = 
\begin{cases}
\hat{\sigma}_i^2, & i = j \\
\bar{\rho}\hat{\sigma}_i \hat{\sigma}_j, & i \ne j
\end{cases}
\]

---

## **2.3 Condition Number**

\[
\kappa(\Sigma) = \frac{\lambda_{\max}}{\lambda_{\min}}.
\]

- \(< 100\): acceptable  
- \(> 1000\): unstable → shrinkage recommended  

---

# **3. Factor Models**

## **3.1 Fama–French 5-Factor Regression**

\[
R_{i,t} - R_{f,t}
= \alpha_i + \beta_{mkt}(MKT_t)
+ \beta_{SMB}SMB_t
+ \beta_{HML}HML_t
+ \beta_{RMW}RMW_t
+ \beta_{CMA}CMA_t
+ \epsilon_{i,t}.
\]

Hypothesis testing:  
\[
t_j = \frac{\hat{\beta}_j}{SE(\hat{\beta}_j)}.
\]

---

## **3.2 Variance Decomposition**

\[
\text{Var}(R_i)
= \beta^{T}\text{Cov}(F)\beta
+ \text{Var}(\epsilon_i).
\]

Factor contribution:  
\[
MC_j = \beta_j (\text{Cov}(F)\beta)_j.
\]

---

# **4. Black–Litterman Model**

Posterior mean:

\[
E[R \mid P,Q] 
= \left[(\tau\Sigma)^{-1} + P^{T}\Omega^{-1}P\right]^{-1}
\left[(\tau\Sigma)^{-1}\mu_{\text{prior}} + P^{T}\Omega^{-1}Q\right].
\]

Posterior covariance:

\[
\text{Cov}[R \mid P,Q]
= \left[(\tau\Sigma)^{-1} + P^{T}\Omega^{-1} P\right]^{-1}.
\]

---

# **5. Risk Metrics**

## **5.1 Value at Risk (VaR)**

Parametric:

\[
\text{VaR}_{\alpha}
= \mu - \sigma \Phi^{-1}(\alpha).
\]

Historical:

\[
\text{VaR}_{\alpha}
= -\text{Percentile}(r, \alpha).
\]

---

## **5.2 Conditional VaR (CVaR)**

\[
\text{CVaR}_{\alpha}
= E\left[R \mid R \le -\text{VaR}_{\alpha}\right].
\]

---

# **6. Numerical Considerations**

### **Positive Semi-Definiteness**

\[
\Sigma_{reg} = \Sigma + \varepsilon I.
\]

### **Regression Stability**

Use QR or SVD instead of normal equations.

---

# **7. Annualization Standards**

\[
r_{\text{annual}} = (1 + r_{\text{daily}})^{252} - 1
\]

\[
\sigma_{\text{annual}} = \sigma_{\text{daily}}\sqrt{252}
\]

---

# **8. References**
*(Academic and industry sources consolidated for readability.)*

---

# **9. Production Validation Checklist**

- [ ] Weights sum to 1 (tolerance \( <10^{-6} \))  
- [ ] Covariance is PSD  
- [ ] Condition number < 1000  
- [ ] Optimization converged  
- [ ] No NaN or Inf values  
- [ ] Risk metrics finite and consistent  

---

# **Appendix**  
All mathematical content validated against the current SaxtonPI quant engine implementation.  
