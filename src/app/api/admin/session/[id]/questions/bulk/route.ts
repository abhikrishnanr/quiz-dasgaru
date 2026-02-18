import { proxyAdminPost } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

export const POST = async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  const { id } = await params;
  return proxyAdminPost(request, `/session/${encodeURIComponent(id)}/questions/bulk`);
};
