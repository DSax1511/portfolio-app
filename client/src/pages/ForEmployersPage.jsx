import Card from "../components/ui/Card";
import PageShell from "../components/ui/PageShell";
import ContextBadge from "../components/ui/ContextBadge";

const capabilities = [
  "Portfolio analytics & risk diagnostics",
  "Strategy backtesting with configurable execution",
  "Execution & microstructure modeling",
  "Tax-aware tooling and harvesting workflows",
];

const references = [
  { label: "Resume", href: "/DavidSaxtonResume.pdf" },
  { label: "GitHub", href: "https://github.com/DSax1511", external: true },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/davidsaxton06", external: true },
  { label: "Whitepaper", href: "/assets/SaxtonPI_Whitepaper_Final.pdf", external: true },
];

const ForEmployersPage = () => (
  <PageShell
    title="For Employers"
    subtitle="Platform-level deliverables that demonstrate quant research, execution, and systems engineering rigor."
    actions={<ContextBadge variant="backtest" />}
  >
    <Card>
      <p className="muted" style={{ marginBottom: "0.8rem" }}>
        Saxton PI is a full-stack quant research workspace that harmonizes portfolio, risk, execution, and tax intelligence in one environment. It captures the
        builder's understanding of market microstructure, infrastructure discipline, and data hygiene.
      </p>
      <Card title="Technical architecture" subtitle="Systems overview">
        <ul className="simple-list">
          <li>Frontend: React + Vite, Recharts visualizations, shared cards, and modular routes.</li>
          <li>Backend: FastAPI serving analytics, backtests, microstructure, and regime endpoints.</li>
          <li>Infra: Docker + CI/CD, Render/Vercel deployments with env-driven CORS and configs.</li>
        </ul>
      </Card>
    </Card>

    <Card title="Quant & engineering capabilities" subtitle="Demonstrated across the app">
      <ul className="simple-list">
        {capabilities.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Card>

    <Card title="Research artifacts" subtitle="Proof points">
      <ul className="simple-list">
        <li>Documented methodology for VAR, CVaR, factor exposures, regime detection, and autocorrelation.</li>
        <li>Execution prescriptive page with synthetic fills, venue breakdowns, and child order heuristics.</li>
        <li>Tax-harvest flows with lot analysis, wash-sale detection, and scenario estimates.</li>
      </ul>
    </Card>

    <Card title="Next steps" subtitle="Connect with the builder">
      <p className="muted">I'm available for engineering leadership, quant research, and hybrid platform roles. Let's schedule a focused walkthrough.</p>
      <div className="landing-bio-card__links" style={{ marginTop: "1rem" }}>
        {references.map((link) => (
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
  </PageShell>
);

export default ForEmployersPage;
