import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatGrowth = (value) => `${((value - 1) * 100).toFixed(2)}%`;
const formatRelative = (value) => `${(value * 100).toFixed(2)}%`;

const EquityCurveChart = ({
  portfolioSeries,
  benchmarkSeries,
  relativeSeries,
  onHover,
  hoveredDate,
  useLogScale = false,
}) => {
  const benchmarkMap = useMemo(() => {
    const map = new Map();
    (benchmarkSeries || []).forEach((row) => map.set(row.date, row.equity));
    return map;
  }, [benchmarkSeries]);

  const relativeMap = useMemo(() => {
    const map = new Map();
    (relativeSeries || []).forEach((row) => map.set(row.date, row.relative));
    return map;
  }, [relativeSeries]);

  const data = useMemo(
    () =>
      (portfolioSeries || []).map((row) => ({
        date: row.date,
        portfolio: row.equity,
        benchmark: benchmarkMap.get(row.date) ?? null,
        relative: relativeMap.get(row.date) ?? null,
      })),
    [portfolioSeries, benchmarkMap, relativeMap]
  );

  return (
    <div className="chart-wrapper">
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
          <XAxis dataKey="date" tick={false} />
          <YAxis
            yAxisId="left"
            scale={useLogScale ? "log" : "auto"}
            tickFormatter={(v) => `${((v - 1) * 100).toFixed(1)}%`}
            label={{ value: "Growth (%)", angle: -90, position: "insideLeft" }}
            tick={{ fontSize: 12 }}
            allowDataOverflow={useLogScale}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
            label={{ value: "Relative (%)", angle: 90, position: "insideRight" }}
            tick={{ fontSize: 12 }}
            allowDecimals
          />
          {hoveredDate && (
            <ReferenceLine x={hoveredDate} stroke="#94a3b8" strokeDasharray="3 3" />
          )}
          <Tooltip
            formatter={(value, name) => {
              if (name === "relative") return [formatRelative(value), "Relative"];
              return [formatGrowth(value), name === "portfolio" ? "Portfolio" : "Benchmark"];
            }}
            labelFormatter={(label) => label}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="portfolio"
            name="Portfolio"
            stroke="#6366f1"
            dot={false}
            strokeWidth={2}
          />
          {benchmarkSeries && benchmarkSeries.length > 0 && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="benchmark"
              name="Benchmark"
              stroke="#22c55e"
              dot={false}
              strokeWidth={1.5}
              strokeDasharray="4 2"
            />
          )}
          {relativeSeries && relativeSeries.length > 0 && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="relative"
              name="Relative"
              stroke="#f97316"
              dot={false}
              strokeWidth={1.25}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EquityCurveChart;
