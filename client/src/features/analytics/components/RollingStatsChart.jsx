import { LineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const RollingStatsChart = ({ data }) => {
  if (!data || !data.length) {
    return <p className="muted">Run an analysis to view rolling stats.</p>;
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateTickShort}
            stroke="#6b7280"
            minTickGap={40}
            interval="preserveStartEnd"
          />
          <YAxis
            yAxisId="left"
            tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
            label={{ value: "Vol (%)", angle: -90, position: "insideLeft" }}
            tick={{ fontSize: 12 }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tickFormatter={(v) => v.toFixed(2)}
            label={{ value: "Sharpe / Beta", angle: 90, position: "insideRight" }}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(value, name) =>
              name === "annualizedVol"
                ? `${(value * 100).toFixed(2)}%`
                : value?.toFixed(2)
            }
            labelFormatter={formatDateTickShort}
            />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="annualizedVol" name="Vol (ann.)" stroke="#60a5fa" dot={false} activeDot={{ r: 3 }} />
          <Line yAxisId="right" type="monotone" dataKey="sharpe" name="Sharpe" stroke="#f59e0b" dot={false} activeDot={{ r: 3 }} />
          <Line yAxisId="right" type="monotone" dataKey="beta" name="Beta" stroke="#22c55e" dot={false} activeDot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default RollingStatsChart;
import { formatDateTickShort } from "../../../utils/format";
