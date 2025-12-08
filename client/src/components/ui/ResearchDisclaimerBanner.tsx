import { type FC, useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "saxtonpi:researchDisclaimerDismissed";

const ResearchDisclaimerBanner: FC = () => {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return true;
    return !sessionStorage.getItem(STORAGE_KEY);
  });

  const handleDismiss = useCallback(() => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(STORAGE_KEY, "1");
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      setVisible(false);
    }
    return undefined;
  }, []);

  if (!visible) return null;

  return (
    <div className="research-disclaimer">
      <p>
        Backtests and strategies shown here are for research and infrastructure validation only. They are not optimized for live trading or
        investment advice.
      </p>
      <button type="button" className="btn btn-ghost" onClick={handleDismiss}>
        Dismiss for session
      </button>
    </div>
  );
};

export default ResearchDisclaimerBanner;
