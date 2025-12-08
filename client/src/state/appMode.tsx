import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

export type AppMode = "home" | "pm" | "research" | "execution";

export const MODE_TABS: Array<{
  id: AppMode;
  label: string;
  description: string;
  route: string;
}> = [
  { id: "pm", label: "PM View", description: "Portfolio health and diagnostics", route: "/pm/dashboard" },
  { id: "research", label: "Research View", description: "Strategy diagnostics and regimes", route: "/quant/strategy-research" },
  { id: "execution", label: "Execution & Microstructure View", description: "Execution insights and simulations", route: "/quant/execution-lab" },
];

const detectMode = (pathname: string): AppMode => {
  if (pathname.startsWith("/home")) {
    return "home";
  }
  if (pathname.startsWith("/quant/execution") || pathname.startsWith("/quant/market-structure")) {
    return "execution";
  }
  if (
    pathname.startsWith("/quant/strategy") ||
    pathname.startsWith("/quant/regimes") ||
    pathname.startsWith("/pm/historical-analysis")
  ) {
    return "research";
  }
  if (pathname.startsWith("/pm")) {
    return "pm";
  }
  return "pm";
};

type AppModeContextValue = {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
};

const AppModeContext = createContext<AppModeContextValue | undefined>(undefined);

export const AppModeProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [mode, setMode] = useState<AppMode>(() => detectMode(location.pathname));

  useEffect(() => {
    setMode(detectMode(location.pathname));
  }, [location.pathname]);

  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <AppModeContext.Provider value={value}>{children}</AppModeContext.Provider>;
};

export const useAppMode = () => {
  const ctx = useContext(AppModeContext);
  if (!ctx) {
    throw new Error("useAppMode must be used within AppModeProvider");
  }
  return ctx;
};
