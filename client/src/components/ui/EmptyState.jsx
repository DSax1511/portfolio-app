const EmptyState = ({ title, description, action }) => {
  return (
    <div className="empty-state">
      <div className="empty-glyph">◎</div>
      <div>
        <p className="empty-title">{title}</p>
        {description && <p className="muted">{description}</p>}
      </div>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
};

export default EmptyState;
