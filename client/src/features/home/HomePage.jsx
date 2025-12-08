import { Link } from "react-router-dom";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const featureCards = [
  {
    title: "Portfolio Dashboard",
    description: "Equity curve, PnL, benchmark vs portfolio.",
  },
  {
    title: "Risk & Analytics",
    description: "Volatility, Sharpe/Sortino, drawdowns, correlation, and exposures.",
  },
  {
    title: "Strategy Research",
    description: "SMA/RSI backtests with realistic execution assumptions and trade logs.",
  },
  {
    title: "Tax Harvesting",
    description: "Identify harvestable losses, wash-sale flags, and estimated savings.",
  },
  {
    title: "Full-Stack Engine",
    description: "React + Vite frontend, FastAPI analytics backend, CI/CD, and Docker containers.",
  },
  {
    title: "Research Artifacts",
    description: "Notebooks, documentation, tests, and demo data for every insight.",
  },
];

const architectureHighlights = [
  {
    title: "Frontend",
    points: ["React + Vite", "Responsive layout with Recharts", "Design tokens for polish"],
  },
  {
    title: "Backend",
    points: ["FastAPI endpoints", "Portfolio analytics & backtests", "NumPy/Pandas math"],
  },
  {
    title: "Ops",
    points: ["Dockerized services", "CI/CD coverage", "Render & Vercel deployments"],
  },
];

const quickLinks = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/davidsaxton06" },
  { label: "GitHub", href: "https://github.com/DSax1511" },
  { label: "Resume", href: "/DavidSaxtonResume.pdf" },
  { label: "Whitepaper", href: "/assets/SaxtonPI_Whitepaper_Final.pdf", external: true },
];

const HomePage = () => {
  return (
    <PageShell hideHeader>
      <div className="landing-hero">
        <div className="landing-hero__copy">
          <p className="label-sm">Saxton PI · Portfolio Intelligence</p>
          <h1 className="landing-hero__title">Saxton PI · Portfolio Intelligence</h1>
          <p className="landing-hero__subtitle">
            A full-stack platform for portfolio analytics, risk diagnostics, backtesting, and tax-aware management.
          </p>
          <div className="landing-hero__actions">
            <Link to="/pm/dashboard" className="btn btn-primary">
              Launch Saxton PI
            </Link>
            <a
              className="btn btn-ghost"
              href="/assets/SaxtonPI_Whitepaper_Final.pdf"
              target="_blank"
              rel="noreferrer"
            >
              Read the Whitepaper
            </a>
          </div>
          <div className="landing-hero__notes">
            <span>4 curated portfolios</span>
            <span>Live benchmark comparison</span>
            <span>Quant lab-ready</span>
          </div>
        </div>
        <Card className="landing-hero__panel">
          <p className="font-semibold text-slate-100">Platform confidence</p>
          <ul className="simple-list" style={{ marginTop: 12 }}>
            <li>Live portfolio & benchmark curves synchronized to one dashboard.</li>
            <li>Risk diagnostics, drawdowns, and factor exposure in a single view.</li>
            <li>Strategy Research channel with logs, metrics, and trade blotter.</li>
          </ul>
          <div className="landing-hero__panel-footer">
            <span>Deploys via Vercel + Render</span>
            <span>CI/CD + Docker</span>
          </div>
        </Card>
      </div>

      <section>
        <div className="section-header">
          <div>
            <p className="label-sm">Core capabilities</p>
            <h4 className="section-title">Quant-grade workflow</h4>
          </div>
        </div>
        <div className="feature-grid">
          {featureCards.map((feature) => (
            <Card key={feature.title} className="feature-card">
              <h3 className="card-title">{feature.title}</h3>
              <p className="muted" style={{ marginTop: 4 }}>
                {feature.description}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="section-header">
          <div>
            <p className="label-sm">Technical architecture</p>
            <h4 className="section-title">Built for analysts and PMs</h4>
          </div>
          <div className="section-actions">
            <Link to="/quant/strategy-research" className="btn btn-ghost">
              Visit Strategy Research
            </Link>
          </div>
        </div>
        <div className="architecture-grid">
          {architectureHighlights.map((item) => (
            <Card key={item.title} className="architecture-card">
              <h3 className="card-title">{item.title}</h3>
              <ul className="simple-list" style={{ marginTop: 8 }}>
                {item.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <div className="section-header">
          <div>
            <p className="label-sm">Research & contact</p>
            <h4 className="section-title">Connect with the builder</h4>
          </div>
        </div>
        <Card className="landing-bio-card">
          <p className="muted">
            I’m David Saxton, a full-stack engineer and aspiring quant focused on cybersecurity, market microstructure,
            and portfolio analytics. Saxton PI is the product of end-to-end tooling that combines probabilistic backtests
            with intuitive dashboards.
          </p>
          <div className="landing-bio-card__links">
            {quickLinks.map((link) => (
              <a
                key={link.label}
                className="btn btn-ghost"
                href={link.href}
                target={link.external ? "_blank" : "_self"}
                rel={link.external ? "noreferrer" : undefined}
              >
                {link.label}
              </a>
            ))}
          </div>
        </Card>
      </section>
    </PageShell>
  );
};

export default HomePage;
