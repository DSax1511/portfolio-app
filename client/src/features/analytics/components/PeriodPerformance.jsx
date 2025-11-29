import { useMemo } from "react";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const formatPercent = (value) =>
  value == null ? "—" : `${(value * 100).toFixed(1)}%`;

const colorForReturn = (ret) => {
  if (ret == null) return "transparent";
  const clamped = Math.max(-0.2, Math.min(0.2, ret));
  const scale = clamped >= 0 ? clamped / 0.2 : clamped / -0.2;
  if (ret >= 0) {
    return `rgba(34, 197, 94, ${0.15 + 0.35 * scale})`;
  }
  return `rgba(239, 68, 68, ${0.15 + 0.35 * scale})`;
};

const PeriodPerformance = ({ periods, stats }) => {
  const grid = useMemo(() => {
    const byYear = new Map();
    periods.forEach((p) => {
      const yearRow = byYear.get(p.year) || Array(12).fill(null);
      yearRow[p.month - 1] = p;
      byYear.set(p.year, yearRow);
    });
    return Array.from(byYear.entries())
      .map(([year, monthsArr]) => ({ year, monthsArr }))
      .sort((a, b) => a.year - b.year);
  }, [periods]);

  if (!periods || periods.length === 0) {
    return <p className="muted">Not enough data to show period performance.</p>;
  }

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: "1rem" }}>
        <div className="stat-box">
          <p className="muted">Best</p>
          <p>{formatPercent(stats?.best)}</p>
        </div>
        <div className="stat-box">
          <p className="muted">Worst</p>
          <p>{formatPercent(stats?.worst)}</p>
        </div>
        <div className="stat-box">
          <p className="muted">Average</p>
          <p>{formatPercent(stats?.avg)}</p>
        </div>
        <div className="stat-box">
          <p className="muted">Hit Rate</p>
          <p>{stats?.hitRate == null ? "—" : `${(stats.hitRate * 100).toFixed(1)}%`}</p>
        </div>
      </div>
      <div className="table-wrapper">
        <table className="period-heatmap">
          <thead>
            <tr>
              <th>Year</th>
              {months.map((m) => (
                <th key={m}>{m}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.year}>
                <td>{row.year}</td>
                {row.monthsArr.map((cell, idx) => (
                  <td
                    key={`${row.year}-${idx}`}
                    style={{ background: colorForReturn(cell?.returnPct) }}
                    title={cell ? `${cell.periodLabel}: ${formatPercent(cell.returnPct)}` : "—"}
                  >
                    {cell ? formatPercent(cell.returnPct) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PeriodPerformance;
