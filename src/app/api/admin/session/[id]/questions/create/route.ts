import { proxyAdminPostPathAndBodyVariants } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

const getOptionKey = (index: number) => String.fromCharCode(65 + index);

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return proxyAdminPostPathAndBodyVariants(
    request,
    `/session/${encodeURIComponent(id)}/questions/create`,
    (input) => {
      const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
      const sourceOptions = Array.isArray(payload.options) ? payload.options : [];
      const normalizedOptions = sourceOptions.map((option, index) => {
        if (typeof option === "string") return { key: getOptionKey(index), text: option };
        if (option && typeof option === "object") {
          const safe = option as Record<string, unknown>;
          return {
            key: typeof safe.key === "string" && safe.key.trim() ? safe.key.trim() : getOptionKey(index),
            text: typeof safe.text === "string" ? safe.text : typeof safe.label === "string" ? safe.label : "",
          };
        }
        return { key: getOptionKey(index), text: "" };
      });

      const correctOptionIndex = Number(payload.correctOptionIndex);
      const fallbackCorrectOptionKey = Number.isFinite(correctOptionIndex) && correctOptionIndex >= 0
        ? getOptionKey(correctOptionIndex)
        : undefined;
      const correctOptionKey = typeof payload.correctOptionKey === "string"
        ? payload.correctOptionKey
        : typeof payload.correctKey === "string"
          ? payload.correctKey
          : fallbackCorrectOptionKey;

      const text = typeof payload.text === "string"
        ? payload.text
        : typeof payload.questionText === "string"
          ? payload.questionText
          : undefined;

      return [
        payload,
        {
          questionId: payload.questionId,
          questionText: text,
          options: normalizedOptions,
          correctKey: correctOptionKey,
          points: payload.points,
          orderIndex: payload.orderIndex ?? 1,
          hint: payload.hint,
          difficulty: payload.difficulty,
          topic: payload.topic,
        },
        {
          questionId: payload.questionId,
          text,
          options: normalizedOptions,
          correctOptionKey,
          timerDurationSec: payload.timerDurationSec,
          points: payload.points,
          questionType: payload.questionType,
          hint: payload.hint,
          difficulty: payload.difficulty,
          topic: payload.topic,
        },
        {
          questionId: payload.questionId,
          text,
          options: normalizedOptions,
          correctOptionIndex: Number.isFinite(correctOptionIndex) ? correctOptionIndex : undefined,
          timerDurationSec: payload.timerDurationSec,
          points: payload.points,
          hint: payload.hint,
          difficulty: payload.difficulty,
          topic: payload.topic,
        },
        {
          questionId: payload.questionId,
          questionText: text,
          options: normalizedOptions,
          correctOptionKey,
          correctKey: correctOptionKey,
          hint: payload.hint,
          difficulty: payload.difficulty,
          topic: payload.topic,
        },
      ];
    },
    (path) => [
      path,
      path.replace("/questions/create", "/question/create"),
      path.replace("/questions/create", "/questions"),
      path.replace("/questions/create", "/question"),
    ],
  );
};
