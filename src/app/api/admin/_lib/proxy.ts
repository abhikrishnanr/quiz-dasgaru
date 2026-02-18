import { getServerEnv } from "@/src/config/env";
import { NextRequest, NextResponse } from "next/server";

const DEFAULT_TIMEOUT_MS = 10_000;

const withTimeout = async (url: string, init: RequestInit, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
};

const parseJsonLike = (text: string) => {
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
};

const removeUndefined = (obj: any): any => {
  if (Array.isArray(obj)) {
    return obj.map(removeUndefined);
  } else if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = removeUndefined(value);
      }
      return acc;
    }, {} as any);
  }
  return obj;
};

export const requestAdmin = async (path: string, method: "GET" | "POST" | "PUT" | "DELETE", bodyText?: string) => {
  const { NEXT_PUBLIC_API_BASE_URL, ADMIN_SECRET } = getServerEnv();
  const url = `${NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "")}${path}`;
  console.log(`[DEBUG] Proxying ${method} to ${url}`);

  const response = await withTimeout(url, {
    method,
    headers: {
      "content-type": "application/json",
      "x-admin-secret": ADMIN_SECRET,
    },
    body: bodyText || undefined,
  });

  const responseText = await response.text();

  const payload = parseJsonLike(responseText);

  return { status: response.status, payload };
};

const proxyAdminRequest = async (request: NextRequest, path: string, method: "GET" | "POST" | "PUT" | "DELETE") => {
  const bodyText = (method === "POST" || method === "PUT") ? await request.text() : undefined;
  const { status, payload } = await requestAdmin(path, method, bodyText);

  return NextResponse.json(payload, {
    status,
  });
};

type VariantBuilder = (input: unknown) => unknown[];

type PathVariantBuilder = (path: string) => string[];

export const proxyAdminPostVariants = async (request: NextRequest, path: string, getVariants: VariantBuilder) => {
  const inputText = await request.text();
  const parsedInput = parseJsonLike(inputText);
  const variants = getVariants(parsedInput);
  let lastResponse: { status: number; payload: unknown } | null = null;

  for (const variant of variants) {
    const response = await requestAdmin(path, "POST", JSON.stringify(variant));
    const { status, payload } = response;
    lastResponse = response;
    if (status !== 400 && status !== 422) {
      return NextResponse.json(payload, { status });
    }
  }

  return NextResponse.json(lastResponse?.payload ?? { message: "Request failed (400)." }, { status: lastResponse?.status ?? 400 });
};

export const proxyAdminPostPathAndBodyVariants = async (
  request: NextRequest,
  path: string,
  getVariants: VariantBuilder,
  getPathVariants: PathVariantBuilder,
) => {
  const inputText = await request.text();
  const parsedInput = parseJsonLike(inputText);
  const variants = getVariants(parsedInput);
  const pathVariants = getPathVariants(path);

  let lastResponse: { status: number; payload: unknown } | null = null;

  for (const candidatePath of pathVariants) {
    for (const variant of variants) {
      const response = await requestAdmin(candidatePath, "POST", JSON.stringify(variant));
      const { status, payload } = response;
      lastResponse = response;

      if (status >= 200 && status < 300) {
        return NextResponse.json(payload, { status });
      }

      const retriable = status === 400 || status === 404 || status === 405 || status === 422;
      if (!retriable) {
        return NextResponse.json(payload, { status });
      }
    }
  }

  return NextResponse.json(lastResponse?.payload ?? { message: "Request failed." }, { status: lastResponse?.status ?? 400 });
};

export const proxyAdminPost = async (request: NextRequest, path: string) => proxyAdminRequest(request, path, "POST");

export const proxyAdminGet = async (request: NextRequest, path: string) => proxyAdminRequest(request, path, "GET");

export const proxyAdminPut = async (request: NextRequest, path: string) => proxyAdminRequest(request, path, "PUT");

export const proxyAdminDelete = async (request: NextRequest, path: string) => proxyAdminRequest(request, path, "DELETE");
