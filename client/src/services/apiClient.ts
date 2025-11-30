const DEFAULT_API_BASE = "http://localhost:8000";

const inferBaseUrl = () => {
  // Prefer explicit env override; otherwise fall back to local FastAPI in dev.
  const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBase) return envBase;
  if (typeof window === "undefined") return DEFAULT_API_BASE;
  const { protocol, hostname } = window.location;
  const host = hostname === "0.0.0.0" ? "localhost" : hostname;
  return `${protocol}//${host}:8000`;
};

export const apiBaseUrl = inferBaseUrl().replace(/\/$/, "");

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
      ? `Unable to reach the API at ${apiBaseUrl}. Verify the FastAPI backend is running and CORS allows this origin.`
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
