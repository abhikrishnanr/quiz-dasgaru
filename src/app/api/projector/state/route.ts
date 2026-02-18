import { NextRequest, NextResponse } from "next/server";
import { requestAdmin } from "@/src/app/api/admin/_lib/proxy";
import { AdminSessionDetails } from "@/src/app/admin/types";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
        return NextResponse.json({ message: "Session ID required" }, { status: 400 });
    }

    // Fetch Session Data (Public/Projector view doesn't need team token, but we should potentially secure this in prod)
    // For now, we assume having the Session ID is enough for read-only access to the question board.
    try {
        const { status, payload: data } = await requestAdmin(`/session/${encodeURIComponent(sessionId)}/details`, "GET");

        if (status !== 200 || !data) {
            return NextResponse.json({ message: "Session not found" }, { status: 404 });
        }

        const sessionDetails = data as AdminSessionDetails;
        const { session, questions, teams } = sessionDetails;

        // Determine State
        const currentState = session.questionState; // PREVIEW | LIVE | LOCKED | REVEALED
        const currentQId = session.currentQuestionId;

        // Sort teams for leaderboard (Top 5)
        const leaderboard = teams
            .sort((a, b) => b.totalScore - a.totalScore)
            .slice(0, 5)
            .map(t => ({ name: t.teamName, score: t.totalScore }));

        let currentQuestion = null;
        if (currentQId) {
            currentQuestion = questions.find(q => q.questionId === currentQId);
        }

        const responseData: any = {
            state: currentState,
            gameMode: session.gameMode || 'STANDARD',
            leaderboard,
            question: null
        };

        if (currentQuestion) {
            responseData.question = {
                id: currentQuestion.questionId,
                text: currentQuestion.questionText,
                options: currentQuestion.options || [],
                points: currentQuestion.points
            };

            if (currentState === 'REVEALED') {
                responseData.question.correctAnswer = currentQuestion.correctKey;
            }
        }

        return NextResponse.json(responseData);

    } catch (e) {
        console.error("Projector API Error:", e);
        return NextResponse.json({ message: "Internal Error" }, { status: 500 });
    }
}
