import React, { useCallback, useEffect, useMemo, useState } from "react";

// Fallback ticker data in case API is unavailable
const FALLBACK_TICKERS = [
  { symbol: "SPY", last: 475.32, change_pct: 1.23 },
  { symbol: "QQQ", last: 398.10, change_pct: 1.78 },
  { symbol: "IWM", last: 192.45, change_pct: -0.42 },
  { symbol: "^VIX", last: 14.20, change_pct: -3.10 },
];

function getEasternDate(date) {
  // Convert to US/Eastern without extra deps
  return new Date(
    date.toLocaleString("en-US", { timeZone: "America/New_York" })
  );
}

function formatEasternDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }); // e.g. "Mon, Dec 1, 2025"
}

function isUsMarketOpen(eastern) {
  const day = eastern.getDay(); // 0=Sun, 6=Sat
  const hours = eastern.getHours();
  const minutes = eastern.getMinutes();

  const isWeekday = day >= 1 && day <= 5;
  const afterOpen = hours > 9 || (hours === 9 && minutes >= 30); // 09:30
  const beforeClose = hours < 16 || (hours === 16 && minutes === 0); // 16:00

  return isWeekday && afterOpen && beforeClose;
}

export const MarketStatusTicker = () => {
  const [now, setNow] = useState(() => new Date());
  const [tickerIndex, setTickerIndex] = useState(0);
  const [fade, setFade] = useState(false);

  // Live data state
  const [tickers, setTickers] = useState(FALLBACK_TICKERS);
  const [asOf, setAsOf] = useState(null);
  const [error, setError] = useState(null);

  // Fetch market snapshot from API
  const fetchSnapshot = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/market/snapshot");
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.tickers && data.tickers.length > 0) {
        setTickers(data.tickers);
        setAsOf(data.as_of);
      }
    } catch (err) {
      console.error("Failed to fetch market snapshot", err);
      setError("snapshot_failed");
      // Keep current tickers / fallback
    }
  }, []);

  // Initial fetch + polling every 60 seconds
  useEffect(() => {
    fetchSnapshot();
    const id = setInterval(fetchSnapshot, 60_000);
    return () => clearInterval(id);
  }, [fetchSnapshot]);

  // Update current time every 30 seconds
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // Rotate ticker every 4 seconds
  useEffect(() => {
    const rotate = setInterval(() => {
      setFade(true);
      // short fade out, then swap ticker, then fade in
      setTimeout(() => {
        setTickerIndex((prev) => (prev + 1) % tickers.length);
        setFade(false);
      }, 150);
    }, 4000);
    return () => clearInterval(rotate);
  }, [tickers.length]);

  const eastern = useMemo(() => getEasternDate(now), [now]);
  const formattedDate = useMemo(() => formatEasternDate(eastern), [eastern]);
  const marketOpen = useMemo(() => isUsMarketOpen(eastern), [eastern]);

  const activeTicker = tickers[tickerIndex];
  const positive = activeTicker.change_pct > 0;
  const negative = activeTicker.change_pct < 0;

  const statusLabel = marketOpen ? "US MARKET: OPEN" : "US MARKET: CLOSED";
  const statusColor = marketOpen ? "text-emerald-300" : "text-slate-400";
  const dotColor = marketOpen ? "bg-emerald-400" : "bg-slate-500";
  const dotGlow = marketOpen ? "shadow-[0_0_6px_rgba(16,185,129,0.7)]" : "";

  return (
    <div className="inline-flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-[11px] md:text-xs shadow-sm shadow-black/40">
      {/* Line 1: Date + Status */}
      <div className="flex items-center gap-2">
        <span className="text-slate-300 font-medium">{formattedDate}</span>
        <span className="h-3 w-px bg-slate-700/80" />
        <div className="flex items-center gap-1.5">
          <span
            className={`h-2 w-2 rounded-full ${dotColor} ${dotGlow}`}
          />
          <span
            className={`tracking-wide font-semibold uppercase ${statusColor}`}
          >
            {statusLabel}
          </span>
        </div>
        {error && (
          <span className="text-[9px] text-slate-500">(offline)</span>
        )}
      </div>

      {/* Line 2: Rotating ticker */}
      <div className="flex items-center gap-2 text-[10px] md:text-[11px] text-slate-300">
        <span className="text-slate-500 uppercase tracking-wide">Indices</span>
        <span className="h-3 w-px bg-slate-700/80" />
        <div
          className={`flex items-baseline gap-1 transition-opacity duration-150 ${
            fade ? "opacity-0 translate-y-0.5" : "opacity-100"
          }`}
        >
          <span className="font-semibold text-slate-100">
            {activeTicker.symbol}
          </span>
          <span className="text-slate-400">
            {activeTicker.last.toFixed(2)}
          </span>
          <span
            className={`font-medium ${
              positive
                ? "text-emerald-400"
                : negative
                ? "text-red-400"
                : "text-slate-300"
            }`}
          >
            {positive && "+"}
            {activeTicker.change_pct.toFixed(2)}%
          </span>
        </div>
        {asOf && (
          <span className="text-[9px] text-slate-500 ml-1">
            {new Date(asOf).toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "America/New_York",
            })} ET
          </span>
        )}
      </div>
    </div>
  );
};

export default MarketStatusTicker;
