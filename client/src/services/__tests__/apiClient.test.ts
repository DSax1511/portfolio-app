import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolveApiBase } from "../apiClient";

const originalEnv = { ...import.meta.env };
const originalWindow = globalThis.window;

describe("resolveApiBase", () => {
  beforeEach(() => {
    import.meta.env.VITE_API_BASE_URL = "";
    globalThis.window = {
      location: {
        hostname: "localhost",
        protocol: "http:",
      },
    } as Window;
  });

  afterEach(() => {
    Object.assign(import.meta.env, originalEnv);
    globalThis.window = originalWindow;
  });

  it("uses VITE_API_BASE_URL when provided", () => {
    import.meta.env.VITE_API_BASE_URL = " https://api.example.com/ ";
    expect(resolveApiBase()).toBe("https://api.example.com");
  });

  it("falls back to localhost when running locally", () => {
    delete import.meta.env.VITE_API_BASE_URL;
    expect(resolveApiBase()).toBe("http://localhost:8000");
  });
});
