const MetricCard = ({ label, value, helper }) => {
  return (
    <div className="metric-card pro">
      <p className="metric-label">{label}</p>
      <div className="metric-value clamp">{value}</div>
      {helper && <p className="metric-helper">{helper}</p>}
    </div>
  );
};

export default MetricCard;
