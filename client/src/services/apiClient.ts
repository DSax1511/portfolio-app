/**
 * API base URL resolution:
 * - In Vercel/production, set VITE_API_BASE_URL to the Render backend (e.g., https://portfolio-app-6lfb.onrender.com).
 * - In local dev, leave unset and it will fall back to http://localhost:8000 when running on localhost/127.0.0.1.
 * - In any other hostname (e.g., custom domain) with no env var, default to the Render backend URL.
 */
const resolveApiBase = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (envBase) return envBase.trim().replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://localhost:8000";
    }
  }
  return "https://portfolio-app-6lfb.onrender.com";
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
