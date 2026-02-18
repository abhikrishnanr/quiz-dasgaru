import { NextRequest } from "next/server";
import { proxyAdminPost } from "@/src/app/api/admin/_lib/proxy";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; teamId: string }> }
) {
    const { id, teamId } = await params;
    // Proxy POST request to update team status
    return proxyAdminPost(request, `/session/${encodeURIComponent(id)}/team/${encodeURIComponent(teamId)}/status`);
}
