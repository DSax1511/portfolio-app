import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "../../components/ui/Card";
import PageShell from "../../components/ui/PageShell";
import { EXECUTION_PRESET_OPTIONS, getExecutionPresetConfig } from "../../utils/executionPresets";

const VENUE_OPTIONS = ["NASDAQ", "NYSE", "ARCA", "EDGX", "IEX", "Dark pool"];
const ALGORITHMS = ["TWAP", "VWAP", "POV", "Implementation Shortfall", "Liquidity Seeking"];
const IMPACT_MODELS = ["Linear", "Square root", "Temporary + permanent"];

const defaultSettings = {
  symbol: "SPY",
  notional: 500000,
  side: "Buy",
  algorithm: "TWAP",
  startTime: "09:30",
  endTime: "10:30",
  urgency: 3,
  participationRate: 10,
  maxChildSize: 5000,
  routingPreference: "Lit only",
  venues: ["NASDAQ", "NYSE", "ARCA"],
  latencyMs: 5,
  impactModel: "Linear",
};

const parseTime = (t) => {
  if (!t || typeof t !== "string" || !t.includes(":")) return NaN;
  const [h, m] = t.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return NaN;
  return h * 60 + m;
};

const formatTimeLabel = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const randomWalkPrices = (steps, basePrice, urgency) => {
  const series = [];
  let mid = basePrice;
  const vol = 0.0005 * urgency;
  for (let i = 0; i < steps; i++) {
    const shock = (Math.random() - 0.5) * vol;
    mid = mid * (1 + shock);
    const spreadHalf = 0.02 * (1 + urgency * 0.25);
    series.push({ mid, bid: mid - spreadHalf, ask: mid + spreadHalf });
  }
  return series;
};

const uShapeVolumeProfile = (steps, totalVolume) => {
  const weights = [];
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1 || 1);
    const w = 0.6 + 0.4 * Math.cos(Math.PI * (x * 2 - 1)); // U-shaped
    weights.push(Math.max(w, 0.1));
  }
  const sum = weights.reduce((s, w) => s + w, 0) || 1;
  return weights.map((w) => (w / sum) * totalVolume);
};

const sign = (side) => (side === "Buy" ? 1 : -1);

const computeCorrelation = (xArr, yArr) => {
  if (!xArr.length || xArr.length !== yArr.length) return null;
  const n = xArr.length;
  const meanX = xArr.reduce((s, v) => s + v, 0) / n;
  const meanY = yArr.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let denX = 0;
  let denY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xArr[i] - meanX;
    const dy = yArr[i] - meanY;
    num += dx * dy;
    denX += dx * dx;
    denY += dy * dy;
  }
  const den = Math.sqrt(denX * denY);
  if (den === 0) return null;
  return num / den;
};

const runSimulation = (settings) => {
  const startMin = parseTime(settings.startTime);
  const endMin = parseTime(settings.endTime);
  if (!Number.isFinite(startMin) || !Number.isFinite(endMin) || endMin <= startMin) {
    throw new Error("Invalid start/end time for simulation");
  }
  const rawSpan = Math.max(1, endMin - startMin);
  const steps = Math.max(20, Math.min(120, rawSpan)); // clamp steps to avoid heavy compute
  const timeStep = rawSpan / Math.max(steps - 1, 1);

  const basePrice = Math.max(1, 100 + (settings.symbol?.charCodeAt?.(0) || 0));
  const priceSeriesRaw = randomWalkPrices(steps, basePrice, settings.urgency);
  const timeSeries = Array.from({ length: steps }, (_, i) => {
    const t = startMin + i * timeStep;
    const timeLabel = formatTimeLabel(Math.round(t));
    const p = priceSeriesRaw[i];
    return {
      t: i,
      timeLabel,
      mid: p.mid,
      bid: p.bid,
      ask: p.ask,
    };
  });

  const arrivalPrice = timeSeries[0]?.mid || basePrice;
  const parentShares = settings.notional / Math.max(arrivalPrice, 1);
  const totalVol = parentShares * 3; // synthetic market volume multiple
  const volumeProfile = uShapeVolumeProfile(steps, totalVol);

  // Determine child sizes per step
  const childSizes = new Array(steps).fill(0);
  let remaining = parentShares;
  for (let i = 0; i < steps; i++) {
    if (remaining <= 0) break;
    let child = 0;
    switch (settings.algorithm) {
      case "TWAP":
        child = parentShares / steps;
        break;
      case "VWAP":
        child = (volumeProfile[i] / volumeProfile.reduce((s, v) => s + v, 0)) * parentShares * 1.05;
        break;
      case "POV":
        child = (settings.participationRate / 100) * volumeProfile[i];
        break;
      case "Implementation Shortfall":
        child = (parentShares * 0.5) / Math.max(steps * 0.4, 1) * Math.exp(-i / steps);
        break;
      case "Liquidity Seeking":
        child = parentShares / steps;
        if (i > 0 && sign(settings.side) * (timeSeries[i].mid - timeSeries[i - 1].mid) < 0) {
          child *= 1.4; // more when price moves in our favor
        }
        break;
      default:
        child = parentShares / steps;
    }
    child = Math.min(child, settings.maxChildSize || child, remaining);
    childSizes[i] = child;
    remaining -= child;
  }
  // If leftover, sprinkle
  for (let i = steps - 1; i >= 0 && remaining > 0; i--) {
    const add = Math.min(remaining, parentShares * 0.02);
    childSizes[i] += add;
    remaining -= add;
  }

  // Generate fills and metrics
  const fills = [];
  let executedShares = 0;
  let notionalFilled = 0;
  let ofArr = [];
  let nextRetArr = [];
  for (let i = 0; i < steps; i++) {
    const size = childSizes[i];
    if (size <= 0) continue;
    const point = timeSeries[i];
    const basePriceFill = settings.side === "Buy" ? point.ask : point.bid;
    const impactFactor =
      settings.impactModel === "Square root"
        ? Math.sqrt(size / parentShares) * 0.0005
        : settings.impactModel === "Temporary + permanent"
        ? (size / parentShares) * 0.0004 + 0.0002
        : (size / parentShares) * 0.0003;
    const latencyImpact = (settings.latencyMs || 0) * 0.00001;
    const slippage = (impactFactor + latencyImpact) * sign(settings.side);
    const price = basePriceFill * (1 + slippage);

    fills.push({
      t: i,
      timeLabel: point.timeLabel,
      price,
      size,
      side: settings.side,
    });
    executedShares += size;
    notionalFilled += price * size;

    const nextRet = i < steps - 1 ? Math.log(timeSeries[i + 1].mid / point.mid) : null;
    const ofProxy = sign(settings.side) * size;
    ofArr.push(ofProxy);
    if (nextRet != null) nextRetArr.push(nextRet);
  }

  const avgFillPrice = executedShares ? notionalFilled / executedShares : arrivalPrice;
  const isBps = ((avgFillPrice - arrivalPrice) / arrivalPrice) * 10000 * sign(settings.side);
  const isCash = (isBps / 10000) * settings.notional;
  const fillPct = (executedShares / parentShares) * 100;

  const vwapPrice =
    volumeProfile.reduce((s, v, idx) => s + timeSeries[idx].mid * v, 0) / (volumeProfile.reduce((s, v) => s + v, 0) || 1);
  const twapPrice = timeSeries.reduce((s, p) => s + p.mid, 0) / (timeSeries.length || 1);

  const slippageArrival = isBps;
  const slippageVwap = ((avgFillPrice - vwapPrice) / vwapPrice) * 10000 * sign(settings.side);
  const slippageTwap = ((avgFillPrice - twapPrice) / twapPrice) * 10000 * sign(settings.side);

  const progress = [];
  let cum = 0;
  for (let i = 0; i < steps; i++) {
    cum += childSizes[i] || 0;
    progress.push({
      t: i,
      timeLabel: timeSeries[i].timeLabel,
      progressPct: Math.min(100, (cum / parentShares) * 100),
    });
  }

  const impactSeries = timeSeries.map((p) => ({
    timeLabel: p.timeLabel,
    impactBps: ((p.mid - arrivalPrice) / arrivalPrice) * 10000 * sign(settings.side),
  }));
  const maxTempImpact = Math.max(...impactSeries.map((d) => d.impactBps));
  const permanentImpact = impactSeries[impactSeries.length - 1]?.impactBps || 0;

  const venueBreakdown = (settings.venues.length ? settings.venues : VENUE_OPTIONS).map((v) => ({
    venue: v,
    pct: Math.max(2, 100 / (settings.venues.length || VENUE_OPTIONS.length) + (Math.random() - 0.5) * 8),
  }));
  const pctSum = venueBreakdown.reduce((s, v) => s + v.pct, 0) || 1;
  venueBreakdown.forEach((v) => (v.pct = (v.pct / pctSum) * 100));

  const benchmarks = [
    { strategy: settings.algorithm, avgFillPrice, slippageArrivalBps: slippageArrival, slippageVwapBps: slippageVwap, implementationShortfallBps: isBps },
    { strategy: "TWAP (benchmark)", avgFillPrice: twapPrice * (1 + 0.0002 * sign(settings.side)), slippageArrivalBps: slippageArrival + 2, slippageVwapBps: slippageVwap + 1, implementationShortfallBps: isBps + 2 },
    { strategy: "VWAP (benchmark)", avgFillPrice: vwapPrice * (1 + 0.0001 * sign(settings.side)), slippageArrivalBps: slippageArrival + 1, slippageVwapBps: slippageVwap + 0.5, implementationShortfallBps: isBps + 1 },
  ];

  const ofCorr = computeCorrelation(ofArr.slice(0, nextRetArr.length), nextRetArr);

  return {
    timeSeries,
    fills,
    progress,
    metrics: {
      implementationShortfallBps: isBps,
      implementationShortfallCash: isCash,
      avgSlippageArrivalBps: slippageArrival,
      slippageVwapBps: slippageVwap,
      slippageTwapBps: slippageTwap,
      fillPct,
      maxTemporaryImpactBps: maxTempImpact,
      permanentImpactBps: permanentImpact,
      avgFillPrice,
      arrivalPrice,
      parentShares,
    },
    benchmarks,
    venueBreakdown,
    impactSeries,
    ofCorrelation: ofCorr,
  };
};

const ExecutionSimulatorPage = () => {
  const [settings, setSettings] = useState(defaultSettings);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");

  const handleChange = (key) => (e) => {
    const value = e.target.type === "number" ? Number(e.target.value) : e.target.value;
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleCheckbox = (venue) => (e) => {
    setSettings((prev) => {
      const set = new Set(prev.venues || []);
      if (e.target.checked) set.add(venue);
      else set.delete(venue);
      return { ...prev, venues: Array.from(set) };
    });
  };

  const applyPreset = (presetId) => {
    if (!presetId) {
      setSelectedPreset("");
      return;
    }
    try {
      const preset = getExecutionPresetConfig(presetId);
      setSettings((prev) => ({
        ...prev,
        notional: preset.notional,
        algorithm: preset.algorithm,
        participationRate: preset.participationRate,
        urgency: preset.urgency,
        maxChildSize: preset.maxChildSize,
        latencyMs: preset.latencyMs,
        routingPreference: preset.routingPreference,
        impactModel: preset.impactModel,
        venues: preset.venues,
        side: preset.side,
      }));
      setSelectedPreset(presetId);
    } catch (err) {
      console.warn(err);
    }
  };

  const handlePresetChange = (event) => {
    const value = event.target.value;
    applyPreset(value);
  };

  const handleRun = () => {
    setError("");
    setLoading(true);
    setTimeout(() => {
      try {
        const sim = runSimulation(settings);
        setResult(sim);
      } catch (e) {
        setResult(null);
        setError(e?.message || "Simulation failed. Check inputs and try again.");
      } finally {
        setLoading(false);
      }
    }, 50);
  };

  const priceChartData = useMemo(() => {
    if (!result) return [];
    const fillMap = new Map(result.fills.map((f) => [f.t, f]));
    return result.timeSeries
      .filter((p) => Number.isFinite(p.mid) && Number.isFinite(p.bid) && Number.isFinite(p.ask))
      .map((p) => {
        const fill = fillMap.get(p.t);
        return {
          ...p,
          fillPrice: Number.isFinite(fill?.price) ? fill.price : undefined,
          fillSize: Number.isFinite(fill?.size) ? fill.size : undefined,
        };
      });
  }, [result]);

  return (
    <PageShell
      section="Quant Lab"
      title="Execution Lab"
      subtitle="Simulate order execution, fills, and slippage across venues."
      contextStatus="paper"
    >
      <p className="muted" style={{ marginTop: "-4px" }}>
        Offline simulator using synthetic intraday/microstructure patterns to visualize price path, fills, venue allocation, and impact.
      </p>
      <div className="analytics-grid" style={{ gridTemplateColumns: "380px 1fr", alignItems: "start" }}>
        <Card title="Simulation settings">
          <div className="analytics-form">
            <div className="form-row">
              <label>
                Preset
                <select value={selectedPreset} onChange={handlePresetChange}>
                  <option value="">Custom</option>
                  {EXECUTION_PRESET_OPTIONS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Symbol
                <input value={settings.symbol} onChange={handleChange("symbol")} />
              </label>
              <label>
                Side
                <select value={settings.side} onChange={handleChange("side")}>
                  <option>Buy</option>
                  <option>Sell</option>
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Notional ($)
                <input type="number" value={settings.notional} onChange={handleChange("notional")} />
              </label>
              <label>
                Algorithm
                <select value={settings.algorithm} onChange={handleChange("algorithm")}>
                  {ALGORITHMS.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <label>
                Start time
                <input type="time" value={settings.startTime} onChange={handleChange("startTime")} />
              </label>
              <label>
                End time
                <input type="time" value={settings.endTime} onChange={handleChange("endTime")} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Urgency: {settings.urgency} ({settings.urgency <= 2 ? "Passive" : settings.urgency >= 4 ? "Aggressive" : "Neutral"})
                <input type="range" min={1} max={5} value={settings.urgency} onChange={handleChange("urgency")} />
              </label>
              <label>
                Participation rate (%)
                <input
                  type="number"
                  value={settings.participationRate}
                  onChange={handleChange("participationRate")}
                  disabled={settings.algorithm !== "POV"}
                />
              </label>
            </div>
            <div className="form-row">
              <label>
                Max child size (shares)
                <input type="number" value={settings.maxChildSize} onChange={handleChange("maxChildSize")} />
              </label>
              <label>
                Latency (ms)
                <input type="number" value={settings.latencyMs} onChange={handleChange("latencyMs")} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Routing preference
                <select value={settings.routingPreference} onChange={handleChange("routingPreference")}>
                  <option>Lit only</option>
                  <option>Dark + Lit</option>
                  <option>Dark only</option>
                </select>
              </label>
              <label>
                Impact model
                <select value={settings.impactModel} onChange={handleChange("impactModel")}>
                  {IMPACT_MODELS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="form-row">
              <div>
                <p className="metric-label">Venues</p>
                <div className="simple-list">
                  {VENUE_OPTIONS.map((v) => (
                    <label key={v} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.9rem" }}>
                      <input type="checkbox" checked={settings.venues.includes(v)} onChange={handleCheckbox(v)} />
                      <span>{v}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button className="btn btn-primary" type="button" onClick={handleRun} disabled={loading}>
              {loading ? "Running..." : "Run simulation"}
            </button>
            {error && <p className="error-text" style={{ marginTop: "0.25rem" }}>{error}</p>}
          </div>
        </Card>

        <div className="page-layout" style={{ gap: "1rem" }}>
          <Card
            title="Price path & fills"
            subtitle="Mid/bid/ask with fill markers"
            actions={
              result?.fills?.length ? (
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    const header = ["time", "price", "size", "venue", "side"];
                    const csv = [header.join(","), ...result.fills.map((f) => [f.timeLabel, f.price, f.size, f.venue, f.side].join(","))].join("\n");
                    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "execution_fills.csv";
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export fills
                </button>
              ) : null
            }
          >
            {result ? (
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={priceChartData} margin={{ left: 8, right: 8, top: 8, bottom: 0 }}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="timeLabel" minTickGap={20} stroke="#6b7280" />
                    <YAxis stroke="#6b7280" />
                    <Tooltip
                      formatter={(val, name) =>
                        name === "fillPrice" ? [`$${val.toFixed(2)}`, "Fill"] : [`$${val.toFixed(2)}`, name.toUpperCase()]
                      }
                      contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="mid" name="Mid" stroke="#4f8cff" dot={false} />
                    <Line type="monotone" dataKey="bid" name="Bid" stroke="#22c55e" dot={false} strokeDasharray="4 3" />
                    <Line type="monotone" dataKey="ask" name="Ask" stroke="#ef4444" dot={false} strokeDasharray="4 3" />
                    <Scatter dataKey="fillPrice" name="Fills" fill="#fbbf24" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="muted">Run a simulation to see price and fills.</p>
            )}
          </Card>

          <Card title="Execution progress" subtitle="Cumulative completion over time">
            {result ? (
              <div style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={result.progress}>
                    <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                    <XAxis dataKey="timeLabel" minTickGap={20} stroke="#6b7280" />
                    <YAxis stroke="#6b7280" domain={[0, 100]} />
                    <Tooltip
                      formatter={(val) => [`${val.toFixed(1)}%`, "Progress"]}
                      contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="progressPct" name="Progress" stroke="#8b5cf6" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="muted">Run a simulation to view completion curve.</p>
            )}
          </Card>

          <div className="analytics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "1rem" }}>
            <Card title="Venue allocation" subtitle="Fill distribution by venue">
              {result ? (
                <div style={{ height: 220 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={result.venueBreakdown}>
                      <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                      <XAxis dataKey="venue" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip
                        formatter={(val) => [`${val.toFixed(1)}%`, "Allocation"]}
                        contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                      />
                      <Legend />
                      <Bar dataKey="pct" name="Allocation" fill="#06b6d4" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="muted">Run a simulation to allocate fills across venues.</p>
              )}
            </Card>

            <Card title="Impact & slippage" subtitle="Temporary/permanent and IS/arrival">
              {result ? (
                <>
                  <div className="stats-grid">
                    <div className="stat-box">
                      <p className="metric-label">IS (bps)</p>
                      <div className="metric-value">{result.metrics.implementationShortfallBps.toFixed(2)}</div>
                    </div>
                    <div className="stat-box">
                      <p className="metric-label">IS ($)</p>
                      <div className="metric-value">${result.metrics.implementationShortfallCash.toFixed(2)}</div>
                    </div>
                    <div className="stat-box">
                      <p className="metric-label">Slippage vs VWAP</p>
                      <div className="metric-value">{result.metrics.slippageVwapBps.toFixed(2)} bps</div>
                    </div>
                    <div className="stat-box">
                      <p className="metric-label">Slippage vs TWAP</p>
                      <div className="metric-value">{result.metrics.slippageTwapBps.toFixed(2)} bps</div>
                    </div>
                    <div className="stat-box">
                      <p className="metric-label">Temp impact</p>
                      <div className="metric-value">{result.metrics.maxTemporaryImpactBps.toFixed(2)} bps</div>
                    </div>
                    <div className="stat-box">
                      <p className="metric-label">Permanent impact</p>
                      <div className="metric-value">{result.metrics.permanentImpactBps.toFixed(2)} bps</div>
                    </div>
                  </div>
                  <div style={{ height: 150, marginTop: "0.5rem" }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.impactSeries}>
                        <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
                        <XAxis dataKey="timeLabel" minTickGap={20} stroke="#6b7280" />
                        <YAxis stroke="#6b7280" />
                        <Tooltip
                          formatter={(val) => [`${val.toFixed(2)} bps`, "Impact"]}
                          contentStyle={{ backgroundColor: "#0b1220", borderColor: "#1f2937" }}
                        />
                        <Legend />
                        <Line type="monotone" dataKey="impactBps" name="Impact vs arrival (bps)" stroke="#f97316" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="muted">Run a simulation to view impact and slippage.</p>
              )}
            </Card>
          </div>

          <Card title="Benchmarks & quality" subtitle="Compare against VWAP/TWAP baselines">
            {result ? (
              <>
                <div className="stats-grid" style={{ marginBottom: "0.75rem" }}>
                  <div className="stat-box">
                    <p className="metric-label">Arrival price</p>
                    <div className="metric-value">${result.metrics.arrivalPrice.toFixed(2)}</div>
                  </div>
                  <div className="stat-box">
                    <p className="metric-label">Avg fill</p>
                    <div className="metric-value">${result.metrics.avgFillPrice.toFixed(2)}</div>
                  </div>
                  <div className="stat-box">
                    <p className="metric-label">Fill %</p>
                    <div className="metric-value">{result.metrics.fillPct.toFixed(1)}%</div>
                  </div>
                  <div className="stat-box">
                    <p className="metric-label">OF vs next ret corr</p>
                    <div className="metric-value">{result.ofCorrelation != null ? result.ofCorrelation.toFixed(2) : "—"}</div>
                  </div>
                </div>
                <div className="table-wrapper compact-table dense">
                  <table>
                    <thead>
                      <tr>
                        <th>Strategy</th>
                        <th className="numeric">Avg fill</th>
                        <th className="numeric">Arrival slippage</th>
                        <th className="numeric">VWAP slippage</th>
                        <th className="numeric">IS (bps)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.benchmarks.map((b) => (
                        <tr key={b.strategy}>
                          <td>{b.strategy}</td>
                          <td className="numeric">${b.avgFillPrice.toFixed(2)}</td>
                          <td className="numeric">{b.slippageArrivalBps.toFixed(2)} bps</td>
                          <td className="numeric">{b.slippageVwapBps.toFixed(2)} bps</td>
                          <td className="numeric">{b.implementationShortfallBps.toFixed(2)} bps</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="muted">Run a simulation to populate benchmark comparisons.</p>
            )}
          </Card>
        </div>
      </div>
    </PageShell>
  );
};

export default ExecutionSimulatorPage;
export { ExecutionSimulatorPage };
