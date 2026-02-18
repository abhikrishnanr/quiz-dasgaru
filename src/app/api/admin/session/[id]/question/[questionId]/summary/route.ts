import { proxyAdminGet } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

export const GET = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; questionId: string }> },
) => {
    const { id, questionId } = await params;
    return proxyAdminGet(request, `/session/${encodeURIComponent(id)}/question/${encodeURIComponent(questionId)}/summary`);
};
