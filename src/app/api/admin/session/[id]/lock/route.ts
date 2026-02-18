import { proxyAdminPostPathAndBodyVariants } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return proxyAdminPostPathAndBodyVariants(
    request,
    `/session/${encodeURIComponent(id)}/lock`,
    () => [{}, { lock: true }],
    (path) => [
      path,
      path.replace("/lock", "/question/lock"),
      path.replace("/lock", "/close"),
      path.replace("/lock", "/stop"),
    ],
  );
};
