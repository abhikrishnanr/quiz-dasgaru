import { NextRequest, NextResponse } from "next/server";
import { verifyTeamToken } from "@/src/lib/auth/jwt";
import { requestAdmin } from "@/src/app/api/admin/_lib/proxy";
import { AdminSessionDetails } from "@/src/app/admin/types";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // 2. Fetch Session Data
    try {
        const { status, payload: data } = await requestAdmin(`/session/${encodeURIComponent(payload.sessionId)}/details`, "GET");

        if (status !== 200 || !data) {
            return NextResponse.json({ message: "Session not found" }, { status: 404 });
        }

        const sessionDetails = data as AdminSessionDetails;
        const { session, questions } = sessionDetails;

        // 3. Determine State
        const currentState = session.questionState; // PREVIEW | LIVE | LOCKED | REVEALED
        const currentQId = session.currentQuestionId;

        if (!currentQId) {
            return NextResponse.json({
                state: "WAITING",
                message: "No active question"
            });
        }

        const currentQuestion = questions.find(q => q.questionId === currentQId);
        if (!currentQuestion) {
            return NextResponse.json({
                state: "WAITING",
                message: "Question not found"
            });
        }

        // 4. Construct Response with Masking
        const responseData: any = {
            state: currentState,
            question: {
                id: currentQuestion.questionId,
                text: currentQuestion.questionText,
                options: currentQuestion.options || [],
                points: currentQuestion.points,
                topic: currentQuestion.topic,
                difficulty: currentQuestion.difficulty
            },
            mode: session.gameMode || 'STANDARD',
            concernTeamId: session.concernTeamId,
            buzzOwnerTeamId: session.buzzOwnerTeamId,
            // Timer Sync Data
            serverNowEpochMs: Date.now(),
            questionStartedAt: session.questionStartedAt,
            timerDurationSec: session.timerDurationSec || 20
        };

        // MASKING LOGIC
        if (currentState === 'REVEALED') {
            responseData.question.correctAnswer = currentQuestion.correctKey;
        } else {
            // Ensure no sensitive data leaks
            // (options are already safe, just key/text)
        }

        // DEBUG: Log key timer/state fields on every poll to detect changes after PASS
        const nowMs = Date.now();
        const startedAt = session.questionStartedAt || 0;
        const durSec = session.timerDurationSec || 20;
        const remainingSec = Math.max(0, Math.ceil(((startedAt + durSec * 1000) - nowMs) / 1000));
        console.log(`[GAME-STATE] state=${currentState} | concernTeamId=${session.concernTeamId} | questionStartedAt=${startedAt} | timerDurationSec=${durSec} | remainingSec=${remainingSec}`);

        return NextResponse.json(responseData);

    } catch (e) {
        console.error("Game State Error:", e);
        return NextResponse.json({ message: "Internal Error" }, { status: 500 });
    }
}
