type MetricAccent = "neutral" | "green" | "red";

export interface MetricCardProps {
  label: string;
  value: string;
  tooltip?: string;
  accent?: MetricAccent;
  helper?: string | null;
}

const accentClasses: Record<MetricAccent, string> = {
  neutral: "border-slate-700/50 bg-gradient-to-br from-slate-800/90 to-slate-900/90 hover:from-slate-800 hover:to-slate-900 hover:border-slate-600",
  green: "border-emerald-500/40 bg-gradient-to-br from-emerald-950/40 to-slate-900/90 hover:from-emerald-950/60 hover:to-slate-900 hover:border-emerald-500/60",
  red: "border-rose-500/40 bg-gradient-to-br from-rose-950/40 to-slate-900/90 hover:from-rose-950/60 hover:to-slate-900 hover:border-rose-500/60",
};

const MetricCard = ({ label, value, tooltip, accent = "neutral", helper }: MetricCardProps) => {
  return (
    <div
      className={`group rounded-xl border ${accentClasses[accent]} px-5 py-4 shadow-lg transition-all duration-200 hover:shadow-xl hover:scale-[1.02] cursor-default backdrop-blur-sm`}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="text-[10px] uppercase tracking-widest font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
          {label}
        </div>
        {tooltip && (
          <span
            title={tooltip}
            className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-600 bg-slate-800 text-[10px] text-slate-300 cursor-help hover:bg-slate-700 hover:border-slate-500 transition-all"
          >
            ?
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-slate-50 leading-tight tracking-tight">
          {value}
        </div>
        {helper && (
          <div className="text-sm font-medium text-slate-400">
            {helper}
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricCard;
