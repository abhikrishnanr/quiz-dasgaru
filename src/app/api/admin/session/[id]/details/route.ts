import { proxyAdminGet } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

export const GET = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    const { id } = await params;
    const res = await proxyAdminGet(request, `/session/${encodeURIComponent(id)}/details`);
    console.log("Admin Session Details Response:", JSON.stringify(res, null, 2));
    return res;
};
