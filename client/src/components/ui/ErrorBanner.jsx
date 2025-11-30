const ErrorBanner = ({ message, onRetry }) => {
  if (!message) return null;
  return (
    <div className="warning-state" style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", alignItems: "center" }}>
      <div>
        <p style={{ margin: 0, fontWeight: 700 }}>Something went wrong</p>
        <p className="muted" style={{ margin: "2px 0 0" }}>
          {message} • Check that the backend is running and CORS is allowed.
        </p>
      </div>
      {onRetry && (
        <button className="btn btn-ghost" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
};

export default ErrorBanner;
