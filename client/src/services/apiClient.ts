/**
 * API base URL resolution (improved for production deployments):
 * 
 * Priority order:
 * 1. VITE_API_BASE_URL environment variable (set in .env or deployment config)
 * 2. Same origin (recommended for production - backend served from same domain)
 * 3. Localhost fallback for local dev (http://localhost:8000)
 * 
 * Usage:
 * - Local dev: No env var needed, auto-detects localhost:8000
 * - Docker Compose: Set VITE_API_BASE_URL=http://backend:8000 in frontend service
 * - Production (same origin): Set VITE_API_BASE_URL=/api or leave unset
 * - Production (separate domain): Set VITE_API_BASE_URL=https://backend.example.com
 */
const resolveApiBase = () => {
  // 1. Check explicit environment variable
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) {
    const trimmed = envBase.trim().replace(/\/$/, "");
    console.log("[API] Using VITE_API_BASE_URL:", trimmed);
    return trimmed;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const protocol = window.location.protocol;
    
    // 2. Local dev detection
    if (host === "localhost" || host === "127.0.0.1") {
      const localUrl = "http://localhost:8000";
      console.log("[API] Local dev detected, using:", localUrl);
      return localUrl;
    }

    // 3. Same-origin backend (recommended for production)
    const sameOriginUrl = `${protocol}//${host}`;
    console.log("[API] Using same-origin backend:", sameOriginUrl);
    return sameOriginUrl;
  }

  throw new Error("Could not determine API base URL");
};

export const apiBaseUrl = resolveApiBase();

export class ApiClientError extends Error {
  status?: number;
  url: string;
  details?: unknown;
  isNetworkError: boolean;

  constructor(message: string, options: { url: string; status?: number; details?: unknown; isNetworkError?: boolean }) {
    super(message);
    this.name = "ApiClientError";
    this.url = options.url;
    this.status = options.status;
    this.details = options.details;
    this.isNetworkError = Boolean(options.isNetworkError);
  }
}

const normalizeError = async (res: Response) => {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      if ((data as any)?.detail) {
        return { message: `${res.status} ${res.statusText}: ${(data as any).detail}`, details: data };
      }
      return { message: `${res.status} ${res.statusText}: ${JSON.stringify(data)}`, details: data };
    } catch {
      /* fall through */
    }
  }
  const text = await res.text();
  return { message: text ? `${res.status} ${res.statusText}: ${text}` : `${res.status} ${res.statusText}` };
};

const handleRequest = async <T>(path: string, init: RequestInit) => {
  const url = `${apiBaseUrl}${path}`;
  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      const { message, details } = await normalizeError(res);
      throw new ApiClientError(message, { url, status: res.status, details });
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err instanceof ApiClientError) throw err;
    const isNetwork = err?.name === "TypeError" || err?.isNetworkError;
    const message = isNetwork
      ? `Unable to reach the API at ${apiBaseUrl}. This is usually a deployment or CORS issue.`
      : err?.message || "Request failed";
    throw new ApiClientError(message, { url, isNetworkError: isNetwork });
  }
};

const buildInit = (method: string, body?: unknown, options?: RequestInit): RequestInit => {
  const headers = new Headers(options?.headers || undefined);
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    payload = JSON.stringify(body);
  }

  return {
    ...options,
    method,
    headers,
    body: payload,
  };
};

export const apiClient = {
  get: async <T>(path: string, options?: RequestInit) => handleRequest<T>(path, buildInit("GET", undefined, options)),
  post: async <T>(path: string, body?: unknown, options?: RequestInit) =>
    handleRequest<T>(path, buildInit("POST", body, options)),
};
