import { getToken } from "./auth";

/** Standard API envelope (see frontend_guide_v2.md §8 / backend response.ts). */
interface Envelope<T> {
  succeeded: boolean;
  statusCode: number;
  data: T;
  message: string | null;
  elapsedMilliseconds: number;
  errors?: unknown;
}

export class ApiError extends Error {
  statusCode: number;
  errors?: unknown;
  constructor(message: string, statusCode: number, errors?: unknown) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.errors = errors;
  }
}

/**
 * Fetch wrapper that attaches the auth token and unwraps the envelope.
 * Returns `data` on success; throws ApiError(message) on failure.
 */
export async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(url, { ...init, headers });

  let body: Envelope<T>;
  try {
    body = (await res.json()) as Envelope<T>;
  } catch {
    throw new ApiError("Unexpected server response", res.status);
  }

  if (!body.succeeded) {
    throw new ApiError(body.message ?? "Request failed", body.statusCode, body.errors);
  }
  return body.data;
}
