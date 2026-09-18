import { config } from "./config";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export class UnauthorizedError extends ApiError {
  constructor(body?: unknown) {
    super(401, "Not authenticated", body);
    this.name = "UnauthorizedError";
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  basicToken?: string | null;
  signal?: AbortSignal;
  timeoutMs?: number;
}

// POST /message runs the assistant inline and can take a while. Aborting early
// only discards the response; the server still finishes and saves the reply.
const DEFAULT_TIMEOUT_MS = 60_000;

// Tracked so a logout or account switch can cancel everything still in flight.
const activeRequests = new Set<AbortController>();

export function abortAllRequests() {
  for (const controller of activeRequests) controller.abort();
  activeRequests.clear();
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, basicToken, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (basicToken) headers["Authorization"] = `Basic ${basicToken}`;

  const timeoutController = new AbortController();
  activeRequests.add(timeoutController);
  const timer = setTimeout(() => timeoutController.abort(), timeoutMs);
  if (signal) {
    if (signal.aborted) timeoutController.abort();
    else signal.addEventListener("abort", () => timeoutController.abort(), { once: true });
  }

  let res: Response;
  try {
    res = await fetch(`${config.apiBaseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: timeoutController.signal,
      credentials: "omit",
    });
  } finally {
    clearTimeout(timer);
    activeRequests.delete(timeoutController);
  }

  if (res.status === 401 || res.status === 403) {
    let parsedBody: unknown;
    try {
      parsedBody = await res.json();
    } catch {
      // no JSON body
    }
    throw new UnauthorizedError(parsedBody);
  }

  if (!res.ok) {
    let parsedBody: unknown;
    let message = `Request failed: ${res.status} ${res.statusText}`;
    try {
      parsedBody = await res.json();
      if (
        parsedBody &&
        typeof parsedBody === "object" &&
        "message" in parsedBody &&
        typeof (parsedBody as { message?: unknown }).message === "string"
      ) {
        message = (parsedBody as { message: string }).message;
      }
    } catch {
      // empty or non-JSON body; keep the default message
    }
    throw new ApiError(res.status, message, parsedBody);
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
