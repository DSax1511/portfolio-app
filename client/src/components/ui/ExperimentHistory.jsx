const ExperimentHistory = ({ experiments = [], onSelect, title = "Recent runs" }) => {
  if (!experiments.length) return null;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
        <span className="text-[11px] text-slate-500">{experiments.length}</span>
      </div>
      <div className="flex flex-col gap-2 mt-2">
        {experiments.map((exp) => (
          <button
            key={exp.id}
            className="text-left text-sm rounded-md border border-slate-800 bg-slate-900 px-2 py-1 hover:border-slate-600"
            onClick={() => onSelect?.(exp)}
          >
            <div className="flex justify-between items-center">
              <span className="font-semibold text-slate-100">{exp.label || exp.parameters?.symbol || exp.id}</span>
              <span className="text-[11px] text-slate-500">{new Date(exp.last_run_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "12px" }}>
              {exp.parameters?.symbol ? `${exp.parameters.symbol}` : ""} {exp.parameters?.start_date ? `· ${exp.parameters.start_date}→${exp.parameters.end_date}` : ""}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExperimentHistory;
