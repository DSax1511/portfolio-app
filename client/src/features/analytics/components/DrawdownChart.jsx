import {
  Area,
  AreaChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const formatDrawdown = (value) => `${(value * 100).toFixed(2)}%`;

const DrawdownChart = ({ drawdownSeries, maxDrawdownWindow, hoveredDate, onHover }) => {
  const hasHighlight = maxDrawdownWindow && drawdownSeries.length > 0;
  const highlightStart = hasHighlight ? maxDrawdownWindow.startDate : null;
  const highlightEnd =
    hasHighlight && maxDrawdownWindow.recoveryDate
      ? maxDrawdownWindow.recoveryDate
      : hasHighlight
      ? drawdownSeries[drawdownSeries.length - 1].date
      : null;

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart
          data={drawdownSeries}
          syncId="analytics-perf"
          onMouseMove={(state) => {
            if (state?.activeLabel) onHover(state.activeLabel);
          }}
          onMouseLeave={() => onHover(null)}
        >
          <XAxis
            dataKey="date"
            tickFormatter={formatDateTick}
            stroke="#6b7280"
            minTickGap={40}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            label={{ value: "Drawdown (%)", angle: -90, position: "insideLeft" }}
            tick={{ fontSize: 12 }}
          />
          {hoveredDate && (
            <ReferenceLine x={hoveredDate} stroke="#94a3b8" strokeDasharray="3 3" />
          )}
          {highlightStart && highlightEnd && (
            <ReferenceArea
              x1={highlightStart}
              x2={highlightEnd}
              y1={maxDrawdownWindow?.depth}
              y2={0}
              stroke="#ef4444"
              fill="#ef4444"
              fillOpacity={0.08}
            />
          )}
          <Tooltip
            formatter={(v) => formatDrawdown(v)}
            labelFormatter={formatDateTickShort}
            contentStyle={{ backgroundColor: "#020617", borderColor: "#1e293b" }}
          />
          <Area dataKey="drawdown" stroke="#ef4444" fill="#ef4444" fillOpacity={0.25} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DrawdownChart;
import { formatDateTick, formatDateTickShort } from "../../../utils/format";
