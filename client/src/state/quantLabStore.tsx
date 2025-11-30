import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { portfolioApi } from "../services/portfolioApi";

export type QuantExperimentType = "strategy" | "microstructure" | "regime" | "execution";

export interface QuantExperiment<TParams = any, TResult = any> {
  id: string;
  type: QuantExperimentType;
  label?: string;
  parameters: TParams;
  result: TResult | null;
  created_at: string;
  last_run_at: string;
}

type ExperimentState = {
  current: Partial<Record<QuantExperimentType, QuantExperiment>>;
  history: Partial<Record<QuantExperimentType, QuantExperiment[]>>;
  loading: Partial<Record<QuantExperimentType, boolean>>;
  error: Partial<Record<QuantExperimentType, string>>;
  runStrategy: (params: any) => Promise<any>;
  runMicrostructure: (params: any) => Promise<any>;
  runRegime: (params: any) => Promise<any>;
  runExecution: (params: any) => Promise<any>;
  setLabel: (type: QuantExperimentType, id: string, label: string) => void;
  setCurrentExperiment: (type: QuantExperimentType, id: string) => void;
};

const QuantLabContext = createContext<ExperimentState | undefined>(undefined);

const buildExperiment = (type: QuantExperimentType, params: any, result: any): QuantExperiment => {
  const ts = new Date().toISOString();
  return {
    id: `${type}-${ts}`,
    type,
    parameters: params,
    result,
    created_at: ts,
    last_run_at: ts,
  };
};

const keepLast = <T,>(arr: T[], n = 5) => arr.slice(0, n);

export const QuantLabProvider = ({ children }: { children: React.ReactNode }) => {
  const [current, setCurrent] = useState<ExperimentState["current"]>({});
  const [history, setHistory] = useState<ExperimentState["history"]>({});
  const [loading, setLoading] = useState<ExperimentState["loading"]>({});
  const [error, setError] = useState<ExperimentState["error"]>({});

  const updateState = useCallback((type: QuantExperimentType, experiment: QuantExperiment | null, err: string | null) => {
    setLoading((prev) => ({ ...prev, [type]: false }));
    setError((prev) => ({ ...prev, [type]: err || "" }));
    if (!experiment) return;
    setCurrent((prev) => ({ ...prev, [type]: experiment }));
    setHistory((prev) => {
      const prior = prev[type] || [];
      return { ...prev, [type]: keepLast([experiment, ...prior], 6) };
    });
  }, []);

  const runStrategy = useCallback(
    async (params: any) => {
      setLoading((prev) => ({ ...prev, strategy: true }));
      try {
        const result = await portfolioApi.runQuantBacktest(params);
        updateState("strategy", buildExperiment("strategy", params, result), null);
        return result;
      } catch (e: any) {
        updateState("strategy", null, e?.message || "Strategy backtest failed");
        throw e;
      }
    },
    [updateState]
  );

  const runMicrostructure = useCallback(
    async (params: any) => {
      setLoading((prev) => ({ ...prev, microstructure: true }));
      try {
        const result = await portfolioApi.runMicrostructure(params);
        updateState("microstructure", buildExperiment("microstructure", params, result), null);
        return result;
      } catch (e: any) {
        updateState("microstructure", null, e?.message || "Microstructure analytics failed");
        throw e;
      }
    },
    [updateState]
  );

  const runRegime = useCallback(
    async (params: any) => {
      setLoading((prev) => ({ ...prev, regime: true }));
      try {
        const result = await portfolioApi.getRegimes(params);
        updateState("regime", buildExperiment("regime", params, result), null);
        return result;
      } catch (e: any) {
        updateState("regime", null, e?.message || "Regime detection failed");
        throw e;
      }
    },
    [updateState]
  );

  const runExecution = useCallback(
    async (params: any) => {
      setLoading((prev) => ({ ...prev, execution: true }));
      try {
        // Execution simulator is local; no API call needed, just store params/results directly.
        updateState("execution", buildExperiment("execution", params, params.result || null), null);
        return params.result || null;
      } catch (e: any) {
        updateState("execution", null, e?.message || "Execution simulation failed");
        throw e;
      }
    },
    [updateState]
  );

  const setLabel = useCallback((type: QuantExperimentType, id: string, label: string) => {
    setHistory((prev) => {
      const list = prev[type] || [];
      return {
        ...prev,
        [type]: list.map((exp) => (exp.id === id ? { ...exp, label } : exp)),
      };
    });
    setCurrent((prev) => {
      const exp = prev[type];
      if (exp?.id === id) return { ...prev, [type]: { ...exp, label } };
      return prev;
    });
  }, []);

  const setCurrentExperiment = useCallback(
    (type: QuantExperimentType, id: string) => {
      setHistory((prev) => {
        const list = prev[type] || [];
        const found = list.find((exp) => exp.id === id);
        if (found) setCurrent((curr) => ({ ...curr, [type]: found }));
        return prev;
      });
    },
    []
  );

  const value = useMemo(
    () => ({ current, history, loading, error, runStrategy, runMicrostructure, runRegime, runExecution, setLabel, setCurrentExperiment }),
    [current, history, loading, error, runStrategy, runMicrostructure, runRegime, runExecution, setLabel, setCurrentExperiment]
  );

  return <QuantLabContext.Provider value={value}>{children}</QuantLabContext.Provider>;
};

export const useQuantLabStore = () => {
  const ctx = useContext(QuantLabContext);
  if (!ctx) throw new Error("useQuantLabStore must be used within QuantLabProvider");
  return ctx;
};
