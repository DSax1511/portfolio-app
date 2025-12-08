import ContextBadge from "./ContextBadge";

const PageShell = ({ title, subtitle, actions, children, hideHeader = false, contextStatus }) => {
  return (
    <div className="page-shell">
      {!hideHeader && (
        <div className="page-shell__header">
          <div className="page-shell__title-row">
            {contextStatus && <ContextBadge variant={contextStatus} />}
            <div>
              <p className="label-sm">Saxton PI · Portfolio Intelligence</p>
              <h1 className="page-title">{title}</h1>
              {subtitle && <p className="page-subtitle">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="page-shell__actions">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default PageShell;
