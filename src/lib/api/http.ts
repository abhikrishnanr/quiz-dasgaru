import { env } from "@/src/config/env";

const DEFAULT_TIMEOUT_MS = 10_000;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const buildUrl = (path: string, baseUrl = env.NEXT_PUBLIC_API_BASE_URL) => {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (path.startsWith("/api/")) {
    return path;
  }

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBaseUrl}${normalizedPath}`;
};

const fetchWithTimeout = async (input: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

export const requestJson = async <TResponse>(path: string, init: RequestInit = {}, baseUrl?: string) => {
  const response = await fetchWithTimeout(buildUrl(path, baseUrl), init);
  const text = await response.text();

  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { message: text };
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `Request failed (${response.status}): ${typeof parsed === "object" && parsed !== null && "message" in parsed ? String((parsed as { message?: unknown }).message) : response.statusText}`,
    );
  }

  return parsed as TResponse;
};

export const getJson = <TResponse>(path: string) => requestJson<TResponse>(path, { method: "GET" });

export const postJson = <TResponse, TBody extends Record<string, unknown>>(
  path: string,
  body: TBody,
) =>
  requestJson<TResponse>(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

export const putJson = <TResponse, TBody extends Record<string, unknown>>(
  path: string,
  body: TBody,
) =>
  requestJson<TResponse>(path, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

export const deleteJson = <TResponse>(path: string) => requestJson<TResponse>(path, { method: "DELETE" });
