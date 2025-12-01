import { useEffect, useMemo, useState } from "react";
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import EmptyState from "../../components/ui/EmptyState";
import { portfolioApi } from "../../services/portfolioApi";

// Modern professional colors
const COLORS = {
  primary: "#2e78ff",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  surfaces: ["#2e78ff", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"],
};

const AllocationRebalancePage = ({ portfolio, formatCurrency, onOpenGuide }) => {
  const safeOpenGuide = onOpenGuide || (() => {});
  const [allocation, setAllocation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedStrategy, setSelectedStrategy] = useState("equal_weight");

  useEffect(() => {
    const loadAllocation = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await portfolioApi.getPMAllocation();
        setAllocation(response.data);
      } catch (err) {
        setError("Failed to load allocation data");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    if (portfolio.length > 0) {
      loadAllocation();
    }
  }, [portfolio]);

  // Calculate allocation data from portfolio
  const allocationData = useMemo(() => {
    if (!portfolio.length) return [];
    
    const total = portfolio.reduce((sum, p) => sum + p.market_value, 0) || 1;
    return portfolio.map((p) => ({
      ticker: p.ticker,
      value: p.market_value,
      allocation: (p.market_value / total) * 100,
    }));
  }, [portfolio]);

  // Calculate drift from target allocation
  const driftData = useMemo(() => {
    if (!allocation || !portfolio.length) return [];
    
    const total = portfolio.reduce((sum, p) => sum + p.market_value, 0) || 1;
    
    return portfolio.map((p) => {
      const current = (p.market_value / total) * 100;
      const target = allocation.target_allocation ? (allocation.target_allocation[p.ticker] || 0) * 100 : current;
      const drift = current - target;
      
      return {
        ticker: p.ticker,
        current: parseFloat(current.toFixed(2)),
        target: parseFloat(target.toFixed(2)),
        drift: parseFloat(drift.toFixed(2)),
        drift_abs: Math.abs(drift),
        status: Math.abs(drift) > 3 ? "warning" : "normal",
      };
    });
  }, [allocation, portfolio]);

  // Summary metrics
  const metrics = useMemo(() => {
    if (!driftData.length) return { max_drift: 0, avg_drift: 0, positions_out: 0 };
    
    const max_drift = Math.max(...driftData.map(d => d.drift_abs));
    const avg_drift = driftData.reduce((sum, d) => sum + d.drift_abs, 0) / driftData.length;
    const positions_out = driftData.filter(d => Math.abs(d.drift) > 3).length;
    
    return { max_drift, avg_drift, positions_out };
  }, [driftData]);

  const placeholderValue = portfolio.length === 0;

  return (
    <PageShell title="Allocation & Rebalancing" onOpenGuide={safeOpenGuide}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">
            Allocation & Rebalancing
          </h1>
          <p className="text-gray-400 text-sm sm:text-base">
            Monitor your target allocations and rebalancing opportunities
          </p>
        </div>

        {/* Strategy Selector */}
        <Card className="p-6 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Rebalancing Strategy</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { id: "equal_weight", name: "Equal Weight", desc: "All positions equally weighted" },
              { id: "risk_parity", name: "Risk Parity", desc: "Equal risk contribution" },
              { id: "market_cap", name: "Market Cap", desc: "Weight by market cap" },
            ].map((strategy) => (
              <button
                key={strategy.id}
                onClick={() => setSelectedStrategy(strategy.id)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedStrategy === strategy.id
                    ? "border-blue-500 bg-blue-900/20"
                    : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                }`}
              >
                <p className="font-semibold text-white">{strategy.name}</p>
                <p className="text-xs text-gray-400 mt-1">{strategy.desc}</p>
              </button>
            ))}
          </div>
        </Card>

        {/* Metrics Grid */}
        {!placeholderValue && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-900/40 to-blue-900/20 border border-blue-800 rounded-lg p-6">
              <p className="text-sm text-gray-400 mb-2">Max Drift</p>
              <p className="text-3xl font-bold text-blue-400">{metrics.max_drift.toFixed(2)}%</p>
              <p className="text-xs text-gray-500 mt-1">Largest position deviation</p>
            </div>
            <div className="bg-gradient-to-br from-amber-900/40 to-amber-900/20 border border-amber-800 rounded-lg p-6">
              <p className="text-sm text-gray-400 mb-2">Avg Drift</p>
              <p className="text-3xl font-bold text-amber-400">{metrics.avg_drift.toFixed(2)}%</p>
              <p className="text-xs text-gray-500 mt-1">Average position deviation</p>
            </div>
            <div className="bg-gradient-to-br from-red-900/40 to-red-900/20 border border-red-800 rounded-lg p-6">
              <p className="text-sm text-gray-400 mb-2">Out of Tolerance</p>
              <p className="text-3xl font-bold text-red-400">{metrics.positions_out}</p>
              <p className="text-xs text-gray-500 mt-1">Positions {`>`}3% drift</p>
            </div>
          </div>
        )}

        {/* Current Allocation Chart */}
        {!placeholderValue && allocationData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Current Allocation</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={allocationData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ ticker, allocation }) => `${ticker} ${allocation.toFixed(1)}%`}
                    outerRadius={80}
                    fill={COLORS.primary}
                    dataKey="allocation"
                  >
                    {allocationData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS.surfaces[index % COLORS.surfaces.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value.toFixed(2)}%`} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            {/* Drift Analysis */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Allocation Drift</h3>
              {driftData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={driftData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="ticker" tick={{ fill: "#9ca3af" }} />
                    <YAxis tick={{ fill: "#9ca3af" }} />
                    <Tooltip 
                      formatter={(value) => `${value.toFixed(2)}%`}
                      contentStyle={{ backgroundColor: "#1f2937", border: "1px solid #374151" }}
                    />
                    <Bar dataKey="drift" fill={COLORS.warning} name="Drift %" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState message="No drift data available" />
              )}
            </Card>
          </div>
        )}

        {/* Allocation Details Table */}
        {!placeholderValue && driftData.length > 0 && (
          <Card className="p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Allocation Details</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="px-4 py-3 text-left text-gray-400 font-semibold">Ticker</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-semibold">Current %</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-semibold">Target %</th>
                    <th className="px-4 py-3 text-right text-gray-400 font-semibold">Drift %</th>
                    <th className="px-4 py-3 text-center text-gray-400 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {driftData.map((row) => (
                    <tr key={row.ticker} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium text-white">{row.ticker}</td>
                      <td className="px-4 py-3 text-right text-blue-400">{row.current.toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right text-gray-400">{row.target.toFixed(2)}%</td>
                      <td className={`px-4 py-3 text-right font-semibold ${
                        row.drift > 0 ? "text-amber-400" : "text-gray-400"
                      }`}>
                        {row.drift > 0 ? "+" : ""}{row.drift.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          row.status === "warning"
                            ? "bg-red-900/40 text-red-400 border border-red-800"
                            : "bg-green-900/40 text-green-400 border border-green-800"
                        }`}>
                          {row.status === "warning" ? "Out of Range" : "In Range"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Rebalancing Recommendation */}
        {!placeholderValue && metrics.positions_out > 0 && (
          <Card className="p-6 bg-gradient-to-r from-amber-900/20 to-amber-900/10 border border-amber-800 mb-8">
            <div className="flex items-start gap-4">
              <div className="text-3xl">⚠️</div>
              <div>
                <h4 className="text-lg font-semibold text-amber-400 mb-2">Rebalancing Recommended</h4>
                <p className="text-gray-300 mb-3">
                  {metrics.positions_out} position{metrics.positions_out > 1 ? "s" : ""} {metrics.positions_out > 1 ? "are" : "is"} outside 
                  your target allocation by more than 3%. Consider rebalancing to optimize risk and return.
                </p>
                <button className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium transition-colors">
                  View Rebalancing Plan
                </button>
              </div>
            </div>
          </Card>
        )}

        {/* Empty State */}
        {placeholderValue && (
          <Card className="p-12">
            <EmptyState 
              message="No portfolio positions"
              description="Upload positions to view allocation analysis and rebalancing recommendations"
            />
          </Card>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
          </div>
        )}
      </div>
    </PageShell>
  );
};

export default AllocationRebalancePage;
