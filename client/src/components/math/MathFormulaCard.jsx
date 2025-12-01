import Card from "../ui/Card";

const MathFormulaCard = ({
  title,
  formula,
  description,
  bullets,
  implementation,
  solver,
  complexity,
  additionalInfo,
}) => {
  return (
    <Card className="bg-slate-900/60 border border-slate-800 space-y-3">
      <div>
        <h4 className="text-sm font-semibold tracking-wide text-slate-100 uppercase">
          {title}
        </h4>
      </div>

      {formula && (
        <div className="rounded-md bg-slate-950 px-4 py-3 border border-slate-800">
          <p className="font-mono text-xs text-amber-300 break-words">
            {formula}
          </p>
        </div>
      )}

      {description && (
        <p className="text-sm text-slate-300 leading-relaxed">
          {description}
        </p>
      )}

      {bullets && bullets.length > 0 && (
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-slate-400">
          {bullets.map((bullet, i) => (
            <li key={i}>{bullet}</li>
          ))}
        </ul>
      )}

      {additionalInfo && (
        <div className="space-y-2">
          {additionalInfo.map((info, i) => (
            <div key={i} className="text-sm text-slate-400">
              <span className="font-semibold text-slate-300">{info.label}:</span>{" "}
              {info.isFormula ? (
                <span className="font-mono text-amber-300 break-words">
                  {info.value}
                </span>
              ) : (
                <span>{info.value}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {implementation && (
        <div className="text-xs text-slate-400 pt-1">
          <span className="font-semibold text-slate-300">Implementation: </span>
          <span className="font-mono text-blue-400">{implementation}</span>
        </div>
      )}

      {solver && (
        <div className="text-xs text-slate-400 pt-1">
          <span className="font-semibold text-slate-300">Solver: </span>
          <span>{solver}</span>
        </div>
      )}

      {complexity && (
        <div className="text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Complexity: </span>
          <span>{complexity}</span>
        </div>
      )}
    </Card>
  );
};

export default MathFormulaCard;
