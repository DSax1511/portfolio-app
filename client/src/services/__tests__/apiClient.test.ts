import { describe, expect, it, vi } from "vitest";

const loadClient = async () => {
  vi.resetModules();
  return await import("../apiClient");
};

const withWindow = (hostname: string, protocol = "https:") => {
  (globalThis as unknown as { window?: Window }).window = {
    location: {
      hostname,
      protocol,
    },
  } as Location & Window;
  return () => {
    delete (globalThis as unknown as { window?: Window }).window;
  };
};

describe("API base resolution", () => {
  afterEach(() => {
    delete process.env.VITE_API_BASE_URL;
    delete (globalThis as unknown as { window?: Window }).window;
  });

  it("prefers VITE_API_BASE_URL when provided", async () => {
    process.env.VITE_API_BASE_URL = "https://api.saxtonpi.com";
    const { apiBaseUrl } = await loadClient();
    expect(apiBaseUrl).toBe("https://api.saxtonpi.com");
  });

  it("defaults to localhost when no env or window is present", async () => {
    const { apiBaseUrl } = await loadClient();
    expect(apiBaseUrl).toBe("http://localhost:8000");
  });

  it("uses same-origin when running in the browser", async () => {
    withWindow("app.saxtonpi.com", "https:");
    const { apiBaseUrl } = await loadClient();
    expect(apiBaseUrl).toBe("https://app.saxtonpi.com");
  });

  it("prefers the env variable even if window exists", async () => {
    process.env.VITE_API_BASE_URL = "https://api.saxtonpi.com";
    withWindow("app.saxtonpi.com", "https:");
    const { apiBaseUrl } = await loadClient();
    expect(apiBaseUrl).toBe("https://api.saxtonpi.com");
  });
});
