import { useEffect, useState } from "react";

const MARKET_ZONE = "America/New_York";
const REFRESH_MS = 30 * 1000;

const buildMarketState = (now) => {
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: MARKET_ZONE }).format(now);
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: MARKET_ZONE,
  });
  const boldTime = timeFormatter.format(now);
  const eastern = new Date(now.toLocaleString("en-US", { timeZone: MARKET_ZONE }));
  const day = eastern.getDay();
  const minutes = eastern.getHours() * 60 + eastern.getMinutes();
  const withinWindow = minutes >= 9 * 60 + 30 && minutes < 16 * 60;
  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && withinWindow;

  return {
    formattedTime: `${weekday} • ${boldTime} ET`,
    label: isOpen ? "Market Open" : "Market Closed",
    isOpen,
  };
};

const MarketStatusBadge = () => {
  const [state, setState] = useState(() => buildMarketState(new Date()));

  useEffect(() => {
    const handle = setInterval(() => setState(buildMarketState(new Date())), REFRESH_MS);
    return () => clearInterval(handle);
  }, []);

  return (
    <div className={`market-status-badge ${state.isOpen ? "market-status-badge--open" : ""}`}>
      <span className="market-status-badge__time">{state.formattedTime}</span>
      <span className="market-status-badge__label">{state.label}</span>
    </div>
  );
};

export default MarketStatusBadge;
