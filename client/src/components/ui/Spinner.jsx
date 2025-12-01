import "./Spinner.css";

const Spinner = ({ size = "md", label = null }) => {
  const sizeMap = {
    sm: "16px",
    md: "24px",
    lg: "32px",
    xl: "48px",
  };

  const style = {
    width: sizeMap[size] || sizeMap.md,
    height: sizeMap[size] || sizeMap.md,
  };

  return (
    <div className="spinner-container">
      <div className="spinner" style={style}></div>
      {label && <p className="spinner-label">{label}</p>}
    </div>
  );
};

export default Spinner;
