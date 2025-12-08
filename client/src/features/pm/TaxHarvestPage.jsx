import { useEffect, useMemo, useState } from "react";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import { usePortfolioAnalytics } from "../../state/portfolioAnalytics";
import { portfolioApi } from "../../services/portfolioApi";
import "./TaxHarvestPage.css";

const formatCurrency = (value) =>
  value?.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

const formatPercent = (value) =>
  value === undefined || value === null ? "—" : `${(value * 100).toFixed(1)}%`;

const formatQuantity = (value) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.round(value).toLocaleString()
    : "—";

const presets = ["1Y", "3Y", "5Y", "MAX"];
const benchmarkOptions = ["SPY", "QQQ", "IWM", "ACWI"];

const TaxHarvestPage = () => {
  const { dateRange, setDateRange, benchmark, setBenchmark } = usePortfolioAnalytics();
  const [realizedGains, setRealizedGains] = useState(0);
  const [targetFraction, setTargetFraction] = useState(1);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedLotIds = useMemo(() => {
    if (!result?.selected_candidates) return new Set();
    return new Set(result.selected_candidates.map((candidate) => candidate.lot_id));
  }, [result]);

  useEffect(() => {
    let isActive = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError("");

      portfolioApi
        .getTaxHarvest({
          portfolio_id: "demo",
          date_range: dateRange.preset,
          realized_gains_to_offset: realizedGains,
          target_fraction_of_gains: targetFraction,
          benchmark,
        })
        .then((res) => {
          if (!isActive) return;
          setResult(res);
        })
        .catch((err) => {
          if (!isActive) return;
          setResult(null);
          setError(err.message || "Unable to load tax-harvest opportunities.");
        })
        .finally(() => {
          if (!isActive) return;
          setLoading(false);
        });
    }, 400);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [dateRange.preset, benchmark, realizedGains, targetFraction]);

  const handleGainsChange = (value) => {
    const parsed = Number(value);
    setRealizedGains(Number.isNaN(parsed) ? 0 : Math.max(parsed, 0));
  };

  const handleFractionChange = (value) => {
    const parsed = Number(value);
    const sanitized = Number.isNaN(parsed) ? 0 : Math.min(Math.max(parsed, 0), 1);
    setTargetFraction(sanitized);
  };

  const summary = result?.summary;
  const totalLots = result?.candidates?.length ?? 0;
  const selectedCount = result?.selected_candidates?.length ?? 0;
  const summaryCards = [
    {
      label: "Target loss to realize",
      value:
        summary?.target_loss_to_realize > 0 ? formatCurrency(-summary.target_loss_to_realize) : "—",
      meta: "Driver: realized gains buffer",
    },
    {
      label: "Max harvestable loss",
      value: summary ? formatCurrency(-summary.max_harvestable_loss) : "—",
      meta: "Unrealized losses available",
    },
    {
      label: "Estimated tax savings",
      value: summary ? formatCurrency(summary.estimated_tax_savings) : "—",
      meta: summary?.marginal_tax_rate
        ? `Assumes ${Math.round(summary.marginal_tax_rate * 100)}% marginal rate`
        : "Pending tax profile",
    },
    {
      label: "Lots selected",
      value: `${selectedCount}`,
      meta: `out of ${totalLots} underwater lots`,
    },
  ];

  const showEmptyState = !loading && result && totalLots === 0;

  return (
    <PageShell
      title="Tax Harvest"
      subtitle="Identify tax-aware trades and visualize harvestable losses with wash-sale awareness."
      contextStatus="live"
    >
      <div className="tax-harvest-header">
        <div className="tax-summary-grid">
          {summaryCards.map((card) => (
            <div key={card.label} className="tax-summary-card">
              <div className="tax-summary-label">{card.label}</div>
              <div className="tax-summary-value">{card.value || "—"}</div>
              <div className="tax-summary-meta">{card.meta}</div>
            </div>
          ))}
        </div>
        <Card title="Harvest controls" className="tax-controls-card">
          <div className="tax-control-row">
            <label>Realized gains to offset</label>
            <input
              type="number"
              min="0"
              value={realizedGains}
              onChange={(evt) => handleGainsChange(evt.target.value)}
            />
            <span className="muted">Use your ledger or gain reports.</span>
          </div>
          <div className="tax-control-row">
            <label>Target % of realized gains</label>
            <div className="tax-slider">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={targetFraction}
                onChange={(evt) => handleFractionChange(evt.target.value)}
              />
              <span>{formatPercent(targetFraction)}</span>
            </div>
          </div>
          <div className="tax-control-row">
            <p className="label-sm" style={{ marginBottom: 6 }}>
              Date range
            </p>
            <div className="tax-presets">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`btn btn-ghost${dateRange.preset === preset ? " btn-primary" : ""}`}
                  onClick={() => setDateRange({ preset, startDate: null, endDate: null })}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <div className="tax-control-row">
            <label>Benchmark</label>
            <select value={benchmark} onChange={(evt) => setBenchmark(evt.target.value)}>
              {benchmarkOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </Card>
      </div>

      {error && <div className="tax-status-banner tax-error">{error}</div>}
      {loading && <div className="tax-status-banner">Computing opportunities…</div>}

      {showEmptyState && (
        <Card className="tax-empty-card">
          <p>No tax-loss harvesting opportunities found for the selected date range and portfolio.</p>
        </Card>
      )}

      {!showEmptyState && result && (
        <Card className="tax-table-card">
          <div className="tax-table-header">
            <div>
              <h3>Harvest candidates</h3>
              <p className="tax-table-subtitle">
                Sorted by largest unrealized loss; recommended rows are highlighted for the current target.
              </p>
            </div>
          </div>
          <div className="tax-table-wrapper">
            <table className="tax-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="numeric">Quantity</th>
                  <th className="numeric">Cost basis</th>
                  <th className="numeric">Current price</th>
                  <th className="numeric">Unrealized P&amp;L ($)</th>
                  <th className="numeric">Unrealized P&amp;L (%)</th>
                  <th className="numeric">Days held</th>
                  <th>Wash-sale</th>
                </tr>
              </thead>
              <tbody>
                {result.candidates.map((candidate) => (
                  <tr
                    key={candidate.lot_id}
                    className={selectedLotIds.has(candidate.lot_id) ? "selected-row" : ""}
                  >
                    <td>
                      <div className="tax-symbol">
                        <div>{candidate.symbol}</div>
                        <div className="tax-symbol-meta">{candidate.purchase_date}</div>
                      </div>
                      {selectedLotIds.has(candidate.lot_id) && (
                        <span className="tax-pill recommended">Recommended</span>
                      )}
                    </td>
                    <td className="numeric">{formatQuantity(candidate.quantity)}</td>
                    <td className="numeric">{formatCurrency(candidate.cost_basis)}</td>
                    <td className="numeric">{formatCurrency(candidate.current_price)}</td>
                    <td className="numeric tax-pl">{formatCurrency(candidate.unrealized_pl)}</td>
                    <td className="numeric">{formatPercent(candidate.unrealized_pl_pct)}</td>
                    <td className="numeric">{candidate.days_held}</td>
                    <td>
                      {candidate.wash_sale_risk ? (
                        <span className="tax-pill">Wash-sale risk</span>
                      ) : (
                        <span className="tax-pill safe">Clear</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </PageShell>
  );
};

export default TaxHarvestPage;
