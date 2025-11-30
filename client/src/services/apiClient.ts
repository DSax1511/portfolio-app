const inferBaseUrl = () => {
  const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBase) return envBase;
  if (typeof window === "undefined") return "http://127.0.0.1:8000";
  const { protocol, hostname, port } = window.location;
  // If we're behind nginx (e.g., port 4173) we can often just use same-origin proxy.
  const sameOriginCandidate = window.location.origin;
  if (port === "4173" || port === "" || port === "80") {
    return sameOriginCandidate;
  }
  // Local dev (Vite on 5173) should talk to localhost:8000 directly.
  return `${protocol}//${hostname}:8000`;
};

const baseUrl = inferBaseUrl().replace(/\/$/, "");

const normalizeError = async (res: Response) => {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = await res.json();
      if ((data as any)?.detail) return `${res.status} ${res.statusText}: ${(data as any).detail}`;
      return `${res.status} ${res.statusText}: ${JSON.stringify(data)}`;
    } catch {
      /* fall through */
    }
  }
  const text = await res.text();
  return text ? `${res.status} ${res.statusText}: ${text}` : `${res.status} ${res.statusText}`;
};

const handleRequest = async <T>(path: string, init: RequestInit) => {
  try {
    const res = await fetch(`${baseUrl}${path}`, init);
    if (!res.ok) {
      const msg = await normalizeError(res);
      throw new Error(msg);
    }
    return (await res.json()) as T;
  } catch (err: any) {
    if (err?.name === "TypeError" && err?.message?.toLowerCase().includes("fetch")) {
      throw new Error(`Network error. Check backend (${baseUrl}), CORS, or if the server is running.`);
    }
    throw err;
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
