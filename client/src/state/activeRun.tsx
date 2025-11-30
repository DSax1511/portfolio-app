import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type ActiveRunContextValue = {
  activeRunId: string | null;
  activeRunLabel?: string | null;
  setActiveRun: (runId: string | null, label?: string | null) => void;
};

const ActiveRunContext = createContext<ActiveRunContextValue | undefined>(undefined);
const STORAGE_KEY = "activeRunId";
const STORAGE_LABEL = "activeRunLabel";

export const ActiveRunProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [activeRunLabel, setActiveRunLabel] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const label = localStorage.getItem(STORAGE_LABEL);
    if (stored) setActiveRunId(stored);
    if (label) setActiveRunLabel(label);
  }, []);

  const setActiveRun = useCallback((runId: string | null, label?: string | null) => {
    setActiveRunId(runId);
    setActiveRunLabel(label || null);
    if (runId) {
      localStorage.setItem(STORAGE_KEY, runId);
      if (label) localStorage.setItem(STORAGE_LABEL, label);
    } else {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_LABEL);
    }
  }, []);

  const value = useMemo(
    () => ({
      activeRunId,
      activeRunLabel,
      setActiveRun,
    }),
    [activeRunId, activeRunLabel, setActiveRun]
  );

  return <ActiveRunContext.Provider value={value}>{children}</ActiveRunContext.Provider>;
};

/**
 * Active run represents the last completed backtest or demo portfolio run.
 * It is set after backtests complete (Quant Lab or PM demo), persisted to localStorage,
 * and consumed by analytics pages (e.g., Risk & Diagnostics) to fetch run-specific metrics.
 */
export const useActiveRun = () => {
  const ctx = useContext(ActiveRunContext);
  if (!ctx) throw new Error("useActiveRun must be used within ActiveRunProvider");
  return ctx;
};
