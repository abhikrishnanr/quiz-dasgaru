import { NextRequest, NextResponse } from "next/server";
import { verifyTeamToken } from "@/src/lib/auth/jwt";
import { requestAdmin } from "@/src/app/api/admin/_lib/proxy";

export async function POST(request: NextRequest) {
    // 1. Verify Auth
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const token = authHeader.split(" ")[1];
    const payload = verifyTeamToken(token);
    if (!payload) {
        return NextResponse.json({ message: "Invalid Token" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { answerKey, selectedKey, questionId, action } = body;
        let finalKey = answerKey || selectedKey;

        if (!questionId) {
            return NextResponse.json({ message: "Missing question ID" }, { status: 400 });
        }

        // 2. Submit to Admin API
        // Correct Endpoint: /session/{sessionId}/answer
        // Payload: { teamId, teamSecret, questionId, selectedKey }
        const rawPayload: any = {
            teamId: payload.teamId,
            teamName: payload.teamName,
            sessionId: payload.sessionId,
            teamSecret: payload.teamSecret || "",
            questionId: questionId,
            selectedKey: finalKey,
            answerKey: finalKey,
            action: body.action || "ANSWER",
            timestamp: Date.now(),
            passed: body.action === 'PASS',
            buzz: body.action === 'BUZZ' || body.action === 'BUZZ_ANSWER'
        };

        // FINAL SAFEGUARD: Remove any remaining undefined values
        Object.keys(rawPayload).forEach(key => {
            if (rawPayload[key] === undefined || rawPayload[key] === null) {
                delete rawPayload[key];
            }
        });

        console.log("====================================================");
        console.log(`[SUBMIT] Action: ${rawPayload.action} | Team: ${rawPayload.teamId} | Question: ${rawPayload.questionId}`);
        if (rawPayload.action === 'PASS') {
            console.log(`[PASS DEBUG] Team ${rawPayload.teamId} is passing question ${rawPayload.questionId}`);
            console.log(`[PASS DEBUG] Full payload sent to backend:`);
        }
        console.log(JSON.stringify(rawPayload, null, 2));
        console.log("====================================================");

        const adminPayload = JSON.stringify(rawPayload);

        const { status, payload: responsePayload } = await requestAdmin(
            `/session/${encodeURIComponent(payload.sessionId)}/answer`,
            "POST",
            adminPayload
        );

        if (status >= 200 && status < 300) {
            if (rawPayload.action === 'PASS') {
                console.log(`[PASS DEBUG] Backend responded ${status} OK`);
                console.log(`[PASS DEBUG] Backend response body:`, JSON.stringify(responsePayload, null, 2));
                console.log(`[PASS DEBUG] Expected: concernTeamId should now be updated to next team`);
            }
            return NextResponse.json(responsePayload, { status });
        } else {
            console.error(`[SUBMIT ERROR] Status: ${status}`);
            console.error(`[SUBMIT ERROR] Action was: ${rawPayload.action}`);
            console.error(`[SUBMIT ERROR] Backend response:`, JSON.stringify(responsePayload, null, 2));
            console.error(`[SUBMIT ERROR] Request Payload:`, JSON.stringify(rawPayload, null, 2));
            return NextResponse.json(responsePayload || { message: "Failed to submit" }, { status });
        }

    } catch (e) {
        console.error("Submit Error:", e);
        return NextResponse.json({ message: "Internal Error", error: String(e) }, { status: 500 });
    }
}
