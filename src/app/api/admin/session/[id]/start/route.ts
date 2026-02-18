import { proxyAdminPostPathAndBodyVariants } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return proxyAdminPostPathAndBodyVariants(
    request,
    `/session/${encodeURIComponent(id)}/start`,
    (input) => {
      const payload = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
      return [payload, { autoStartTimer: payload.autoStartTimer }, {}];
    },
    (path) => [
      path,
      path.replace("/start", "/question/start"),
      path.replace("/start", "/go-live"),
      path.replace("/start", "/open"),
    ],
  );
};
