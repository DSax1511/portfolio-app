import { type FC } from "react";
import MetricInfoPopover from "./MetricInfoPopover";

type MetricAccent = "neutral" | "green" | "red";

export interface MetricCardProps {
  label: string;
  value: string | number | null | undefined;
  tooltip?: string;
  accent?: MetricAccent;
  helper?: string | null;
  infoText?: string;
  muted?: boolean;
  mutedMessage?: string;
  isSignificant?: boolean;
}

const accentClasses: Record<MetricAccent, string> = {
  neutral: "border-slate-700/50 bg-gradient-to-br from-slate-800/90 to-slate-900/90 hover:from-slate-800 hover:to-slate-900 hover:border-slate-600",
  green: "border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-slate-900/90 hover:from-emerald-950/60 hover:to-slate-900 hover:border-emerald-500/60",
  red: "border-rose-500/40 bg-gradient-to-br from-rose-950/40 to-slate-900/90 hover:from-rose-950/60 hover:to-slate-900 hover:border-rose-500/60",
};

const sanitizeValue = (val: string | number | null | undefined): string => {
  if (val === null || val === undefined) return "—";
  if (typeof val === "number") {
    if (!isFinite(val)) return "—";
    return val.toString();
  }
  if (typeof val === "string" && (val === "NaN" || val === "Infinity" || val === "-Infinity")) {
    return "—";
  }
  return val;
};

const MetricCard: FC<MetricCardProps> = ({
  label,
  value,
  tooltip,
  accent = "neutral",
  helper,
  infoText,
  muted = false,
  mutedMessage,
  isSignificant,
}) => {
  const displayValue = sanitizeValue(value);
  const showInsignificantBadge = isSignificant === false && !muted;

  return (
    <div
      className={`group rounded-xl border ${accentClasses[accent]} px-5 py-4 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] cursor-default backdrop-blur-sm ${
        muted ? "metric-card--muted" : ""
      }`}
      style={isSignificant === false ? { opacity: 0.7 } : undefined}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-widest font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
          {label}
          {showInsignificantBadge && (
            <span
              className="ml-1.5 text-amber-400"
              title="Not statistically significant"
            >
              ~
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {infoText && <MetricInfoPopover content={infoText} />}
          {tooltip && (
            <span
              title={tooltip}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-[10px] text-slate-300 cursor-help hover:bg-slate-700 hover:border-slate-500 transition-all"
            >
              ?
            </span>
          )}
        </div>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-slate-50 leading-tight tracking-tight">
          {displayValue}
        </div>
        {helper && (
          <div className="text-sm font-medium text-slate-400">
            {helper}
          </div>
        )}
      </div>
      {muted && mutedMessage && (
        <p className="text-xs text-slate-400 mt-1 italic">
          {mutedMessage}
        </p>
      )}
      {showInsignificantBadge && (
        <p className="text-xs text-amber-400/80 mt-1 italic">
          Not statistically significant for this sample size
        </p>
      )}
    </div>
  );
};

export default MetricCard;
