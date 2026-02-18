import { postJson } from "@/src/lib/api/http";

export const team = {
  register: <TResponse = unknown, TBody extends Record<string, unknown> = Record<string, unknown>>(
    sessionId: string,
    body: TBody,
  ) => postJson<TResponse, TBody>(`/api/public/session/${encodeURIComponent(sessionId)}/team/register`, body),

  submitAnswer: <TResponse = unknown, TBody extends Record<string, unknown> = Record<string, unknown>>(
    sessionId: string,
    body: TBody,
  ) => postJson<TResponse, TBody>(`/api/public/session/${encodeURIComponent(sessionId)}/answer`, body),
};
