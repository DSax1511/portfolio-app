import Card from "../../../components/ui/Card";
import SectionHeader from "../../../components/layout/SectionHeader";

const StrategyCommentary = ({ commentary, loading, error }) => {
  if (error) return <Card title="Strategy Commentary"><p className="error-text">{error}</p></Card>;
  if (loading) return <Card title="Strategy Commentary"><p className="muted">Generating commentary based on portfolio analytics...</p></Card>;
  if (!commentary) return <Card title="Strategy Commentary"><p className="muted">Not enough data to generate commentary.</p></Card>;

  const sections = [
    { label: "Headline", value: commentary.headline },
    { label: "Risk/Return", value: commentary.risk_profile },
    { label: "Behavior vs SPY", value: commentary.relative_performance },
    { label: "Regime & Factor Profile", value: `${commentary.regime_behavior || ""} ${commentary.factor_profile || ""}`.trim() },
    { label: "Drawdown & Recovery", value: commentary.drawdown_profile },
    { label: "Risk Concentration", value: commentary.concentration },
    { label: "Stress Tests", value: commentary.stress_summary },
  ].filter((s) => s.value);

  return (
    <Card>
      <SectionHeader
        overline="Qualitative"
        title="Strategy Commentary"
        subtitle="PM-style note derived from portfolio analytics"
      />
      <div className="simple-list" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {sections.map((s) => (
          <div key={s.label}>
            <p className="metric-label">{s.label}</p>
            <p style={{ margin: "2px 0 0" }}>{s.value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default StrategyCommentary;
