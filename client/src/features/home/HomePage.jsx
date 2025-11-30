import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";

const HomePage = () => {
  return (
    <PageShell
      title="Home"
      subtitle="Choose a module to manage long-horizon portfolios or run short-horizon quant research."
    >
      <div className="dashboard-grid">
        <Card title="Portfolio Management" subtitle="Long-horizon PM toolkit">
          <p className="muted">
            Monitor allocations, risk, and performance over time. Jump into Overview for live KPIs, Allocation for weights and drift,
            Backtests for historical studies, and Risk for full analytics.
          </p>
        </Card>
        <Card title="Quant Lab" subtitle="Research & strategy sandbox">
          <p className="muted">
            Prototype strategies, parameter sweeps, and execution simulators. Use the Quant Lab pages to organize microstructure studies,
            regime analysis, and backtest engines.
          </p>
        </Card>
        <Card title="Research Hub" subtitle="Notes & write-ups">
          <p className="muted">
            Store research summaries, PDFs, and working notes. The Research pages keep long-form analysis alongside the interactive tools.
          </p>
        </Card>
      </div>
    </PageShell>
  );
};

export default HomePage;
