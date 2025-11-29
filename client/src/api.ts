const envBase = import.meta.env.VITE_API_BASE_URL;
const fallbackBase = typeof window !== "undefined" ? window.location.origin : "http://127.0.0.1:8000";
const baseUrl = (envBase || fallbackBase).replace(/\/$/, "");

const request = async (path: string, options: RequestInit = {}) => {
  const res = await fetch(`${baseUrl}${path}`, options);
  if (!res.ok) {
    const msg = await res.text();
    throw new Error(msg || `Request failed: ${res.status}`);
  }
  return res.json();
};

export const api = {
  listPresets: () => request("/api/presets"),
  savePreset: (payload: any) =>
    request("/api/presets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  deletePreset: (name: string) => request(`/api/presets/${encodeURIComponent(name)}`, { method: "DELETE" }),
  uploadPositions: (formData: FormData) =>
    request("/api/upload-positions", { method: "POST", body: formData }),
  portfolioMetrics: (payload: any) =>
    request("/api/portfolio-metrics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  backtest: (payload: any) =>
    request("/api/backtest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  strategyBuilder: (payload: any) =>
    request("/api/strategy-builder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  factorExposures: (payload: any) =>
    request("/api/factor-exposures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  riskBreakdown: (payload: any) =>
    request("/api/risk-breakdown", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  benchmark: (payload: any) =>
    request("/api/benchmark", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  monteCarlo: (payload: any) =>
    request("/api/monte-carlo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  stressTest: (payload: any) =>
    request("/api/stress-test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  efficientFrontier: (payload: any) =>
    request("/api/efficient-frontier", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  positionSizing: (payload: any) =>
    request("/api/position-sizing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  rebalance: (payload: any) =>
    request("/api/rebalance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
  portfolioDashboard: (payload: any) =>
    request("/api/portfolio-dashboard", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }),
};
