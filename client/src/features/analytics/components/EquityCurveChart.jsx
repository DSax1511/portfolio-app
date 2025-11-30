import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatDateTick, formatDateTickShort } from "../../../utils/format";

const formatGrowth = (value) => `${((value - 1) * 100).toFixed(2)}%`;
const formatRelative = (value) => `${(value * 100).toFixed(2)}%`;

const EquityCurveChart = ({ combinedSeries, onHover, hoveredDate }) => {
  const [showRelative, setShowRelative] = useState(true);

  const data = useMemo(() => combinedSeries || [], [combinedSeries]);

  return (
    <div className="chart-wrapper">
      <div className="action-row" style={{ justifyContent: "flex-end", marginBottom: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
          <input
            type="checkbox"
            checked={showRelative}
            onChange={(e) => setShowRelative(e.target.checked)}
            style={{ accentColor: "var(--accent)" }}
          />
          Show Relative vs SPY
        </label>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={data}
          syncId="analytics-perf"
          onMouseMove={(state) => {
            if (state?.activeLabel) onHover(state.activeLabel);
          }}
          onMouseLeave={() => onHover(null)}
          margin={{ left: 8, right: 24, top: 12, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateTick}
            stroke="#6b7280"
            minTickGap={40}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => `${((v - 1) * 100).toFixed(1)}%`}
            label={{ value: "Growth (%)", angle: -90, position: "insideLeft" }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
            label={{ value: "Relative (%)", angle: 90, position: "insideRight" }}
            tick={{ fontSize: 12 }}
            hide={!showRelative}
          />
          {hoveredDate && <ReferenceLine x={hoveredDate} stroke="#94a3b8" strokeDasharray="3 3" />}
          <Tooltip
            labelFormatter={formatDateTickShort}
            formatter={(value, name) => {
              if (name === "relative") return [formatRelative(value), "Outperformance vs SPY"];
              const label = name === "portfolio" ? "Portfolio" : "Benchmark (SPY)";
              return [formatGrowth(value), label];
            }}
            contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b" }}
          />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="portfolio"
            name="Portfolio"
            stroke="#6366f1"
            dot={false}
            strokeWidth={2}
            activeDot={{ r: 3 }}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="benchmark"
            name="Benchmark (SPY)"
            stroke="#22c55e"
            dot={false}
            strokeWidth={1.8}
            activeDot={{ r: 3 }}
          />
          {showRelative && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="relative"
              name="Relative vs SPY"
              stroke="#f97316"
              dot={false}
              strokeWidth={1}
              strokeDasharray="4 2"
              activeDot={{ r: 2.5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EquityCurveChart;
