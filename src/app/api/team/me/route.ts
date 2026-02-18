import { NextRequest, NextResponse } from "next/server";
import { verifyTeamToken } from "@/src/lib/auth/jwt";

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ message: "Missing or invalid authorization header" }, { status: 401 });
    }

    const token = authHeader.split(" ")[1];
    const payload = verifyTeamToken(token);

    if (!payload) {
        return NextResponse.json({ message: "Invalid or expired token" }, { status: 403 });
    }

    return NextResponse.json({
        teamId: payload.teamId,
        teamName: payload.teamName,
        sessionId: payload.sessionId
    });
}
