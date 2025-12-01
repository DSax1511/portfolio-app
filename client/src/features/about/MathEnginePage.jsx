import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const MathEnginePage = () => {
  return (
    <PageShell
      title="Mathematical Engine"
      subtitle="Under the hood, SaxtonPI is powered by a portfolio analytics engine written in Python using NumPy and Pandas."
    >
      <div className="page-layout" style={{ gap: "1.25rem" }}>
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
      </div>
    </PageShell>
  );
};

export default MathEnginePage;
