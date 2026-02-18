import { getJson } from "@/src/lib/api/http";

export const publicApi = {
  getSession: <TResponse = unknown>(sessionId: string) =>
    getJson<TResponse>(`/api/public/session/${encodeURIComponent(sessionId)}`),

  getCurrent: <TResponse = unknown>(sessionId: string) =>
    getJson<TResponse>(`/api/public/session/${encodeURIComponent(sessionId)}/current`),

  getLeaderboard: <TResponse = unknown>(sessionId: string) =>
    getJson<TResponse>(`/api/public/session/${encodeURIComponent(sessionId)}/leaderboard`),
};
