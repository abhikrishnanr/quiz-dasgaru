import { proxyAdminDelete, proxyAdminPut } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest } from "next/server";

export const DELETE = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; questionId: string }> },
) => {
    const { id, questionId } = await params;
    return proxyAdminDelete(request, `/session/${encodeURIComponent(id)}/question/${encodeURIComponent(questionId)}`);
};

export const PUT = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string; questionId: string }> },
) => {
    const { id, questionId } = await params;
    return proxyAdminPut(request, `/session/${encodeURIComponent(id)}/question/${encodeURIComponent(questionId)}`);
};
