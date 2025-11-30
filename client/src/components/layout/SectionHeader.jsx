const SectionHeader = ({ overline, title, subtitle, actions }) => {
  return (
    <div className="section-header">
      <div>
        {overline && <p className="label-sm">{overline}</p>}
        <h4 className="section-title">{title}</h4>
        {subtitle && <p className="muted" style={{ margin: "4px 0 0" }}>{subtitle}</p>}
      </div>
      {actions && <div className="section-actions">{actions}</div>}
    </div>
  );
};

export default SectionHeader;
