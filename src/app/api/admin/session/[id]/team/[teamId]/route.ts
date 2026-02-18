import { NextRequest, NextResponse } from "next/server";
import { proxyAdminPost, proxyAdminPut, proxyAdminDelete } from "@/src/app/api/admin/_lib/proxy";

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; teamId: string }> }
) {
    const { id, teamId } = await params;
    console.log(`[Team Generation] Handling PUT for Session: ${id}, Team: ${teamId}`);

    // Proxy PUT request to create/update team
    const res = await proxyAdminPut(request, `/session/${encodeURIComponent(id)}/team/${encodeURIComponent(teamId)}`);
    console.log(`[Team Generation] Upstream Response Status: ${res.status}`);
    return res;
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; teamId: string }> }
) {
    const { id, teamId } = await params;
    console.log(`[DEBUG] Attempting DELETE for Session: ${id}, Team: ${teamId}`);

    // Proxy DELETE request to remove team
    const res = await proxyAdminDelete(request, `/session/${encodeURIComponent(id)}/team/${encodeURIComponent(teamId)}`);
    console.log(`[DEBUG] DELETE Upstream Response Status: ${res.status}`);
    return res;
}


