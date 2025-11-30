type MetricAccent = "neutral" | "green" | "red";

export interface MetricCardProps {
  label: string;
  value: string;
  tooltip?: string;
  accent?: MetricAccent;
}

const accentClasses: Record<MetricAccent, string> = {
  neutral: "border-slate-800",
  green: "border-emerald-500/60",
  red: "border-rose-500/60",
};

const MetricCard = ({ label, value, tooltip, accent = "neutral" }: MetricCardProps) => {
  return (
    <div
      className={`rounded-xl border ${accentClasses[accent]} bg-slate-900/70 px-4 py-3 shadow-sm transition hover:bg-slate-900`}
    >
      <div className="flex items-center gap-2">
        <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
        {tooltip && (
          <span
            title={tooltip}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-[10px] text-slate-300 cursor-help"
          >
            ?
          </span>
        )}
      </div>
      <div className="mt-1 text-lg font-semibold text-slate-50 leading-tight">{value}</div>
    </div>
  );
};

export default MetricCard;
