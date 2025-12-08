import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SectionHeader from "../../components/layout/SectionHeader";
import Card from "../../components/ui/Card";
import EmptyState from "../../components/ui/EmptyState";
import PageShell from "../../components/ui/PageShell";
import { portfolioApi } from "../../services/portfolioApi";
import { formatDateTick } from "../../utils/format";
import {
  AlphaSignalSummary,
  DEFAULT_LAGS,
  LagCorrelationRow,
  MicrostructureData,
  RollingCorrelationPoint,
  computeAlphaSignalSummary,
  computeLagCorrelations,
  computeMicrostructureSummary,
  computeRollingCorrelation,
} from "./microstructureAnalytics";

interface MicrostructureApiBar {
  timestamp: string;
  return_: number;
  next_return: number | null;
  volume: number;
  order_flow_proxy: number;
  spread_proxy?: number | null;
}

interface MicrostructureApiResponse {
  symbol: string;
  bar_interval: string;
  as_of?: string;
  bars: MicrostructureApiBar[];
}

interface FormState {
  symbol: string;
  startDate: string;
  endDate: string;
  interval: string;
}

type MetricTone = "neutral" | "positive" | "negative";

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const initialForm: FormState = {
  symbol: "SPY",
  startDate: daysAgo(90),
  endDate: today,
  interval: "1d",
};

const toDisplayNumber = (v: number | null | undefined): number | null => {
  if (v == null || Number.isNaN(v)) return null;
  return v;
};

const formatPercent = (v: number | null | undefined, digits = 2) => {
  const val = toDisplayNumber(v);
  return val == null ? "—" : `${(val * 100).toFixed(digits)}%`;
};

const formatCompactNumber = (v: number | null | undefined, digits = 1) => {
  const val = toDisplayNumber(v);
  if (val == null) return "—";
  const abs = Math.abs(val);
  if (abs >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${(val / 1_000).toFixed(digits)}K`;
  return val.toLocaleString(undefined, { maximumFractionDigits: digits });
};

const formatNumber = (v: number | null | undefined, digits = 2) => {
  const val = toDisplayNumber(v);
  return val == null ? "—" : val.toFixed(digits);
};

const formatBps = (v: number | null | undefined, digits = 1) => {
  const val = toDisplayNumber(v);
  return val == null ? "—" : `${val.toFixed(digits)} bps`;
};

const correlationTone = (v: number | null | undefined): MetricTone => {
  const val = toDisplayNumber(v);
  if (val == null) return "neutral";
  if (val > 0.1) return "positive";
  if (val < -0.1) return "negative";
  return "neutral";
};

const formatLocalTimestamp = (iso?: string) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
};

const formatDisplayDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const intervalLabel = (interval?: string) => (interval ? interval.toUpperCase() : "—");

const chartTooltipStyle = { backgroundColor: "#0b1220", borderColor: "#1f2937", borderRadius: 12 };

const MicroMetricCard = ({
  label,
  value,
  helper,
  badge,
  tooltip,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper: string;
  badge?: string;
  tooltip?: string;
  tone?: MetricTone;
}) => {
  const toneBorder =
    tone === "positive" ? "border-emerald-500/50" : tone === "negative" ? "border-rose-500/50" : "border-slate-800";
  return (
    <div className={`rounded-xl border ${toneBorder} bg-slate-900/70 px-4 py-3 shadow-sm transition hover:bg-slate-900`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-400">
          <span>{label}</span>
          {tooltip && (
            <span className="info-dot" title={tooltip}>
              i
            </span>
          )}
        </div>
        {badge && <span className="pill">{badge}</span>}
      </div>
      <div className="mt-2 text-lg font-semibold text-slate-50 leading-tight">{value}</div>
      <p className="mt-1 text-sm text-slate-400">{helper}</p>
    </div>
  );
};

const MetricSkeleton = () => (
  <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
    <div className="skeleton h-3 w-24 rounded-md" />
    <div className="mt-3 skeleton h-6 w-20 rounded-md" />
    <div className="mt-2 skeleton h-3 w-28 rounded-md" />
  </div>
);

const ChartCard = ({
  title,
  subtitle,
  onHelp,
  children,
  loading,
  showEmpty,
  emptyLabel,
}: {
  title: string;
  subtitle?: string;
  onHelp?: () => void;
  children: ReactNode;
  loading?: boolean;
  showEmpty?: boolean;
  emptyLabel?: string;
}) => (
  <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm">
    <div className="mb-3 flex items-start justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-slate-100">{title}</p>
        {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
      </div>
      {onHelp && (
        <button
          className="text-xs font-semibold text-slate-300 underline-offset-4 hover:text-slate-50 hover:underline"
          onClick={onHelp}
          type="button"
        >
          How are these computed?
        </button>
      )}
    </div>
    <div className="h-[260px]">
      {loading && showEmpty ? (
        <div className="skeleton h-full w-full rounded-lg" />
      ) : showEmpty ? (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          {emptyLabel || "No data available."}
        </div>
      ) : (
        children
      )}
    </div>
    {loading && !showEmpty && (
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-slate-900/10 to-slate-900/40" />
    )}
  </div>
);

const MicrostructureControls = ({
  formState,
  onChange,
  onRun,
  loading,
  lastUpdated,
}: {
  formState: FormState;
  onChange: (field: keyof FormState, value: string) => void;
  onRun: () => void;
  loading: boolean;
  lastUpdated?: string | null;
}) => {
  const disableRun = !formState.symbol || !formState.startDate || !formState.endDate;

  return (
    <Card className="sticky top-20 w-full rounded-2xl border border-slate-800 bg-slate-900/80 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="label-sm">Analysis parameters</p>
          <h3 className="card-title">Run a microstructure slice</h3>
          <p className="card-subtitle">Symbol, bar interval, and date window.</p>
        </div>
        {lastUpdated && <span className="text-xs text-slate-400">As of {lastUpdated}</span>}
      </div>
      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-400">Symbol</span>
          <input
            value={formState.symbol}
            onChange={(e) => onChange("symbol", e.target.value.toUpperCase())}
            placeholder="SPY"
          />
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-wide text-slate-400">Interval</span>
          <select value={formState.interval} onChange={(e) => onChange("interval", e.target.value)}>
            <option value="1d">1D bars</option>
          </select>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">Start date</span>
            <input type="date" value={formState.startDate} onChange={(e) => onChange("startDate", e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs uppercase tracking-wide text-slate-400">End date</span>
            <input type="date" value={formState.endDate} onChange={(e) => onChange("endDate", e.target.value)} />
          </div>
        </div>
        <button className={`btn ${disableRun ? "btn-ghost" : "btn-primary"}`} onClick={onRun} disabled={disableRun || loading}>
          <div className="flex items-center justify-center gap-2">
            {loading && <span className="spinner" />}
            {loading ? "Computing..." : "Run analysis"}
          </div>
        </button>
        <p className="muted">Microstructure stats are recomputed when you run the analysis.</p>
      </div>
    </Card>
  );
};

const MicrostructureMetricsPanel = ({
  summary,
  alphaSummary,
  loading,
  hasData,
}: {
  summary: MicrostructureSummaryMetrics | null;
  alphaSummary: AlphaSignalSummary | null;
  loading: boolean;
  hasData: boolean;
}) => {
  const hasAvgReturn = toDisplayNumber(summary?.avgReturn) != null;
  const hasVolReturn = toDisplayNumber(summary?.volReturn) != null;
  const hasReturnAutocorr = toDisplayNumber(summary?.returnAutocorrLag1) != null;
  const hasAvgVolume = toDisplayNumber(summary?.avgVolume) != null;
  const hasAvgOrderFlow = toDisplayNumber(summary?.avgOrderFlow) != null;
  const hasSpread = toDisplayNumber(summary?.avgSpreadBps) != null;
  const hasFlowCorr = toDisplayNumber(summary?.orderFlowVsNextReturnCorr) != null;
  const hasVolAutocorr = toDisplayNumber(summary?.volumeAutocorrLag1) != null;
  const hasR2 = toDisplayNumber(alphaSummary?.r2OrderFlowToNextReturn) != null;
  const hasBeta = toDisplayNumber(alphaSummary?.betaOrderFlowToNextReturn) != null;

  const sections = [
    {
      id: "returns",
      title: "Returns & risk",
      badge: "Risk",
      metrics: [
        {
          label: "Avg return",
          value: formatPercent(summary?.avgReturn, 3),
          helper: hasAvgReturn ? "Mean interval return over the selected window." : "No data",
          tooltip: "Average simple return per bar for the chosen period.",
          tone: correlationTone(summary?.avgReturn),
        },
        {
          label: "Return volatility",
          value: formatPercent(summary?.volReturn, 2),
          helper: hasVolReturn ? "Standard deviation of per-bar returns (not annualized)." : "No data",
          tooltip: "Population standard deviation of returns across bars.",
        },
        {
          label: "Return autocorr (lag 1)",
          value: summary?.returnAutocorrLag1 != null ? formatNumber(summary?.returnAutocorrLag1, 3) : "—",
          helper: hasReturnAutocorr ? "Correlation of returns with prior bar." : "No data",
          tooltip: "Autocorrelation of returns at a 1-bar lag.",
          tone: correlationTone(summary?.returnAutocorrLag1),
        },
      ],
    },
    {
      id: "liquidity",
      title: "Liquidity & size",
      badge: "Liquidity",
      metrics: [
        {
          label: "Avg volume",
          value: formatCompactNumber(summary?.avgVolume, 1),
          helper: hasAvgVolume ? "Average traded volume per bar." : "No data",
          tooltip: "Mean traded volume for each interval.",
        },
        {
          label: "Avg order flow",
          value: formatCompactNumber(summary?.avgOrderFlow, 1),
          helper: hasAvgOrderFlow ? "Buy minus sell volume proxy." : "No data",
          tooltip: "Average signed order flow proxy (buy minus sell volume).",
          tone: correlationTone(summary?.avgOrderFlow),
        },
        {
          label: "Avg spread (bps)",
          value: summary?.avgSpreadBps != null ? formatBps(summary?.avgSpreadBps, 2) : "—",
          helper: hasSpread ? "Mean bid-ask spread proxy in bps." : "No spread data available.",
          tooltip: "Average quoted bid-ask spread, scaled to basis points.",
          tone: summary?.avgSpreadBps != null && summary.avgSpreadBps > 40 ? "negative" : "neutral",
        },
      ],
    },
    {
      id: "structure",
      title: "Predictability / structure",
      badge: "Signal",
      metrics: [
        {
          label: "Order flow → next return corr",
          value: summary?.orderFlowVsNextReturnCorr != null ? formatNumber(summary?.orderFlowVsNextReturnCorr, 3) : "—",
          helper:
            hasFlowCorr ? "Correlation of current order flow with next-bar return." : "No data",
          tooltip: "Pearson correlation between order flow in bar t and return in bar t+1.",
          tone: correlationTone(summary?.orderFlowVsNextReturnCorr),
        },
        {
          label: "Volume autocorr (lag 1)",
          value: summary?.volumeAutocorrLag1 != null ? formatNumber(summary?.volumeAutocorrLag1, 3) : "—",
          helper: hasVolAutocorr ? "Stability of flow from bar to bar." : "No data",
          tooltip: "Autocorrelation of volume at a 1-bar lag.",
          tone: correlationTone(summary?.volumeAutocorrLag1),
        },
        {
          label: "Alpha R²",
          value: alphaSummary?.r2OrderFlowToNextReturn != null ? formatNumber(alphaSummary.r2OrderFlowToNextReturn, 3) : "—",
          helper:
            hasR2 ? "Variance explained by regressing next return on order flow." : "No data",
          tooltip: "R² from OLS: next return ~ order flow.",
          tone: correlationTone(alphaSummary?.r2OrderFlowToNextReturn),
        },
        {
          label: "Order flow beta",
          value:
            alphaSummary?.betaOrderFlowToNextReturn != null ? formatNumber(alphaSummary.betaOrderFlowToNextReturn, 4) : "—",
          helper:
            hasBeta ? "Slope of next return vs current order flow." : "No data",
          tooltip: "OLS beta from regressing next-bar return on current order flow.",
          tone: correlationTone(alphaSummary?.betaOrderFlowToNextReturn),
        },
      ],
    },
  ];

  const skeletons = Array.from({ length: 9 }, (_, i) => <MetricSkeleton key={`skeleton-${i}`} />);

  return (
    <Card className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg" title="Microstructure metrics" subtitle="Formatted stats across returns, liquidity, and signal quality.">
      {loading && !hasData ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{skeletons}</div>
      ) : hasData ? (
        <div className="flex flex-col gap-4">
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-slate-100">{section.title}</div>
                <span className="pill">{section.badge}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {section.metrics.map((metric) => (
                  <MicroMetricCard key={metric.label} {...metric} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No microstructure results yet"
          description="Choose a symbol and window, then run the analysis to populate metrics."
        />
      )}
    </Card>
  );
};

const MicrostructureCharts = ({
  series,
  scatterData,
  loading,
  hasData,
  onOpenMethodology,
}: {
  series: { date: string; return: number | null; next_return: number | null; volume: number; of: number }[];
  scatterData: { of: number; next: number }[];
  loading: boolean;
  hasData: boolean;
  onOpenMethodology: () => void;
}) => {
  const hasSeries = hasData && series.length > 0;
  const hasScatter = hasData && scatterData.length > 0;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard
          title="Returns & volume"
          subtitle="Bar returns overlaid with traded volume"
          onHelp={onOpenMethodology}
          loading={loading}
          showEmpty={!hasSeries}
          emptyLabel="Run the analysis to view returns and volume."
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ left: 6, right: 6, top: 6, bottom: 6 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateTick}
                minTickGap={24}
                stroke="#6b7280"
                label={{ value: "Date", position: "insideBottom", dy: 10, fill: "#94a3b8" }}
              />
              <YAxis
                yAxisId="left"
                stroke="#6b7280"
                tickFormatter={(v) => `${(v * 100).toFixed(1)}%`}
                label={{ value: "Return (%)", angle: -90, position: "insideLeft", fill: "#94a3b8", offset: 12 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#6b7280"
                label={{ value: "Volume", angle: 90, position: "insideRight", fill: "#94a3b8", offset: 6 }}
              />
              <Tooltip
                labelFormatter={formatDateTick}
                formatter={(val: any, name: any) =>
                  name === "volume"
                    ? [Number(val).toLocaleString(), "Volume"]
                    : [`${(Number(val) * 100).toFixed(2)}%`, name === "return" ? "Return" : name]
                }
                contentStyle={chartTooltipStyle}
              />
              <Legend />
              <Area
                yAxisId="left"
                type="monotone"
                dataKey="return"
                name="Return"
                stroke="#4f8cff"
                fill="#4f8cff33"
                dot={false}
              />
              <Bar yAxisId="right" dataKey="volume" name="Volume" fill="#22c55e66" />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Order flow proxy"
          subtitle="Signed flow per bar"
          onHelp={onOpenMethodology}
          loading={loading}
          showEmpty={!hasSeries}
          emptyLabel="Run the analysis to view order flow."
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ left: 6, right: 6, top: 6, bottom: 6 }}>
              <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateTick}
                minTickGap={24}
                stroke="#6b7280"
                label={{ value: "Date", position: "insideBottom", dy: 10, fill: "#94a3b8" }}
              />
              <YAxis
                stroke="#6b7280"
                label={{ value: "Order flow (shares)", angle: -90, position: "insideLeft", fill: "#94a3b8", offset: 12 }}
              />
              <Tooltip
                labelFormatter={formatDateTick}
                formatter={(val: any) => [Number(val).toLocaleString(), "Order flow proxy"]}
                contentStyle={chartTooltipStyle}
              />
              <Legend />
              <Area type="monotone" dataKey="of" name="Order flow" stroke="#f97316" fill="#f9731633" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <ChartCard
        title="Order flow vs next return"
        subtitle="Scatter of flow vs next-bar return"
        onHelp={onOpenMethodology}
        loading={loading}
        showEmpty={!hasScatter}
        emptyLabel="Run the analysis to view the flow/return scatter."
      >
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ left: 6, right: 6, top: 6, bottom: 6 }}>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="of"
              name="Order flow"
              stroke="#6b7280"
              label={{ value: "Order flow (shares)", position: "insideBottom", dy: 10, fill: "#94a3b8" }}
            />
            <YAxis
              dataKey="next"
              name="Next return"
              stroke="#6b7280"
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(2)}%`}
              label={{ value: "Next return (%)", angle: -90, position: "insideLeft", fill: "#94a3b8", offset: 12 }}
            />
            <Tooltip
              formatter={(val: any, name: any) =>
                name === "of" ? [Number(val).toLocaleString(), "Order flow"] : [`${(Number(val) * 100).toFixed(2)}%`, "Next return"]
              }
              contentStyle={chartTooltipStyle}
            />
            <Legend />
            <Scatter data={scatterData} fill="#8b5cf6" />
          </ScatterChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
};

const MicrostructureMethodology = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const sections = [
    {
      id: "returns",
      title: "Returns & volatility",
      body: "Returns are simple per-bar changes. Volatility uses population standard deviation of those returns; we do not annualize for intraday comparability.",
    },
    {
      id: "order-flow",
      title: "Order flow proxy",
      body: "Order flow is a signed proxy (buy volume minus sell volume) built from trade and quote imbalance. Positive numbers indicate buy pressure.",
    },
    {
      id: "correlations",
      title: "Correlations & autocorr",
      body: "We compute Pearson correlations between order flow and next-bar return, as well as autocorrelations for returns and volume at a 1-bar lag.",
    },
    {
      id: "alpha",
      title: "Alpha fit",
      body: "A simple OLS model regresses next-bar returns on current order flow, surfacing beta (slope) and R² as a quick predictability gauge.",
    },
    {
      id: "spread",
      title: "Spread proxy",
      body: "Avg spread (bps) is a quoted spread proxy scaled to basis points; higher values indicate wider markets and lower microstructure quality.",
    },
  ];

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="section-header" style={{ marginBottom: "8px" }}>
          <h4 className="section-title">Methodology</h4>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="simple-list" style={{ gap: "10px", display: "flex", flexDirection: "column" }}>
          {sections.map((s) => (
            <div key={s.id} id={s.id}>
              <p className="metric-label">{s.title}</p>
              <p className="muted" style={{ margin: "4px 0 0" }}>
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MicrostructurePage = () => {
  const [formState, setFormState] = useState<FormState>(initialForm);
  const [activeParams, setActiveParams] = useState<FormState>(initialForm);
  const [data, setData] = useState<MicrostructureApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showMethodology, setShowMethodology] = useState(false);

  const fetchMicrostructure = useCallback(async (params: FormState) => {
    setLoading(true);
    setError("");
    try {
      const res = await portfolioApi.runMicrostructure({
        symbol: params.symbol,
        start_date: params.startDate,
        end_date: params.endDate,
        bar_interval: params.interval,
      });
      setData(res);
      setActiveParams(params);
    } catch (err: any) {
      setError(err.message || "Failed to load microstructure analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMicrostructure(initialForm);
  }, [fetchMicrostructure]);

  const microData: MicrostructureData | null = useMemo(() => {
    if (!data) return null;
    return {
      symbol: data.symbol,
      interval: data.bar_interval || activeParams.interval,
      startDate: activeParams.startDate,
      endDate: activeParams.endDate,
      lastUpdated: data.as_of,
      points: (data.bars || []).map((b) => ({
        date: b.timestamp,
        return: b.return_,
        volume: b.volume,
        orderFlow: b.order_flow_proxy,
        nextReturn: b.next_return,
        spreadBps: b.spread_proxy != null ? b.spread_proxy * 10_000 : null,
      })),
    };
  }, [data, activeParams]);

  const summary = useMemo(() => (microData ? computeMicrostructureSummary(microData) : null), [microData]);
  const lagRows: LagCorrelationRow[] = useMemo(
    () => (microData ? computeLagCorrelations(microData, DEFAULT_LAGS) : []),
    [microData]
  );
  const alphaSummary: AlphaSignalSummary | null = useMemo(
    () => (microData ? computeAlphaSignalSummary(microData) : null),
    [microData]
  );
  const rollingCorr: RollingCorrelationPoint[] = useMemo(
    () => (microData ? computeRollingCorrelation(microData, 20) : []),
    [microData]
  );

  const series = useMemo(() => {
    if (!microData) return [];
    return microData.points.map((p) => ({
      date: p.date,
      return: p.return,
      next_return: p.nextReturn,
      volume: p.volume,
      of: p.orderFlow,
      spread: p.spreadBps,
    }));
  }, [microData]);

  const scatterData = useMemo(() => {
    if (!microData) return [];
    return microData.points
      .filter((p) => p.nextReturn != null)
      .map((p) => ({ of: p.orderFlow, next: p.nextReturn as number }));
  }, [microData]);

  const spreadSeries = useMemo(() => {
    if (!microData) return [];
    return microData.points.map((p) => ({
      date: p.date,
      spread: p.spreadBps,
    }));
  }, [microData]);

  const volumeProfile = useMemo(() => {
    if (!microData) return [];
    const buckets: Record<string, { hour: string; volume: number }> = {};
    microData.points.forEach((p) => {
      const d = new Date(p.date);
      const hour = Number.isNaN(d.getTime()) ? "00" : String(d.getHours()).padStart(2, "0");
      if (!buckets[hour]) buckets[hour] = { hour, volume: 0 };
      buckets[hour].volume += p.volume || 0;
    });
    return Object.values(buckets).sort((a, b) => Number(a.hour) - Number(b.hour));
  }, [microData]);

  const canExport = !!(microData && microData.points.length);

  const handleExport = () => {
    if (!canExport || !microData || !summary || !alphaSummary) return;
    const payload = {
      data: microData,
      summary,
      lagCorrelations: lagRows,
      alpha: alphaSummary,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const safeStart = microData.startDate?.replace(/[^0-9-]/g, "") || "start";
    const safeEnd = microData.endDate?.replace(/[^0-9-]/g, "") || "end";
    a.href = href;
    a.download = `${microData.symbol}_microstructure_${microData.interval}_${safeStart}_${safeEnd}.json`;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const lastUpdated = formatLocalTimestamp(microData?.lastUpdated);
  const effectiveSymbol = formState.symbol || activeParams.symbol;
  const effectiveInterval = formState.interval || activeParams.interval;
  const effectiveStart = formState.startDate || activeParams.startDate;
  const effectiveEnd = formState.endDate || activeParams.endDate;
  const contextLine = `Computed for ${effectiveSymbol} — ${intervalLabel(effectiveInterval)} bars — ${formatDisplayDate(
    effectiveStart
  )} to ${formatDisplayDate(effectiveEnd)}`;

  return (
    <PageShell
      title="Quant Lab – Market Structure"
      subtitle="Analyze spreads, volume, and microstructure behavior for a given symbol."
      contextStatus="paper"
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-lg">
          <SectionHeader
            overline="Microstructure Diagnostics"
            title="Intraday order-flow & microstructure stats for the selected symbol"
            subtitle={contextLine}
            actions={
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Link to="/quant/regimes" className="text-xs underline-offset-4 hover:underline text-slate-300">
                  Need volatility regimes? See Regimes →
                </Link>
                {lastUpdated && <span className="text-xs text-slate-400">Last updated: {lastUpdated}</span>}
                <button
                  className={`btn ${canExport ? "btn-primary" : "btn-ghost text-slate-400"}`}
                  onClick={handleExport}
                  disabled={!canExport}
                  title={canExport ? "Download analytics as JSON" : "Run a query first"}
                >
                  Export analytics
                </button>
              </div>
            }
          />
        </div>

        <div className="flex flex-col gap-5 xl:flex-row">
          <div className="w-full xl:w-[320px]">
            <MicrostructureControls
              formState={formState}
              onChange={(field, value) => setFormState((prev) => ({ ...prev, [field]: value }))}
              onRun={() => fetchMicrostructure(formState)}
              loading={loading}
              lastUpdated={lastUpdated}
            />
            {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
          </div>

          <div className="flex-1">
          <div className="flex flex-col gap-5">
            <MicrostructureMetricsPanel
              summary={summary}
              alphaSummary={alphaSummary}
              loading={loading}
              hasData={!!microData?.points.length}
            />

            <MicrostructureCharts
              series={series}
              scatterData={scatterData}
              loading={loading}
              hasData={!!microData?.points.length}
              onOpenMethodology={() => setShowMethodology(true)}
            />

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <Card title="Spread over time" subtitle="Bid-ask proxy in bps">
                {spreadSeries.length ? (
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={spreadSeries}>
                        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                        <XAxis dataKey="date" tickFormatter={formatDateTick} minTickGap={24} stroke="#6b7280" />
                        <YAxis stroke="#6b7280" label={{ value: "Spread (bps)", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
                        <Tooltip
                          labelFormatter={formatDateTick}
                          formatter={(val: any) => [`${Number(val).toFixed(2)} bps`, "Spread"]}
                          contentStyle={chartTooltipStyle}
                        />
                        <Line type="monotone" dataKey="spread" stroke="#a855f7" dot={false} strokeWidth={2} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="muted">Run the analysis to view spreads.</p>
                )}
              </Card>

              <Card title="Intraday volume profile" subtitle="Aggregate volume by hour">
                {volumeProfile.length ? (
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={volumeProfile}>
                        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                        <XAxis dataKey="hour" stroke="#6b7280" label={{ value: "Hour", position: "insideBottom", dy: 6, fill: "#94a3b8" }} />
                        <YAxis stroke="#6b7280" label={{ value: "Volume", angle: -90, position: "insideLeft", fill: "#94a3b8" }} />
                        <Tooltip formatter={(val: any) => [Number(val).toLocaleString(), "Volume"]} contentStyle={chartTooltipStyle} />
                        <Legend />
                        <Bar dataKey="volume" fill="#22c55e66" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="muted">Run the analysis to view intraday volume distribution.</p>
                )}
              </Card>
            </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg"
                  title="Rolling OF → next return correlation (20-bar)"
                  subtitle="How stable is the flow/return relationship over time?"
                >
                  {rollingCorr.length ? (
                    <div style={{ height: 200 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={rollingCorr} margin={{ left: 6, right: 6, top: 6, bottom: 0 }}>
                          <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                          <XAxis dataKey="date" tickFormatter={formatDateTick} minTickGap={24} stroke="#6b7280" />
                          <YAxis stroke="#6b7280" tickFormatter={(v) => Number(v).toFixed(2)} domain={[-1, 1]} />
                          <Tooltip
                            labelFormatter={formatDateTick}
                            formatter={(val: any) => [Number(val).toFixed(3), "Rolling corr"]}
                            contentStyle={chartTooltipStyle}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="correlation" name="Corr" stroke="#38bdf8" dot={false} strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="muted">Not enough data to compute rolling correlations.</p>
                  )}
                </Card>

                <Card
                  className="rounded-2xl border border-slate-800 bg-slate-900/60 shadow-lg"
                  title="Order flow predictive power (lag analysis)"
                  subtitle="Correlation between order flow at time t and returns at time t + lag."
                >
                  {lagRows.length ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-slate-300">
                        <thead className="text-xs uppercase text-slate-400">
                          <tr className="border-b border-slate-800">
                            <th className="py-2 pr-4 text-left">Lag (intervals)</th>
                            <th className="py-2 text-left">Corr(order flow, future return)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {lagRows.map((row) => (
                            <tr key={row.lag} className="border-b border-slate-900/60">
                              <td className="py-2 pr-4">{row.lag}</td>
                              <td className="py-2">
                                {row.orderFlowVsReturnCorr != null ? row.orderFlowVsReturnCorr.toFixed(3) : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted">Run an analysis to see the lag structure.</p>
                  )}
                </Card>
              </div>
            </div>
          </div>
        </div>
      </div>

      <MicrostructureMethodology open={showMethodology} onClose={() => setShowMethodology(false)} />
    </PageShell>
  );
};

export default MicrostructurePage;
