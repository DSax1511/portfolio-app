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

  if (!activeTicker) {
    return null;
  }

  return (
    <div className="inline-flex flex-col gap-1.5 rounded-2xl border border-slate-800 bg-slate-900/85 px-4 py-2 shadow-[0_0_24px_rgba(15,23,42,0.7)] text-xs min-w-[280px] max-w-[360px]">
      {/* Top line: date + market status */}
      <div className="flex items-center gap-2">
        <span className="text-slate-200 font-medium whitespace-nowrap">
          {formattedDate}
        </span>
        <span className="text-slate-600">·</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${
              marketOpen
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                : "bg-slate-500"
            }`}
          />
          <span
            className={`uppercase tracking-wide font-semibold text-[11px] ${
              marketOpen ? "text-emerald-300" : "text-slate-400"
            }`}
          >
            US MARKET: {marketOpen ? "OPEN" : "CLOSED"}
          </span>
        </div>
      </div>

      {/* Bottom line: indices ticker */}
      <div className="flex items-baseline gap-2">
        <span className="uppercase text-[10px] tracking-wide text-slate-500">
          Indices
        </span>
        <span className="text-slate-600">·</span>
        <div
          className={`flex items-baseline gap-1.5 min-w-0 transition-opacity duration-150 ${
            fade ? "opacity-0" : "opacity-100"
          }`}
        >
          <span className="font-semibold text-slate-100">
            {activeTicker.symbol}
          </span>
          <span className="text-slate-300">
            {activeTicker.last.toFixed(2)}
          </span>
          <span
            className={`font-medium ${
              activeTicker.change_pct > 0
                ? "text-emerald-400"
                : activeTicker.change_pct < 0
                ? "text-red-400"
                : "text-slate-300"
            }`}
          >
            {activeTicker.change_pct > 0 && "+"}
            {activeTicker.change_pct.toFixed(2)}%
          </span>
        </div>
        {error && (
          <span className="ml-auto rounded-full px-2 py-[2px] text-[10px] font-medium bg-red-950/70 border border-red-500/60 text-red-300">
            offline
          </span>
        )}
      </div>
    </div>
  );
};

export default MarketStatusTicker;
