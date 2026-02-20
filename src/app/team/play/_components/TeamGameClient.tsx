'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useGameSounds } from '@/src/hooks/useGameSounds';
import { formatTeamName } from '@/src/lib/format';

interface TeamAuth {
    teamId: string;
    teamName: string;
    sessionId: string;
}

export function TeamGameClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token');

    const [auth, setAuth] = useState<TeamAuth | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [gameState, setGameState] = useState<any>(null);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [hasPassed, setHasPassed] = useState(false); // Tracks if team passed this question
    const [askAiText, setAskAiText] = useState('');
    const [isMicActive, setIsMicActive] = useState(false);

    // Sound integration
    const { play } = useGameSounds();
    const lastStateRef = useRef<string | null>(null);

    // Timer Logic
    const [timeLeft, setTimeLeft] = useState(0);
    const totalTime = 30; // 30 seconds default

    useEffect(() => {
        if (!token) {
            setError('Missing access token. Please use the link provided by the Game Master.');
            setLoading(false);
            return;
        }

        // Verify token with backend
        fetch('/api/team/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => {
                if (!res.ok) throw new Error('Invalid or expired token');
                return res.json();
            })
            .then(data => {
                setAuth(data);
                setLoading(false);
            })
            .catch(err => {
                setError(err.message);
                setLoading(false);
            });

    }, [token]);

    // Polling Logic
    useEffect(() => {
        if (!token || loading) return;

        const poll = async () => {
            try {
                const res = await fetch('/api/team/game-state', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();

                    // Sound Triggers
                    if (data.state !== lastStateRef.current) {
                        if (data.state === 'LIVE') play('live');
                        if (data.state === 'LOCKED') play('lock');
                        if (data.state === 'REVEALED') {
                            // Check if we participated to verify correctness? 
                            // Client doesn't easily know if they were *correct* without logic here.
                            // For now, simpler: just play reveal sound.
                            // Actually, let's try to deduce it if we have question data.
                            // But 'submit' doesn't return correctness immediately.
                            // Let's just play a generic reveal or check client selection.
                            // Wait, we have data.question.correctAnswer in REVEALED state!
                            if (selectedOption) {
                                if (selectedOption === data.question?.correctAnswer) play('reveal_correct');
                                else play('reveal_wrong');
                            } else {
                                // Did not answer
                            }
                        }
                    }
                    lastStateRef.current = data.state;

                    setGameState(data);
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        };

        poll(); // Initial call
        const interval = setInterval(poll, 1000); // 1s polling
        return () => clearInterval(interval);
    }, [token, loading, play, selectedOption]);

    useEffect(() => {
        if (gameState?.state === 'LIVE') {
            const qId = gameState.question?.id;
            if (!qId) return;

            // Server-synced Timer Logic
            const serverNow = gameState.serverNowEpochMs || Date.now();
            const startedAt = gameState.questionStartedAt || serverNow;
            const durationSec = gameState.timerDurationSec || 20;

            // Calculate how much time has passed according to server
            // We use Date.now() for local drift correction if needed, but simple subtraction is robust enough for polling
            // Actually, to keep it smooth between polls, we should calculate the target end time in local frame

            // Local Reference Time
            const localNow = Date.now();
            const timeOffset = localNow - serverNow;

            // When does the question end in local time?
            const questionEndLocal = (startedAt + timeOffset) + (durationSec * 1000);

            const updateTimer = () => {
                const now = Date.now();
                const msRemaining = questionEndLocal - now;
                const secRemaining = Math.max(0, Math.ceil(msRemaining / 1000));
                setTimeLeft(secRemaining);
            };

            updateTimer(); // Immediate update

            const timer = setInterval(updateTimer, 200); // Update frequently to avoid drift
            return () => clearInterval(timer);
        } else {
            setTimeLeft(0);
        }
    }, [gameState?.state, gameState?.question?.id, gameState?.serverNowEpochMs, gameState?.questionStartedAt, gameState?.timerDurationSec]);

    // Reset selection AND pass state when question changes
    useEffect(() => {
        setSelectedOption(null);
        setIsSubmitting(false);
        setHasPassed(false);
        setIsMicActive(false);
    }, [gameState?.question?.id]);



    const submitAskAiQuestion = async () => {
        if (!token || !isAskAiConcernTeam) return;
        const finalText = askAiText.trim();
        if (!finalText) {
            alert('Please enter a question before sending.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch('/api/team/ask-ai', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: finalText }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                alert(data.message || 'Failed to send ASK_AI question.');
                return;
            }

            setAskAiText('');
        } catch (error) {
            console.error('ASK_AI submit error', error);
            alert('Failed to send ASK_AI question.');
        } finally {
            setIsSubmitting(false);
        }
    };


    if (loading) {
    
    return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
                <div className="bg-red-500/10 border border-red-500 rounded-lg p-6 max-w-md w-full text-center">
                    <h2 className="text-red-500 text-xl font-bold mb-2">Access Denied</h2>
                    <p className="text-red-300">{error}</p>
                </div>
            </div>
        );
    }

    const { state, question } = gameState || {};
    const isLive = state === 'LIVE';
    const isRevealed = state === 'REVEALED';

    // Game Logic Checks
    const gameMode = gameState?.mode || gameState?.gameMode || 'STANDARD';
    const concernTeamId = gameState?.concernTeamId;
    const buzzOwnerTeamId = gameState?.buzzOwnerTeamId;

    const myTeamId = auth?.teamId;
    const isAskAiMode = gameMode === 'ASK_AI';
    const isAskAiConcernTeam = concernTeamId ? concernTeamId === myTeamId : false;

    // Standard Mode: Am I the concern team?
    const isStandard = gameMode === 'STANDARD';
    // In BUZZER mode, everyone is technically a concern team until someone buzzes
    const isConcernTeam = isStandard ? (concernTeamId ? concernTeamId === myTeamId : true) : true;


    // Buzzer Mode: Do I have the buzz?
    const isBuzzer = gameMode === 'BUZZER';
    const iHaveBuzz = buzzOwnerTeamId === myTeamId;
    const someoneElseHasBuzz = buzzOwnerTeamId && !iHaveBuzz;

    // Determine if I can interact with options
    // hasPassed locks out answering for the rest of this question
    let canAnswer = isLive && !isSubmitting && !isRevealed && selectedOption === null && !hasPassed;
    let message = "";

    if (hasPassed) {
        canAnswer = false;
        message = ""; // Handled by dedicated pass UI panel
    } else if (isStandard) {
        if (!isConcernTeam) {
            canAnswer = false;
            message = "Waiting for Concern Team to answer...";
        }
    } else if (isBuzzer) {
        // Can only answer if I have the buzz
        if (!iHaveBuzz) {
            canAnswer = false;
            if (someoneElseHasBuzz) {
                message = "Another team buzzed in!";
            } else {
                message = "Buzz to answer!";
            }
        } else {
            message = "You have the buzz! Answer now!";
        }
    }

    const handleBuzz = () => {
        submitAnswer("BUZZ");
    };

    // Override submitAnswer to handle action type
    const submitAnswer = async (key: string, actionType: 'BUZZ' | 'PASS' | undefined = undefined) => {
        if (!token || isSubmitting) return;
        setIsSubmitting(true);
        if (key !== "BUZZ") setSelectedOption(key);

        try {
            const body: any = {
                questionId: gameState?.question?.id,
                teamId: auth?.teamId // Redundant if token has it, but safe
            };

            if (key === "BUZZ") {
                body.action = 'BUZZ';
                body.answerKey = 'BUZZ';
                body.selectedKey = 'BUZZ';
            } else if (key === "PASS") {
                body.action = 'PASS';
                body.answerKey = 'PASS';
                body.selectedKey = 'PASS';
            } else {
                // Determine if this is a standard answer or a buzzer-mode answer
                body.action = isBuzzer ? 'BUZZ_ANSWER' : 'ANSWER';
                body.answerKey = key;
                body.selectedKey = key; // Backwards compat
            }

            const res = await fetch('/api/team/submit', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                // Mark as passed so UI locks out for this question
                if (key === "PASS") setHasPassed(true);
            } else {
                const data = await res.json().catch(() => ({}));
                if (res.status === 409) {
                    // Already submitted — treat as passed/answered
                    if (key === "PASS") setHasPassed(true);
                } else {
                    alert(`Failed: ${data.message || 'Error'}\nDebug: ${JSON.stringify(data.error || data)}`);
                    if (key !== "BUZZ") setSelectedOption(null);
                }
            }
        } catch (e) {
            console.error("Submit error", e);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white flex flex-col">
            <header className="border-b border-slate-800 p-4 flex justify-between items-center bg-slate-900/50 backdrop-blur sticky top-0 z-10">
                <div>
                    <h1 className="font-bold text-lg">{formatTeamName(auth?.teamName)}</h1>
                    <div className="flex flex-col text-xs text-slate-400 font-mono">
                        <span>ID: {auth?.teamId}</span>
                        <span className="text-indigo-400 font-bold">{gameMode} MODE</span>
                    </div>
                </div>
                <div className="text-right flex items-center gap-4">
                    {/* Timer Display - Always visible if Live */}
                    {isLive && (
                        <div className="text-center">
                            <div className={`text-2xl font-bold font-mono leading-none ${timeLeft < 10 ? 'text-rose-400' : 'text-white'}`}>
                                {timeLeft}s
                            </div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-wider">Remaining</div>
                        </div>
                    )}

                    <div>
                        <div className="text-xs text-slate-500 uppercase tracking-widest">Status</div>
                        <div className={`font-bold flex items-center gap-2 ${state === 'LIVE' ? 'text-green-400' : 'text-slate-400'}`}>
                            <span className={`w-2 h-2 rounded-full ${state === 'LIVE' ? 'bg-green-500 animate-pulse' : 'bg-slate-500'}`}></span>
                            {state || 'CONNECTED'}
                        </div>
                    </div>
                </div>
            </header>

            {/* Progress Bar - Visible Track */}
            {isLive && (
                <div className="h-2 bg-slate-700 w-full relative">
                    <div
                        className={`h-full transition-all duration-1000 ease-linear ${timeLeft < 10 ? 'bg-rose-500' : timeLeft < 20 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${(timeLeft / totalTime) * 100}%` }}
                    />
                </div>
            )}

            <main className="flex-1 p-4 md:p-8 max-w-3xl mx-auto w-full flex flex-col justify-center">
                {isAskAiMode ? (
                    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl space-y-4">
                        <h2 className="text-2xl font-bold text-emerald-300">ASK AI ROUND</h2>
                        {!isAskAiConcernTeam ? (
                            <p className="text-slate-300">Waiting… Team {gameState?.concernTeamName || concernTeamId || 'Selected Team'} is asking now.</p>
                        ) : (
                            <>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setIsMicActive((value) => !value)}
                                        className={`px-4 py-2 rounded-full font-bold text-sm ${isMicActive ? 'bg-rose-600 text-white' : 'bg-slate-700 text-slate-100'}`}
                                    >
                                        {isMicActive ? '⏹ Stop Mic' : '🎤 Start Mic'}
                                    </button>
                                    <span className="text-xs text-slate-400">Failsafe typing input is available below.</span>
                                </div>
                                <textarea
                                    value={askAiText}
                                    onChange={(event) => setAskAiText(event.target.value)}
                                    className="w-full min-h-40 rounded-xl border border-slate-600 bg-slate-900 px-4 py-3 text-white"
                                    placeholder="Type your question for ASK AI round..."
                                    disabled={isSubmitting}
                                />
                                <button
                                    onClick={submitAskAiQuestion}
                                    disabled={isSubmitting || !askAiText.trim()}
                                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold"
                                >
                                    Send
                                </button>
                            </>
                        )}
                        {gameState?.askAiAnswer?.text && (
                            <div className="rounded-xl border border-slate-600 bg-slate-900/70 p-4">
                                <p className="text-xs uppercase text-slate-400 mb-1">AI Answer</p>
                                <p className="text-slate-100">{gameState.askAiAnswer.text}</p>
                            </div>
                        )}
                    </div>
                ) : !question ? (
                    <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700 shadow-xl text-center">
                        <h2 className="text-2xl font-light text-slate-300 mb-6">Waiting for Game Master...</h2>
                        <div className="flex justify-center gap-2">
                            <span className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce delay-0"></span>
                            <span className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce delay-100"></span>
                            <span className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce delay-200"></span>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="bg-slate-800 rounded-2xl p-6 md:p-10 border border-slate-700 shadow-2xl relative overflow-hidden">
                            {/* Header Row: Topic & Points */}
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    {question.topic ? (
                                        <span className="bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                                            {question.topic}
                                        </span>
                                    ) : question.difficulty && (
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${question.difficulty === 'easy' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' :
                                            question.difficulty === 'hard' ? 'text-rose-400 border-rose-400/30 bg-rose-400/10' :
                                                'text-amber-400 border-amber-400/30 bg-amber-400/10'
                                            }`}>
                                            {question.difficulty}
                                        </span>
                                    )}
                                </div>
                                <div className="bg-slate-700 text-slate-300 px-3 py-1 rounded-full text-xs font-bold font-mono">
                                    {question.points} PTS
                                </div>
                            </div>

                            <h2 className="text-2xl md:text-3xl font-medium leading-tight text-white mb-2">
                                {question.text}
                            </h2>
                            {message && isLive && (
                                <div className="mt-4 p-3 bg-indigo-500/20 text-indigo-200 rounded-lg text-sm font-bold animate-pulse text-center">
                                    {message}
                                </div>
                            )}
                        </div>

                        {/* Buzzer Button */}
                        {isBuzzer && isLive && !iHaveBuzz && !someoneElseHasBuzz && (
                            <button
                                onClick={handleBuzz}
                                disabled={isSubmitting}
                                className="w-full py-12 bg-pink-600 hover:bg-pink-500 active:bg-pink-700 text-white rounded-3xl font-black text-4xl shadow-2xl transform transition-all active:scale-95 flex flex-col items-center justify-center gap-2"
                            >
                                <span>🚨 BUZZ!</span>
                                <span className="text-sm font-normal opacity-75">Click first to answer!</span>
                            </button>
                        )}

                        <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 transition-opacity duration-300 ${!canAnswer && !isRevealed ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
                            {question.options?.map((opt: any) => {
                                const isSelected = selectedOption === opt.key;
                                const isCorrect = isRevealed && question.correctAnswer === opt.key;
                                const isWrong = isRevealed && isSelected && !isCorrect;

                                // Lock if submitted or not live
                                const isLocked = !canAnswer;

                                let btnClass = "bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200";

                                if (isRevealed) {
                                    if (isCorrect) btnClass = "bg-green-600 border-green-500 text-white ring-2 ring-green-400 ring-offset-2 ring-offset-slate-900";
                                    else if (isWrong) btnClass = "bg-red-600 border-red-500 text-white opacity-50";
                                    else btnClass = "bg-slate-800 border-slate-700 opacity-50";
                                } else if (isSelected) {
                                    btnClass = "bg-indigo-600 border-indigo-500 text-white ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900";
                                } else if (isLocked) {
                                    btnClass = "bg-slate-800 border-slate-700 opacity-50 cursor-not-allowed";
                                }

                                return (
                                    <button
                                        key={opt.key}
                                        disabled={isLocked && !isRevealed}
                                        onClick={() => submitAnswer(opt.key)}
                                        className={`
                                            p-6 rounded-xl border-2 text-left transition-all duration-200
                                            flex items-center gap-4 group relative
                                            ${btnClass}
                                        `}
                                    >
                                        <span className={`
                                            w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm
                                            ${isSelected || isCorrect ? 'bg-white text-slate-900' : 'bg-slate-700 text-slate-400 group-hover:bg-slate-600'}
                                        `}>
                                            {opt.key}
                                        </span>
                                        <span className="font-medium text-lg">{opt.text}</span>

                                        {isSelected && !isRevealed && (
                                            <span className="absolute right-4 text-xs font-bold uppercase tracking-wider opacity-50">Selected</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Pass Section: Show confirmation panel OR pass button */}
                        {hasPassed ? (
                            <div className="mt-4 p-4 bg-slate-700/50 border border-slate-600 rounded-xl flex items-center justify-center gap-3 text-center">
                                <span className="text-2xl">🙅</span>
                                <div>
                                    <p className="text-slate-200 font-bold text-lg">Question Passed</p>
                                    <p className="text-slate-400 text-sm">Waiting for the Game Master to continue...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 flex justify-center">
                                <button
                                    disabled={!canAnswer || selectedOption !== null}
                                    onClick={() => submitAnswer("PASS", "PASS")}
                                    className={`
                                        px-6 py-3 rounded-lg border border-slate-600 text-slate-400 font-medium
                                        hover:bg-slate-800 hover:text-slate-200 transition-colors
                                        disabled:opacity-20 disabled:cursor-not-allowed
                                    `}
                                >
                                    Pass Question
                                </button>
                            </div>
                        )}

                        <div className="text-center">
                            {state === 'PREVIEW' && <p className="text-slate-400 animate-pulse">Get Ready...</p>}
                            {state === 'LIVE' && !message && <p className="text-green-400 font-bold">VOTE NOW!</p>}
                            {state === 'LOCKED' && <p className="text-yellow-500 font-bold">LOCKED</p>}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
