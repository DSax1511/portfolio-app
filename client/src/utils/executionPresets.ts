export type ExecutionPresetId = "retail" | "institutional" | "urgent" | "passive";

export interface ExecutionConfigPreset {
  notional: number;
  algorithm: "TWAP" | "VWAP" | "POV" | "Implementation Shortfall" | "Liquidity Seeking";
  participationRate: number;
  urgency: number;
  maxChildSize: number;
  latencyMs: number;
  routingPreference: string;
  impactModel: "Linear" | "Square root" | "Temporary + permanent";
  venues: string[];
  side: "Buy" | "Sell";
}

const PRESET_CONFIGS: Record<ExecutionPresetId, ExecutionConfigPreset> = {
  retail: {
    notional: 75_000,
    algorithm: "TWAP",
    participationRate: 5,
    urgency: 2,
    maxChildSize: 2_500,
    latencyMs: 8,
    routingPreference: "Lit only",
    impactModel: "Linear",
    venues: ["NASDAQ", "NYSE"],
    side: "Buy",
  },
  institutional: {
    notional: 500_000,
    algorithm: "VWAP",
    participationRate: 12,
    urgency: 3,
    maxChildSize: 8_000,
    latencyMs: 4,
    routingPreference: "Smart router",
    impactModel: "Square root",
    venues: ["NASDAQ", "NYSE", "ARCA"],
    side: "Buy",
  },
  urgent: {
    notional: 1_250_000,
    algorithm: "Implementation Shortfall",
    participationRate: 25,
    urgency: 5,
    maxChildSize: 12_000,
    latencyMs: 2,
    routingPreference: "Aggressive dark + lit",
    impactModel: "Temporary + permanent",
    venues: ["NYSE", "EDGX", "IEX"],
    side: "Sell",
  },
  passive: {
    notional: 200_000,
    algorithm: "POV",
    participationRate: 3,
    urgency: 1,
    maxChildSize: 1_800,
    latencyMs: 12,
    routingPreference: "Passive only",
    impactModel: "Linear",
    venues: ["NASDAQ", "IEX"],
    side: "Buy",
  },
};

export const getExecutionPresetConfig = (presetId: ExecutionPresetId): ExecutionConfigPreset => {
  const preset = PRESET_CONFIGS[presetId];
  if (!preset) {
    throw new Error(`Unsupported preset: ${presetId}`);
  }
  return preset;
};

export const EXECUTION_PRESET_OPTIONS: Array<{ id: ExecutionPresetId; label: string }> = [
  { id: "retail", label: "Retail order (small, low urgency)" },
  { id: "institutional", label: "Institutional VWAP (medium urgency)" },
  { id: "urgent", label: "Urgent liquidation (high urgency)" },
  { id: "passive", label: "Passive accumulation (low participation)" },
];
