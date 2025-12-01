import { useState, useEffect } from "react";

/**
 * MarketStatus - Displays current date and US equity market status.
 * 
 * Shows:
 * - Current date (Eastern Time, e.g., "Tue Dec 1, 2025")
 * - Market status (Open in green during NYSE/Nasdaq hours, Closed in muted text otherwise)
 * 
 * Updates every 30 seconds.
 */
export function MarketStatus() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Set initial time
    setNow(new Date());
    
    // Update every 30 seconds
    const id = setInterval(() => {
      setNow(new Date());
    }, 30000);

    return () => clearInterval(id);
  }, []);

  /**
   * Convert browser time to US Eastern Time.
   * Uses toLocaleString to parse ET, which is a reasonable approximation
   * and avoids adding heavy dependencies like luxon or date-fns-tz.
   */
  function getEasternDate(date) {
    const etString = date.toLocaleString("en-US", {
      timeZone: "America/New_York",
    });
    return new Date(etString);
  }

  const eastern = getEasternDate(now);
  const day = eastern.getDay(); // 0=Sunday, 6=Saturday
  const hours = eastern.getHours();
  const minutes = eastern.getMinutes();

  // Check if weekday (Mon-Fri)
  const isWeekday = day >= 1 && day <= 5;

  // US Market hours: 09:30 - 16:00 ET
  const isDuringSession =
    (hours > 9 || (hours === 9 && minutes >= 30)) &&
    (hours < 16 || (hours === 16 && minutes === 0));

  const isUsMarketOpen = isWeekday && isDuringSession;

  // Format date: "Tue Dec 1, 2025"
  const formattedDate = eastern.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const statusLabel = isUsMarketOpen
    ? "US MARKET: OPEN"
    : "US MARKET: CLOSED";

  const statusColor = isUsMarketOpen
    ? "text-emerald-400"
    : "text-slate-400";

  const dotColor = isUsMarketOpen
    ? "bg-emerald-400"
    : "bg-slate-500";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/70 px-3 py-1 shadow-sm shadow-black/40">
      <span className="text-[11px] md:text-xs font-medium text-slate-300">{formattedDate}</span>
      <span className="h-3 w-px bg-slate-700/70" />
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${dotColor} ${isUsMarketOpen ? 'shadow-[0_0_6px_rgba(16,185,129,0.7)]' : ''}`} />
        <span className={`text-[10px] md:text-[11px] tracking-wide font-semibold uppercase ${statusColor}`}>{statusLabel}</span>
      </div>
    </div>
  );
}

export default MarketStatus;
