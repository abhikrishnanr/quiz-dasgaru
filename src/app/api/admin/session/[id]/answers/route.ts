import { requestAdmin } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export const GET = async (
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) => {
    const { id } = await params;
    // Forward query parameters like questionId
    const searchParams = request.nextUrl.searchParams.toString();
    const query = searchParams ? `?${searchParams}` : "";

    const { status, payload } = await requestAdmin(`/session/${encodeURIComponent(id)}/answers${query}`, "GET");
    return NextResponse.json(payload, { status });
};
