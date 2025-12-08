import { describe, expect, it } from "vitest";
import { EXECUTION_PRESET_OPTIONS, getExecutionPresetConfig } from "./executionPresets";

describe("execution preset configs", () => {
  it("provides unique configs for declared presets", () => {
    EXECUTION_PRESET_OPTIONS.forEach((option) => {
      const config = getExecutionPresetConfig(option.id);
      expect(config).toHaveProperty("algorithm");
      expect(config).toHaveProperty("urgency");
      expect(config.participationRate).toBeGreaterThanOrEqual(0);
    });
  });

  it("throws when preset id is unrecognized", () => {
    expect(() => getExecutionPresetConfig("unknown" as any)).toThrow();
  });
});
