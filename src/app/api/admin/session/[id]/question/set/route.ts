import { proxyAdminPostPathAndBodyVariants } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return proxyAdminPostPathAndBodyVariants(
    request,
    `/session/${encodeURIComponent(id)}/question/set`,
    (input) => {
      const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
      const allowedTeams = payload.allowedTeams && typeof payload.allowedTeams === "object"
        ? (payload.allowedTeams as Record<string, unknown>)
        : null;
      const allowedTeamIds = Array.isArray(allowedTeams?.teamIds)
        ? allowedTeams.teamIds
        : Array.isArray(payload.allowedTeamIds)
          ? payload.allowedTeamIds
          : undefined;

      return [
        payload,
        {
          questionId: payload.questionId,
          timerDurationSec: payload.timerDurationSec,
          allowedTeams: payload.allowedTeams,
          firstAnswerLocksAll: payload.firstAnswerLocksAll,
        },
        {
          questionId: payload.questionId,
          timerDurationSec: payload.timerDurationSec,
          allowedTeamIds,
          firstAnswerLocksAll: payload.firstAnswerLocksAll,
        },
        {
          questionId: payload.questionId,
          timerDurationSec: payload.timerDurationSec,
          allowedTeamIds,
        },
        {
          questionId: payload.questionId,
          timerDurationSec: payload.timerDurationSec,
        },
      ];
    },
    (path) => [
      path,
      path.replace("/question/set", "/question"),
      path.replace("/question/set", "/questions/set"),
      path.replace("/question/set", "/set-question"),
      path.replace("/question/set", "/select-question"),
    ],
  );
};
