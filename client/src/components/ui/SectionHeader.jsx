const SectionHeader = ({ title, subtitle, actions }) => {
  return (
    <div className="section-header">
      <div>
        <p className="label-sm">{subtitle}</p>
        <h4 className="section-title">{title}</h4>
      </div>
      {actions && <div className="section-actions">{actions}</div>}
    </div>
  );
};

export default SectionHeader;
