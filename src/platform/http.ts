/** Public browser-to-service boundary. API credentials and entitlement decisions stay server-side. */
export type ServiceErrorCode =
  | "configuration" | "network" | "timeout" | "aborted" | "unauthorized"
  | "forbidden" | "unavailable" | "invalid-response";

const messages: Record<ServiceErrorCode, string> = {
  configuration: "This service is not configured correctly.",
  network: "The service could not be reached. Please try again.",
  timeout: "The service took too long to respond. Please try again.",
  aborted: "The request was cancelled.",
  unauthorized: "Your session has ended. Please sign in again.",
  forbidden: "Your account does not have access to this request.",
  unavailable: "The service is temporarily unavailable.",
  "invalid-response": "The service returned an invalid response.",
};

export class ServiceError extends Error {
  constructor(public readonly code: ServiceErrorCode, public readonly status?: number) {
    super(messages[code]);
    this.name = "ServiceError";
  }
}

export function serviceError(error: unknown): ServiceError {
  return error instanceof ServiceError ? error : new ServiceError("network");
}

const loopback = (hostname: string) =>
  hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";

/** Only explicit local development may use unencrypted loopback endpoints. */
export function safeServiceUrl(value: unknown, development = false): string {
  if (typeof value !== "string" || !value || value.length > 8192)
    throw new ServiceError("invalid-response");
  let url: URL;
  try { url = new URL(value); } catch { throw new ServiceError("invalid-response"); }
  if (url.username || url.password ||
    !(url.protocol === "https:" || (development && url.protocol === "http:" && loopback(url.hostname))))
    throw new ServiceError("invalid-response");
  return url.href;
}

export function normalizeApiUrl(value: string | undefined, development = false): string {
  if (!value?.trim()) return "";
  try {
    const url = new URL(safeServiceUrl(value.trim(), development));
    if (url.search || url.hash) throw new Error("API base must be a path");
    return url.href.replace(/\/+$/, "");
  } catch { throw new ServiceError("configuration"); }
}

/** Hash routes must retain the hosting base path (including GitHub Pages). */
export function buildReturnUrl(origin: string, baseUrl: string, route: "/my-world" | "/premium"): string {
  const originUrl = new URL(origin);
  if (!/^https?:$/.test(originUrl.protocol) || originUrl.username || originUrl.password)
    throw new ServiceError("configuration");
  // Vite BASE_URL is a deployment path here, never a provider-controlled redirect.
  if (!baseUrl.startsWith("/") || baseUrl.startsWith("//") || /[?#\\]/.test(baseUrl))
    throw new ServiceError("configuration");
  const destination = new URL(baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`, originUrl.origin);
  destination.hash = route;
  return destination.href;
}

export type ApiClientOptions = {
  apiUrl?: string;
  development?: boolean;
  timeoutMs?: number;
  fetch?: typeof fetch;
};
export type RequestOptions = { method?: "GET" | "POST"; body?: unknown; signal?: AbortSignal };

export function createApiClient(options: ApiClientOptions) {
  let apiUrl = "";
  let configurationError = false;
  try { apiUrl = normalizeApiUrl(options.apiUrl, options.development); }
  catch { configurationError = true; }
  const timeoutMs = Number.isFinite(options.timeoutMs)
    ? Math.min(30000, Math.max(1, options.timeoutMs!)) : 10000;
  const fetcher = options.fetch ?? globalThis.fetch;

  async function request<T>(path: string, validate: (data: unknown) => T, requestOptions: RequestOptions = {}): Promise<T> {
    if (!apiUrl || !/^\/(?!\/)/.test(path)) throw new ServiceError("configuration");
    if (requestOptions.signal?.aborted) throw new ServiceError("aborted");
    const controller = new AbortController();
    const cancel = () => controller.abort(new ServiceError("aborted"));
    requestOptions.signal?.addEventListener("abort", cancel, { once: true });
    const timer = setTimeout(() => controller.abort(new ServiceError("timeout")), timeoutMs);
    let abortListener: (() => void) | undefined;
    // The race bounds even a broken transport that ignores AbortSignal; no retry of payments/POSTs.
    const cancelled = new Promise<never>((_, reject) => {
      abortListener = () => reject(controller.signal.reason ?? new ServiceError("aborted"));
      controller.signal.addEventListener("abort", abortListener, { once: true });
    });
    try {
      const operation = (async () => {
        const response = await fetcher(`${apiUrl}${path}`, {
          method: requestOptions.method ?? "GET",
          credentials: "include",
          redirect: "error",
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json", ...(requestOptions.body === undefined ? {} : { "Content-Type": "application/json" }) },
          body: requestOptions.body === undefined ? undefined : JSON.stringify(requestOptions.body),
        });
        if (!response.ok) {
          const code = response.status === 401 ? "unauthorized" : response.status === 403 ? "forbidden" : "unavailable";
          throw new ServiceError(code, response.status);
        }
        let data: unknown;
        try { data = await response.json(); } catch { throw new ServiceError("invalid-response"); }
        try { return validate(data); } catch { throw new ServiceError("invalid-response"); }
      })();
      return await Promise.race([operation, cancelled]);
    } catch (error) { throw serviceError(error); }
    finally {
      clearTimeout(timer);
      requestOptions.signal?.removeEventListener("abort", cancel);
      if (abortListener) controller.signal.removeEventListener("abort", abortListener);
    }
  }
  return Object.freeze({ apiUrl, configured: Boolean(apiUrl), configurationError, request });
}

export function readHostedUrl(data: unknown, development = false): string {
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new ServiceError("invalid-response");
  return safeServiceUrl((data as Record<string, unknown>).url, development);
}
