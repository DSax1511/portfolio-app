const PageShell = ({ title, subtitle, actions, children }) => {
  return (
    <div className="page-shell">
      <div className="page-shell__header">
        <div>
          <p className="label-sm">Portfolio Intelligence</p>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="page-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="page-shell__actions">{actions}</div>}
      </div>
      {children}
    </div>
  );
};

export default PageShell;
