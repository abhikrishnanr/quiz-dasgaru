import { requestAdmin } from "@/src/app/api/admin/_lib/proxy";
import { NextRequest, NextResponse } from "next/server";
import { verifyDisplayToken } from "@/src/lib/security";

export const dynamic = 'force-dynamic';

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ token: string }> },
) {
    const params = await props.params;
    const { token } = params;

    // 1. Parse Token (format: sessionId__secret or sessionId_secret)
    let sessionId = "";
    let secret = "";

    if (token.includes("__")) {
        const parts = token.split("__");
        sessionId = parts[0];
        secret = parts[1];
    } else if (token.includes("_")) {
        // Fallback for single underscore: split by LAST underscore
        const lastIdx = token.lastIndexOf("_");
        sessionId = token.substring(0, lastIdx);
        secret = token.substring(lastIdx + 1);
    }

    if (!sessionId || !secret) {
        return NextResponse.json({ message: "Invalid token format. Expected sessionId__token", attemptedToken: token }, { status: 400 });
    }

    try {
        // 2. Fetch Session Details to validate token
        const { status: sessionStatus, payload: rawSessionPayload } = await requestAdmin(
            `/session/${encodeURIComponent(sessionId)}/details`,
            "GET"
        );
        const sessionData = rawSessionPayload as any;

        if (sessionStatus !== 200 || !sessionData) {
            return NextResponse.json({
                message: "Session not found",
                sessionId: sessionId,
                error: "DYNAMO_404"
            }, { status: 404 });
        }

        // Validate Token Secret (Stateless)
        const isValid = verifyDisplayToken(sessionId, secret);
        if (!isValid) {
            return NextResponse.json({
                message: "Unauthorized access - Token mismatch",
                sessionId: sessionId,
                error: "TOKEN_INVALID"
            }, { status: 403 });
        }

        // 3. Fetch Answers
        const { status: answersStatus, payload: rawAnswersPayload } = await requestAdmin(
            `/session/${encodeURIComponent(sessionId)}/answers`,
            "GET"
        );
        const answersData = rawAnswersPayload as any;

        if (answersStatus !== 200) {
            return NextResponse.json({ message: "Failed to fetch answers" }, { status: 500 });
        }

        // 4. Aggregate Scores by Mode (Standard vs Buzzer)
        const teams = sessionData.teams || [];
        const answers = answersData.answers || [];
        const questions = sessionData.questions || [];

        // Setup scores map
        const teamScores: Record<string, {
            name: string;
            standard: number;
            buzzer: number;
            total: number;
        }> = {};

        teams.forEach((t: any) => {
            teamScores[t.teamId] = {
                name: t.teamName,
                standard: 0,
                buzzer: 0,
                total: 0
            };
        });

        const uniqueAnsweredQIds = new Set<string>();

        // Calculate scores based on answers
        answers.forEach((ans: any) => {
            const team = teamScores[ans.teamId];
            if (!team) return;

            const question = questions.find((q: any) => q.questionId === ans.questionId);
            if (!question) return;

            if (ans.isCorrect || ans.action === 'BUZZ_ANSWER') {
                uniqueAnsweredQIds.add(ans.questionId);
            }

            let points = ans.awardedPoints;
            if (points === undefined && ans.isCorrect) {
                points = question.points || 0;
            }

            const score = points || 0;
            const isBuzzer = ans.isBuzzer || ans.action === 'BUZZ' || ans.action === 'BUZZ_ANSWER';

            if (isBuzzer) {
                team.buzzer += score;
            } else {
                team.standard += score;
            }
            team.total += score;
        });

        // Calculate Top Performers for Summary
        const allStats = Object.values(teamScores);
        const topStandard = [...allStats].sort((a, b) => b.standard - a.standard)[0];
        const topBuzzer = [...allStats].sort((a, b) => b.buzzer - a.buzzer)[0];

        // Create active question object if available
        const currentQId = sessionData.session.currentQuestionId;
        const currentQuestion = currentQId ? questions.find((q: any) => q.questionId === currentQId) : null;
        const questionState = sessionData.session.questionState;

        // Convert to array and sort leaderboard
        const leaderboard = allStats.sort((a, b) => b.total - a.total);

        // Add Rank
        const rankedLeaderboard = leaderboard.map((item, index) => ({
            rank: index + 1,
            ...item
        }));

        // Mask question details based on state
        const sanitizedQuestion = currentQuestion ? {
            id: currentQuestion.questionId,
            text: currentQuestion.questionText,
            options: currentQuestion.options || [],
            category: currentQuestion.category,
            topic: currentQuestion.topic,
            difficulty: currentQuestion.difficulty,
            points: currentQuestion.points,
            correctAnswer: questionState === 'REVEALED' ? currentQuestion.correctKey : undefined
        } : null;

        // Format recent answers for the feed (masking details if needed)
        const recentAnswers = answers
            .filter((a: any) => a.questionId === currentQId)
            .sort((a: any, b: any) => b.submittedAt - a.submittedAt) // newest first for display feed
            .map((a: any) => ({
                teamName: teamScores[a.teamId]?.name || "Unknown Team",
                submittedAt: a.submittedAt,
                action: a.action,
                selectedKey: a.selectedKey,
                isCorrect: questionState === 'REVEALED' ? a.isCorrect : undefined
            }))
            .slice(0, 10); // show last 10 activities

        return NextResponse.json({
            session: {
                eventName: sessionData.session.eventName,
                statusLabel: sessionData.session.statusLabel,
                questionState: questionState,
                timerDurationSec: sessionData.session.timerDurationSec,
                questionStartedAt: sessionData.session.questionStartedAt,
                gameMode: sessionData.session.gameMode
            },
            currentQuestion: sanitizedQuestion,
            recentAnswers: recentAnswers,
            leaderboard: rankedLeaderboard,
            summary: {
                topStandard: topStandard ? { name: topStandard.name, score: topStandard.standard } : null,
                topBuzzer: topBuzzer ? { name: topBuzzer.name, score: topBuzzer.buzzer } : null,
                totalQuestionsAnswered: uniqueAnsweredQIds.size,
                totalTeams: teams.length
            }
        });

    } catch (error) {
        console.error("Display API Error:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
