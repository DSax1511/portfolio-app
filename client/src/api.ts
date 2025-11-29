const inferBaseUrl = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBase) return envBase;
  if (typeof window === "undefined") return "http://127.0.0.1:8000";
  const { origin, hostname, port, protocol } = window.location;
  const devPorts = ["5173", "4173", "3000"];
  if (port && devPorts.includes(port)) {
    return `${protocol}//${hostname}:8000`;
  }
  // default: same-origin (useful when frontend is reverse-proxied with the API)
  return origin;
};

const baseUrl = inferBaseUrl().replace(/\/$/, "");

const normalizeError = async (res: Response) => {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      // FastAPI errors usually return {"detail": "..."}
      if (data?.detail) return `${res.status} ${res.statusText}: ${data.detail}`;
      return `${res.status} ${res.statusText}: ${JSON.stringify(data)}`;
    } catch {
      /* fall through */
    }
  }
  const text = await res.text();
  return text ? `${res.status} ${res.statusText}: ${text}` : `${res.status} ${res.statusText}`;
};

const request = async (path: string, options: RequestInit = {}) => {
  try {
    const res = await fetch(`${baseUrl}${path}`, options);
    if (!res.ok) {
      const msg = await normalizeError(res);
      throw new Error(msg);
    }
    return res.json();
  } catch (err: any) {
    // Provide a clearer network/CORS error to the UI.
    if (err?.name === "TypeError" && err?.message?.toLowerCase().includes("fetch")) {
      throw new Error(`Network error. Check backend (${baseUrl}), CORS, or if the server is running.`);
    }
    throw err;
  }
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
