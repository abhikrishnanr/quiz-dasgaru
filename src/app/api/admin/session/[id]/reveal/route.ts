import { proxyAdminPostPathAndBodyVariants } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return proxyAdminPostPathAndBodyVariants(
    request,
    `/session/${encodeURIComponent(id)}/reveal`,
    () => [{}, { reveal: true }],
    (path) => [
      path,
      path.replace("/reveal", "/question/reveal"),
      path.replace("/reveal", "/show-answer"),
      path.replace("/reveal", "/result"),
    ],
  );
};
