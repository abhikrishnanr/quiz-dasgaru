import { NextRequest, NextResponse } from "next/server";
import { signTeamToken } from "@/src/lib/auth/jwt";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; teamId: string }> }
) {
    try {
        const { id, teamId } = await params;
        const body = await request.json();
        const { teamName, teamSecret } = body;

        if (!teamName) {
            return NextResponse.json({ message: "Team Name is required" }, { status: 400 });
        }

        const token = signTeamToken({
            teamId,
            sessionId: id,
            teamName,
            teamSecret
        });

        // Construct the full URL
        let origin = process.env.NEXT_PUBLIC_APP_URL;

        if (!origin) {
            const url = new URL(request.url);
            origin = url.origin;
            if (origin.includes('0.0.0.0')) {
                origin = origin.replace('0.0.0.0', 'localhost');
            }
        }

        const teamLink = `${origin}/team/play?token=${token}`;

        return NextResponse.json({ link: teamLink, token });
    } catch (error) {
        console.error("Failed to generate link:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
