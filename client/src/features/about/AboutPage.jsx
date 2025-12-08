import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const quickLinks = [
  { label: "LinkedIn", href: "https://www.linkedin.com/in/davidsaxton06", external: true },
  { label: "GitHub", href: "https://github.com/DSax1511", external: true },
  { label: "Resume", href: "/DavidSaxtonResume.pdf" },
  { label: "Whitepaper", href: "/assets/SaxtonPI_Whitepaper_Final.pdf", external: true },
];

const AboutPage = () => {
  return (
    <PageShell
      title="About Saxton PI"
      subtitle="A full-stack quant research and portfolio intelligence platform built for disciplined investors."
    >
      <div className="about-container">
        <Card className="about-hero-card">
          <p className="label-sm">Saxton PI · Portfolio Intelligence</p>
          <h2 className="section-title" style={{ margin: "0.3rem 0 0" }}>
            Saxton PI is the full-stack quant research cockpit from David Saxton.
          </h2>
          <p className="muted" style={{ marginTop: "0.8rem" }}>
            I’m David Saxton, a full-stack engineer and aspiring quant who blends cybersecurity, market microstructure,
            and portfolio analytics. Saxton PI is the product of the research, modeling, and infrastructure I rely on for
            disciplined investing.
          </p>
          <div className="about-links" style={{ marginTop: "1rem" }}>
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

        <div className="about-grid">
          <Card title="What this app delivers" subtitle="Institutional workflows">
            <ul className="simple-list">
              <li>Live dashboard with exposures, equity curves, and benchmark deltas.</li>
              <li>Risk diagnostics including drawdowns, volatility, beta, and factor decomposition.</li>
              <li>Quant Lab with configurable SMA/RSI backtests, trades, metrics, and sweeps.</li>
              <li>Tax-loss harvesting with recommended lots and wash-sale awareness.</li>
              <li>Operational readiness with CI/CD, Docker, and documented math.</li>
            </ul>
          </Card>

          <Card title="Technical stack" subtitle="Reliable infra">
            <ul className="simple-list">
              <li>Frontend: React + Vite, Recharts, feature-based architecture, shared cards/metric components.</li>
              <li>Backend: FastAPI serving analytics, backtests, risk, and tax-harvest endpoints.</li>
              <li>Testing: pytest/hypothesis for quant logic; Storybook-style UI primitives for consistency.</li>
              <li>Deployment: Vercel (frontend) + Render or similar (backend) with env-driven toggles.</li>
            </ul>
          </Card>

          <Card title="Research artifacts" subtitle="Proof and process">
            <ul className="simple-list">
              <li>Quant notebooks describing return, risk, and optimization math.</li>
              <li>Backtest logs, trade blotters, and parameter sweeps.</li>
              <li>Documentation covering architecture, data pipelines, and deployment.</li>
            </ul>
          </Card>
        </div>

        <Card title="Connect" subtitle="Opportunities welcome">
          <p className="muted">
            I’m actively exploring collaborations across portfolio management, product, and engineering roles. Feel
            free to reach out for discussions on quantitative finance, cybersecurity, or software engineering.
          </p>
          <div style={{ marginTop: "0.8rem" }}>
            <a className="btn btn-primary" href="mailto:Dfsaxton06@gmail.com?subject=SaxtonPI%20Inquiry">
              Email David
            </a>
          </div>
        </Card>
      </div>
    </PageShell>
  );
};

export default AboutPage;
