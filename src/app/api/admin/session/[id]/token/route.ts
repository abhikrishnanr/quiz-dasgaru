
import { NextRequest, NextResponse } from "next/server";
import { generateDisplayToken } from "@/src/lib/security";

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    const { id } = await props.params;
    // In a real app, we should check admin session/cookie here
    // Since this route is under /admin/..., we assume it's protected or accessible only to admin

    const token = generateDisplayToken(id);
    return NextResponse.json({ token });
}
