import { useRef } from "react";

const TICKER_LIST = [
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOGL",
  "META",
  "NVDA",
  "TSLA",
  "SPY",
  "QQQ",
  "IWM",
  "TLT",
  "GLD",
  "XLF",
  "XLK",
  "XLV",
  "XLE",
];

const presetOptions = [
  { label: "Demo Portfolio", tickers: ["AAPL", "MSFT", "SPY"], weights: [0.3, 0.3, 0.4] },
  { label: "S&P Sample (equal-weight)", tickers: ["AAPL", "MSFT", "AMZN", "GOOGL", "META"], weights: null },
  { label: "Tech basket", tickers: ["AAPL", "MSFT", "NVDA", "GOOGL", "META"], weights: [0.2, 0.2, 0.2, 0.2, 0.2] },
  { label: "Momentum basket", tickers: ["MTUM", "QQQ", "SPY"], weights: [0.4, 0.4, 0.2] },
];

const formatPercent = (value) =>
  value == null ? "" : (value * 100).toFixed(1);

const PortfolioBuilder = ({
  rows,
  setRows,
  onNormalize,
  onEqual,
  onRun,
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  setPreset,
  validationMessage,
  loading,
}) => {
  const fileInputRef = useRef(null);

  const updateRow = (idx, field, value) => {
    const next = rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r));
    setRows(next);
  };

  const addRow = () => setRows([...rows, { ticker: "", weight: 0 }]);
  const deleteRow = (idx) => setRows(rows.filter((_, i) => i !== idx));

  const handleCsv = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== "string") return;
      const lines = text.split(/\r?\n/).filter(Boolean);
      const parsed = lines
        .map((line) => {
          const [t, w] = line.split(",").map((x) => x.trim());
          if (!t) return null;
          const weight = w ? Number(w) / 100 : null;
          return { ticker: t.toUpperCase(), weight: Number.isFinite(weight) ? weight : 0 };
        })
        .filter(Boolean);
      if (parsed.length) setRows(parsed);
    };
    reader.readAsText(file);
  };

  const quickRange = (years) => {
    if (years === "max") {
      setStartDate("");
      setEndDate("");
      return;
    }
    const end = new Date();
    const start = new Date();
    start.setFullYear(start.getFullYear() - years);
    setStartDate(start.toISOString().slice(0, 10));
    setEndDate(end.toISOString().slice(0, 10));
  };

  return (
    <div className="card">
      <div className="section-heading" style={{ alignItems: "center" }}>
        <div>
          <h3>Portfolio Builder</h3>
          <p className="muted">Define tickers, weights, presets, and date range before running analytics.</p>
        </div>
        <button onClick={onRun} disabled={loading}>
          {loading ? "Running..." : "Run Analysis"}
        </button>
      </div>

      <div className="analytics-grid">
        <div>
          <div className="action-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
            <button onClick={onNormalize}>Normalize weights</button>
            <button onClick={onEqual}>Use equal weights</button>
            <button onClick={() => fileInputRef.current?.click()}>Load from CSV</button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleCsv}
            />
          </div>
          <div className="table-wrapper" style={{ marginTop: "0.75rem" }}>
            <table>
              <thead>
                <tr>
                  <th>
                    Ticker <span title="Use common symbols (e.g., AAPL, MSFT, SPY)">ⓘ</span>
                  </th>
                  <th>
                    Weight (%) <span title="Weights auto-normalize to 100%">ⓘ</span>
                  </th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td>
                      <input
                        list="ticker-options"
                        value={row.ticker}
                        onChange={(e) => updateRow(idx, "ticker", e.target.value.toUpperCase())}
                        placeholder="SPY"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        value={formatPercent(row.weight)}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          updateRow(idx, "weight", Number.isFinite(val) ? val / 100 : 0);
                        }}
                        placeholder="25"
                      />
                    </td>
                    <td>
                      <button onClick={() => deleteRow(idx)} disabled={rows.length === 1}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="ticker-options">
              {TICKER_LIST.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
          <button onClick={addRow} style={{ marginTop: "0.5rem" }}>
            + Add ticker
          </button>
          {validationMessage && <p className="error-text" style={{ marginTop: "0.5rem" }}>{validationMessage}</p>}
        </div>

        <div>
          <p className="muted" style={{ marginBottom: "0.25rem" }}>Presets</p>
          <div className="analytics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
            {presetOptions.map((p) => (
              <button key={p.label} onClick={() => setPreset(p)}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <p className="muted">Date range</p>
            <div className="action-row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <button onClick={() => quickRange(1)}>Last 1Y</button>
              <button onClick={() => quickRange(3)}>Last 3Y</button>
              <button onClick={() => quickRange(5)}>Last 5Y</button>
              <button onClick={() => quickRange("max")}>Max</button>
            </div>
            <details style={{ marginTop: "0.5rem" }}>
              <summary>Advanced options</summary>
              <div className="form-row" style={{ marginTop: "0.5rem" }}>
                <label>
                  Start date
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </label>
                <label>
                  End date
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                </label>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioBuilder;
