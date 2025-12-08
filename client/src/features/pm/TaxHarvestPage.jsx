import { useEffect, useMemo, useState } from "react";
import { portfolioApi } from "../../services/portfolioApi";
import { usePortfolioAnalytics } from "../../state/portfolioAnalytics";
import "./TaxHarvestPage.css";

const formatCurrency = (value) =>
  value.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });

const formatPercent = (value) => `${(value * 100).toFixed(0)}%`;

const TaxHarvestPage = () => {
  const { dateRange, benchmark } = usePortfolioAnalytics();
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
  const totals = result?.candidates?.length ?? 0;
  const selected = result?.selected_candidates?.length ?? 0;

  const summaryCards = [
    {
      label: "Target loss to realize",
      value:
        summary?.target_loss_to_realize && summary.target_loss_to_realize > 0
          ? formatCurrency(-summary.target_loss_to_realize)
          : "N/A",
      meta: "Driver: realized gains buffer",
    },
    {
      label: "Max harvestable loss",
      value: summary ? formatCurrency(-summary.max_harvestable_loss) : "—",
      meta: "Unrealized losses across lots",
    },
    {
      label: "Estimated tax savings",
      value: summary ? formatCurrency(summary.estimated_tax_savings) : "—",
      meta:
        summary && summary.marginal_tax_rate
          ? `Assumes ${Math.round(summary.marginal_tax_rate * 100)}% marginal rate`
          : "Margin rate pending",
    },
    {
      label: "Lots selected",
      value: `${selected}`,
      meta: `out of ${totals} underwater lots`,
    },
  ];

  const showEmpty = result && result.candidates?.length === 0;

  return (
    <div className="tax-harvest-page">
      <div className="card tax-hero-card">
        <div>
          <h1>📉 Tax Harvest Opportunities</h1>
          <p>
            Automatically translate unrealized losses into real tax deductions. Adjust realized gains,
            target exposure, and let Saxton PI recommend tax-lot harvests with wash-sale awareness.
          </p>
        </div>
        <div className="tax-hero-controls">
          <div className="hero-input">
            <label>Realized gains to offset</label>
            <input
              type="number"
              min="0"
              value={realizedGains}
              onChange={(evt) => handleGainsChange(evt.target.value)}
            />
            <span className="hero-input-hint">Use your ledger or gain reports</span>
          </div>
          <div className="hero-input">
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
        </div>
      </div>

      {error && <div className="tax-error-text">{error}</div>}
      {loading && <div className="tax-loading">Computing opportunities…</div>}

      {!loading && result && (
        <>
          <div className="tax-summary-grid">
            {summaryCards.map((card) => (
              <div key={card.label} className="tax-summary-card">
                <div className="tax-summary-label">{card.label}</div>
                <div className="tax-summary-value">{card.value}</div>
                <div className="tax-summary-meta">{card.meta}</div>
              </div>
            ))}
          </div>

          {showEmpty ? (
            <div className="card tax-empty-card">
              <p>No tax-loss opportunities found in this portfolio for the selected date range.</p>
            </div>
          ) : (
            <div className="card tax-table-card">
              <div className="tax-table-header">
                <div>
                  <h3>Harvest candidates</h3>
                  <p className="tax-table-subtitle">
                    Sorted by largest unrealized loss; selected rows highlight the recommended lots.
                  </p>
                </div>
              </div>
              <div className="tax-table-wrapper">
                <table className="tax-table">
                  <thead>
                    <tr>
                      <th>Symbol</th>
                      <th>Lot ID</th>
                      <th>Qty</th>
                      <th>Cost basis</th>
                      <th>Current price</th>
                      <th>Unrealized P&amp;L ($)</th>
                      <th>Unrealized P&amp;L (%)</th>
                      <th>Days held</th>
                      <th>Wash-sale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result?.candidates.map((candidate) => (
                      <tr
                        key={candidate.lot_id}
                        className={selectedLotIds.has(candidate.lot_id) ? "selected-row" : ""}
                      >
                        <td>
                          <div className="tax-symbol">{candidate.symbol}</div>
                          <div className="tax-symbol-meta">{candidate.purchase_date}</div>
                        </td>
                        <td>{candidate.lot_id}</td>
                        <td>{candidate.quantity.toLocaleString()}</td>
                        <td>{formatCurrency(candidate.cost_basis)}</td>
                        <td>{formatCurrency(candidate.current_price)}</td>
                        <td className="tax-pl">{formatCurrency(candidate.unrealized_pl)}</td>
                        <td>{formatPercent(candidate.unrealized_pl_pct)}</td>
                        <td>{candidate.days_held}</td>
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
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TaxHarvestPage;
