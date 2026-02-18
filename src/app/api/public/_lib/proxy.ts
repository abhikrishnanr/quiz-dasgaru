import { env } from '@/src/config/env';
import { NextRequest, NextResponse } from 'next/server';

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

const proxyPublicRequest = async (request: NextRequest, path: string, method: 'GET' | 'POST') => {
  const bodyText = method === 'POST' ? await request.text() : undefined;

  const response = await withTimeout(`${env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, '')}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
    },
    body: bodyText || undefined,
  });

  const responseText = await response.text();

  let payload: unknown = {};
  if (responseText) {
    try {
      payload = JSON.parse(responseText);
    } catch {
      payload = { message: responseText };
    }
  }

  return NextResponse.json(payload, {
    status: response.status,
  });
};

export const proxyPublicGet = async (request: NextRequest, path: string) => proxyPublicRequest(request, path, 'GET');
export const proxyPublicPost = async (request: NextRequest, path: string) => proxyPublicRequest(request, path, 'POST');
