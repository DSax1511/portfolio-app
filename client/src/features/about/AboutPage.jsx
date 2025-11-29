import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const AboutPage = () => {
  return (
    <PageShell
      title="About this Project"
      subtitle="This application is a portfolio analytics and quantitative research tool designed to build, analyze, and stress-test investment strategies."
    >
      <div className="about-container">
        <div className="about-hero">
          <p className="label-sm">Portfolio Intelligence</p>
          <h1 className="page-title">About this Project</h1>
          <p className="page-subtitle muted">
            This application is a portfolio analytics and quantitative research tool designed to build, analyze, and stress-test investment strategies.
          </p>
        </div>

        <div className="about-grid">
          <Card title="What this app does" subtitle="Feature set">
            <ul className="simple-list">
              <li>Upload or define portfolios and view performance, risk, and allocation breakdowns.</li>
              <li>Run portfolio analytics including returns, volatility, drawdowns, Sharpe/Sortino, and hit rates.</li>
              <li>Compare portfolios against benchmarks and analyze rolling stats, beta, and relative performance.</li>
              <li>Construct efficient frontiers and backtests, including strategy builder outputs.</li>
              <li>Perform position sizing and rebalancing simulations with suggested trades.</li>
              <li>Explore Monte Carlo stress tests, scenario shocks, and factor/risk breakdowns.</li>
            </ul>
          </Card>

          <Card title="Why I Built This" subtitle="Personal background">
            <p className="muted">
              I started investing early and grew fascinated by technical analysis, portfolio construction, and market mechanics. The retail tools I used often lacked transparency or flexibility.
            </p>
            <p className="muted">
              Studying computer science pulled me toward fintech, where I could merge engineering with real investment logic. This project bridges those two worlds.
            </p>
            <p className="muted">
              I built it as a tool I rely on for research and portfolio decisions—implementing the quantitative concepts myself instead of relying on opaque platforms.
            </p>
          </Card>
        </div>

        <div className="about-grid">
          <Card title="How it was built" subtitle="Architecture & stack">
            <div className="simple-grid">
              <div>
                <p className="metric-label">Frontend</p>
                <ul className="simple-list">
                  <li>React + Vite (JavaScript) with shared UI primitives and Recharts for visualization.</li>
                  <li>Routing via React Router; feature folders for overview, analytics, and shared components.</li>
                  <li>Dark theme tokens for spacing, typography, and elevations.</li>
                </ul>
              </div>
              <div>
                <p className="metric-label">Backend</p>
                <ul className="simple-list">
                  <li>FastAPI (Python) serving analytics endpoints: metrics, backtests, efficient frontier, benchmarks.</li>
                  <li>Rebalancing and position sizing endpoints under /api/rebalance.</li>
                  <li>Monte Carlo, stress tests, factor exposures, risk breakdowns, and benchmark analytics.</li>
                </ul>
              </div>
              <div>
                <p className="metric-label">Data layer</p>
                <ul className="simple-list">
                  <li>pandas and NumPy for return/volatility calculations and portfolio math.</li>
                  <li>yfinance for market data retrieval inside backend utilities.</li>
                  <li>pydantic models for request/response validation.</li>
                </ul>
              </div>
            </div>
          </Card>

          <Card title="Tools and technologies used" subtitle="Stack summary">
            <div className="simple-grid">
              <div>
                <p className="metric-label">Languages</p>
                <ul className="simple-list">
                  <li>JavaScript (React)</li>
                  <li>Python</li>
                </ul>
              </div>
              <div>
                <p className="metric-label">Frameworks</p>
                <ul className="simple-list">
                  <li>FastAPI</li>
                  <li>React + Vite</li>
                </ul>
              </div>
              <div>
                <p className="metric-label">Libraries</p>
                <ul className="simple-list">
                  <li>pandas, NumPy, yfinance</li>
                  <li>Recharts for charts</li>
                  <li>pytest/hypothesis for testing</li>
                </ul>
              </div>
              <div>
                <p className="metric-label">Infrastructure & Dev</p>
                <ul className="simple-list">
                  <li>Dockerfiles for frontend/backend</li>
                  <li>Uvicorn for serving FastAPI</li>
                </ul>
              </div>
            </div>
          </Card>
        </div>

        <div className="about-grid">
          <Card title="Financial formulas and quantitative methods" subtitle="Implemented concepts">
            <ul className="simple-list">
              <li>Portfolio returns and equity curves (cumulative growth from price/portfolio value series).</li>
              <li>Volatility (standard deviation of returns) with annualization.</li>
              <li>Sharpe ratio and Sortino ratio using risk-free ~0% assumption.</li>
              <li>Drawdowns and max drawdown from equity curves.</li>
              <li>Rolling stats including beta, vol, and Sharpe vs benchmarks.</li>
              <li>Efficient frontier optimization (return/vol trade-off, max Sharpe, min vol points).</li>
              <li>Position sizing (risk-per-trade) and rebalancing suggestions.</li>
              <li>Monte Carlo simulations and stress tests for shock scenarios.</li>
            </ul>
          </Card>

          <Card title="What this project demonstrates" subtitle="Skills and outcomes">
            <ul className="simple-list">
              <li>End-to-end design and implementation of a full-stack quant web application.</li>
              <li>Practical portfolio analytics, risk metrics, optimization, and scenario tooling.</li>
              <li>Translating finance concepts into code and a usable interface.</li>
              <li>Designing workflows that investors and PMs can realistically use.</li>
            </ul>
          </Card>
        </div>

        <Card title="How to use this app" subtitle="Suggested workflow">
          <ol className="simple-list">
            <li>Upload a portfolio CSV or load the demo portfolio.</li>
            <li>Review Overview for KPIs, sector exposure, and positions.</li>
            <li>Go to Performance &amp; Risk for analytics, charts, and decomposition.</li>
            <li>Run backtests/efficient frontier or stress tests from analytics panels.</li>
            <li>Use position sizing and rebalance tools for trade planning.</li>
          </ol>
        </Card>
      </div>
    </PageShell>
  );
};

export default AboutPage;
