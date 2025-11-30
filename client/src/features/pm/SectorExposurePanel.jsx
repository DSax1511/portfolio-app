import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";

const formatPercent = (v) => `${(v * 100).toFixed(1)}%`;

const SectorExposurePanel = ({ data }) => {
  const hasData = data && data.length > 0;
  const topLine = hasData
    ? data
        .slice(0, 3)
        .map((d) => `${d.sector} ${formatPercent(d.weight)}`)
        .join(" · ")
    : null;

  return (
    <Card title="Sector Exposure" subtitle="Weight by sector (% of portfolio)">
      {hasData ? (
        <div className="chart-wrapper">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ left: 16, right: 16, top: 12, bottom: 12 }}
            >
              <XAxis
                type="number"
                tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
              />
              <YAxis
                type="category"
                dataKey="sector"
                width={120}
                tick={{ fontSize: 12, fill: "var(--text-secondary)" }}
              />
              <Tooltip formatter={(v) => formatPercent(v)} labelFormatter={(l) => l} />
              <Bar dataKey="weight" fill="var(--accent)" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          {topLine && <p className="muted" style={{ marginTop: "8px" }}>Top sectors: {topLine}</p>}
        </div>
      ) : (
        <EmptyState
          title="No sector data yet"
          description="Upload positions or load the demo portfolio to see sector weights."
        />
      )}
    </Card>
  );
};

export default SectorExposurePanel;
