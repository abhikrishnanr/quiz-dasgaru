'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAudioController } from '@/src/hooks/useAudioController';
import AIHostAvatar from '@/src/components/AIHostAvatar';
import DisplayBackgroundFX from '@/src/components/DisplayBackgroundFX';

export default function DisplayPage() {
    const params = useParams();
    const token = typeof params.token === 'string' ? params.token : '';

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [errorPayload, setErrorPayload] = useState<any>(null);
    const [lastAnnouncedQuestionKey, setLastAnnouncedQuestionKey] = useState('');
    const [isTestAudioRunning, setIsTestAudioRunning] = useState(false);
    const [isScorePanelOpen, setIsScorePanelOpen] = useState(false);
    const [hostTranscript, setHostTranscript] = useState<string[]>([]);
    const { speak, isFetching, isSpeaking } = useAudioController();

    const pushHostLine = (line: string) => {
        const normalizedLine = line.trim();
        if (!normalizedLine) return;

        setHostTranscript((previous) => {
            const next = [...previous, normalizedLine];
            return next.slice(-6);
        });
    };

    useEffect(() => {
        if (!token) return;

        const fetchData = async () => {
            try {
                const res = await fetch(`/api/display/${token}`);
                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    setErrorPayload(errJson);

                    if (res.status === 404) setError('Session Not Found');
                    else if (res.status === 403) setError('Unauthorized Access');
                    else setError('Failed to load data');
                    return;
                }
                const result = await res.json();
                setData(result);
                setError('');
                setErrorPayload(null);
            } catch (err) {
                console.error(err);
                setError('Network Error');
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 1000); // Auto-refresh every 1s for near-live display
        return () => clearInterval(interval);
    }, [token]);

    // Timer state for display
    const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setCurrentTimeMs(Date.now()), 100);
        return () => clearInterval(t);
    }, []);

    const session = data?.session;
    const currentQuestion = data?.currentQuestion;
    const isLive = session?.questionState === 'LIVE';
    const startedAt = session?.questionStartedAt;
    const duration = session?.timerDurationSec || 20;

    useEffect(() => {
        if (!currentQuestion || !session) {
            return;
        }

        // Allow reading in 'LIVE' or any other active state (like 'READY'), but skip if finished.
        if (session.questionState === 'LOCKED' || session.questionState === 'REVEALED') {
            return;
        }

        // Use questionId AND concernTeamId as the unique key.
        // This ensures audio plays if the question changes OR if the target team changes (correction/re-activation).
        const questionKey = `${currentQuestion.id}-${session.concernTeamId || 'all'}`;
        if (questionKey === lastAnnouncedQuestionKey) {
            return;
        }

        const teamName = session.concernTeamName || 'all teams';
        const optionSpeech = Array.isArray(currentQuestion.options)
            ? currentQuestion.options.map((opt: any) => `${opt.key}. ${opt.text}`).join('. ')
            : '';

        const intro = `Question is for ${teamName}.`;
        const message = `${intro} Question: ${currentQuestion.text}. Options: ${optionSpeech}.`;

        setLastAnnouncedQuestionKey(questionKey);
        pushHostLine(message);
        void speak(message).then((played) => {
            console.info('[Display TTS] Auto announcement played:', played);
        });
    }, [currentQuestion, duration, lastAnnouncedQuestionKey, session, speak]);

    const runTestAudio = async () => {
        const sampleText = 'Audio test sample. If you can hear this, TTS playback is working on the display page.';
        setIsTestAudioRunning(true);
        try {
            const played = await speak(sampleText);
            console.info('[Display TTS] Sample test button result:', played);
        } catch (error) {
            console.error('[Display TTS] Sample test button failed:', error);
        } finally {
            setIsTestAudioRunning(false);
        }
    };

    if (loading && !data && !error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[#0f172a] px-6">
                <div className="text-center p-12 bg-slate-900 border border-slate-800 rounded-[3rem] shadow-2xl max-w-xl w-full relative overflow-hidden group">
                    {/* Decorative glow */}
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all duration-700"></div>

                    <div className="relative z-10">
                        <div className="text-7xl mb-8 drop-shadow-[0_0_20px_rgba(251,191,36,0.2)]">🔍</div>
                        <h1 className="text-4xl font-black tracking-tighter text-white mb-4 uppercase italic">
                            {error}
                        </h1>

                        <div className="space-y-6 mt-8">
                            {errorPayload?.sessionId && (
                                <div className="bg-slate-950/50 p-6 rounded-2xl border border-slate-800 inline-block w-full">
                                    <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Attempted Session ID</p>
                                    <p className="text-3xl font-mono font-black text-indigo-400">{errorPayload.sessionId}</p>
                                </div>
                            )}

                            <div className="text-slate-400 text-lg leading-relaxed">
                                {errorPayload?.error === 'DYNAMO_404' ? (
                                    <p>This session code was not found in our database. Please ensure the host has created the session and that the ID is exactly correct.</p>
                                ) : errorPayload?.error === 'TOKEN_INVALID' ? (
                                    <p>The security token for this session is invalid. Please get a fresh link from the Admin Dashboard.</p>
                                ) : (
                                    <p>Something went wrong while fetching the leaderboard. Please check your internet connection or try again later.</p>
                                )}
                            </div>

                            <button
                                onClick={() => window.location.reload()}
                                className="mt-8 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 shadow-lg shadow-indigo-600/25"
                            >
                                Try Refreshing
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const { leaderboard, recentAnswers } = data;
    const isLocked = session.questionState === 'LOCKED';
    const isRevealed = session.questionState === 'REVEALED';

    // Calc remaining time
    let remaining = 0;
    if (isLive && startedAt) {
        const elapsed = (currentTimeMs - startedAt) / 1000;
        remaining = Math.max(0, Math.ceil(duration - elapsed));
    }

    return (
        <div className="relative min-h-screen overflow-hidden bg-[#020720] text-white font-sans selection:bg-indigo-500/30">
            <DisplayBackgroundFX />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(56,189,248,0.09),transparent_32%,rgba(99,102,241,0.08),transparent_70%)]" />
            <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(to_right,rgba(59,130,246,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(59,130,246,0.08)_1px,transparent_1px)] [background-size:84px_84px]" />
            {/* Header */}
            <header className="relative bg-[#060d2a]/80 backdrop-blur-md border-b border-indigo-400/20 sticky top-0 z-20">
                <div className="max-w-[1920px] mx-auto px-6 py-4 flex justify-between items-center relative">
                    {/* Left Logo - Absolute positioned or flex depending on preference */}
                    <div className="flex items-center gap-4">
                        {/* Use standard img tag for external/local until configured in next.config or just for simplicity with public folder */}
                        <img src="/images/cdipd-logo.png" alt="Left Logo" className="h-16 w-auto object-contain" />
                    </div>

                    <div className="flex flex-col items-center">
                        <div className="flex items-center justify-center gap-3">
                            <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center text-xl font-black">Q</div>
                            <h1 className="text-2xl font-black tracking-tight text-white leading-none">
                                {session?.eventName || 'Quiz Leaderboard'}
                            </h1>
                        </div>
                        {session?.statusLabel && (
                            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black bg-indigo-500/10 text-indigo-400 uppercase tracking-widest border border-indigo-500/20">
                                {session.statusLabel}
                            </span>
                        )}
                    </div>


                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            {isFetching && (
                                <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 text-[10px] font-black uppercase tracking-widest border border-indigo-500/30 animate-pulse">
                                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                                    Generating Audio...
                                </span>
                            )}
                            {isSpeaking && (
                                <span className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-widest border border-emerald-500/30">
                                    <span className="flex gap-0.5 h-3 items-end">
                                        <span className="w-0.5 bg-emerald-400 animate-[bounce_1s_infinite] h-2"></span>
                                        <span className="w-0.5 bg-emerald-400 animate-[bounce_1.2s_infinite] h-3"></span>
                                        <span className="w-0.5 bg-emerald-400 animate-[bounce_0.8s_infinite] h-1.5"></span>
                                    </span>
                                    Speaking
                                </span>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={runTestAudio}
                            disabled={isTestAudioRunning || isFetching || isSpeaking}
                            className="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-300 font-black uppercase text-[11px] tracking-widest hover:bg-amber-500/25 disabled:opacity-60 disabled:cursor-not-allowed transition"
                        >
                            Test Audio
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsScorePanelOpen((prev) => !prev)}
                            className="px-4 py-2 rounded-xl bg-indigo-500/15 border border-indigo-400/30 text-indigo-300 font-black uppercase text-[11px] tracking-widest hover:bg-indigo-500/25 transition"
                        >
                            {isScorePanelOpen ? 'Hide Scores' : 'Show Scores'}
                        </button>
                        {isLive && (
                            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 px-4 py-2 rounded-xl">
                                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></div>
                                <span className="text-2xl font-mono font-black text-red-500">{remaining}s</span>
                            </div>
                        )}
                        <div className="text-right">
                            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Global Status</div>
                            <div className={`text-sm font-black uppercase tracking-tighter ${isLive ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {session.questionState}
                            </div>
                        </div>

                        <div className="ml-4 border-l border-slate-700 pl-4">
                            <img src="/images/duk-logo.png" alt="Right Logo" className="h-16 w-auto object-contain" />
                        </div>
                    </div>
                </div>
            </header>


            <aside className={`fixed inset-y-0 right-0 z-30 w-full max-w-3xl border-l border-slate-800 bg-[#0b1220]/95 backdrop-blur-xl shadow-2xl transform transition-transform duration-300 ${isScorePanelOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                <div className="h-full overflow-y-auto p-6 lg:p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-black tracking-tighter uppercase text-slate-200">Score Panel</h2>
                        <button
                            type="button"
                            onClick={() => setIsScorePanelOpen(false)}
                            className="px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-black uppercase text-[11px] tracking-widest hover:bg-slate-700 transition"
                        >
                            Close
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-3xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 text-indigo-500/10 text-6xl font-black italic select-none group-hover:text-indigo-500/20 transition-colors">STD</div>
                            <div className="relative z-10">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Standard Leader</h3>
                                <div className="flex items-end gap-3">
                                    <span className="text-3xl font-black text-white italic tracking-tighter truncate max-w-[70%]">{data.summary?.topStandard?.name || '---'}</span>
                                    <span className="text-lg font-mono font-black text-indigo-400 mb-1">{data.summary?.topStandard?.score || 0} pts</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-3xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 text-pink-500/10 text-6xl font-black italic select-none group-hover:text-pink-500/20 transition-colors">BZR</div>
                            <div className="relative z-10">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Buzzer Master</h3>
                                <div className="flex items-end gap-3">
                                    <span className="text-3xl font-black text-white italic tracking-tighter truncate max-w-[70%]">{data.summary?.topBuzzer?.name || '---'}</span>
                                    <span className="text-lg font-mono font-black text-pink-500 mb-1">{data.summary?.topBuzzer?.score || 0} pts</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-3xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 text-emerald-500/10 text-6xl font-black italic select-none group-hover:text-emerald-500/20 transition-colors">STAT</div>
                            <div className="relative z-10">
                                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Session Stats</h3>
                                <div className="flex gap-6">
                                    <div><div className="text-xs font-bold text-slate-500">Teams</div><div className="text-2xl font-black text-white">{data.summary?.totalTeams || 0}</div></div>
                                    <div><div className="text-xs font-bold text-slate-500">Answered</div><div className="text-2xl font-black text-white">{data.summary?.totalQuestionsAnswered || 0}</div></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-2xl font-black tracking-tighter uppercase text-slate-400">Leaderboard</h3>
                            <span className="text-xs font-bold text-slate-500 bg-slate-800 px-3 py-1 rounded-full">{leaderboard.length} Teams</span>
                        </div>
                        <div className="bg-slate-900/40 rounded-3xl border border-slate-800/50 shadow-2xl overflow-hidden backdrop-blur-sm">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-800/50 border-b border-slate-700/50 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">
                                            <th className="px-6 py-4 w-20 text-center">Rank</th><th className="px-6 py-4">Team</th><th className="px-6 py-4 text-right">Standard</th><th className="px-6 py-4 text-right">Buzzer</th><th className="px-6 py-4 text-right bg-indigo-600/10 text-indigo-400">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800/50">
                                        {leaderboard.map((team: any, index: number) => (
                                            <tr key={index} className="transition-all duration-300 group hover:bg-slate-800/30">
                                                <td className="px-6 py-5 text-center font-mono font-black text-slate-400">{index + 1}</td>
                                                <td className="px-6 py-5"><div className="font-black text-white text-xl tracking-tighter">{team.name}</div></td>
                                                <td className="px-6 py-5 text-right font-mono text-slate-500 text-lg">{team.standard}</td>
                                                <td className="px-6 py-5 text-right font-mono text-slate-500 text-lg">{team.buzzer}</td>
                                                <td className="px-6 py-5 text-right font-mono font-black text-2xl text-indigo-400 bg-indigo-500/[0.03]">{team.total}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>

            {isScorePanelOpen && (
                <button type="button" aria-label="Close score panel backdrop" onClick={() => setIsScorePanelOpen(false)} className="fixed inset-0 z-20 bg-slate-950/55" />
            )}

            {/* Main Content Grid */}
            <main className="relative z-10 max-w-[1920px] mx-auto p-6 lg:p-10">

                {/* Live Data */}
                <div className="space-y-10">

                    {/* 1. Active Question Panel */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500"></div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Active Question</h2>
                        </div>

                        {currentQuestion ? (
                            <div className="rounded-[2.25rem] p-8 md:p-10 shadow-[0_20px_120px_rgba(10,20,70,0.5)] border border-indigo-400/50 relative overflow-hidden bg-[#0a1238]/75 backdrop-blur-xl">
                                <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(99,102,241,0.15),transparent_38%,rgba(56,189,248,0.1),transparent_75%)]" />

                                <div className="relative z-10 grid gap-6 xl:grid-cols-4">
                                    <div className="xl:col-span-1">
                                        <AIHostAvatar isSpeaking={isSpeaking} size="lg" />
                                        <p className="mt-2 text-center text-xs font-semibold uppercase tracking-wide text-indigo-100/80">
                                            AI Host {isSpeaking ? 'Speaking…' : 'Standing by'}
                                        </p>

                                        <div className="mt-4 rounded-2xl border border-white/20 bg-slate-950/35 p-4">
                                            <h3 className="text-[10px] font-black uppercase tracking-[0.22em] text-indigo-100/80">Gemini Voice Transcript</h3>
                                            <ul className="mt-3 space-y-2 text-xs text-white/90">
                                                {hostTranscript.map((line, index) => (
                                                    <li key={`${index}-${line.slice(0, 24)}`} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 leading-relaxed">
                                                        {line}
                                                    </li>
                                                ))}
                                                {hostTranscript.length === 0 && (
                                                    <li className="rounded-xl border border-dashed border-white/20 bg-white/5 px-3 py-2 text-white/70">
                                                        Transcript appears here when Gemini reads the question.
                                                    </li>
                                                )}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="xl:col-span-3 space-y-6">
                                        <div className="bg-[#091131]/80 border border-indigo-300/30 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-3 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                                            <div>
                                                <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white/70">Question For Team</div>
                                                <div className="text-3xl font-black tracking-tight text-white italic drop-shadow-[0_0_15px_rgba(125,211,252,0.35)] animate-[pulse_5s_ease-in-out_infinite]">
                                                    {session.concernTeamName || 'All Teams'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-2 flex-wrap">
                                                {currentQuestion.category && (
                                                    <div className="bg-white/30 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border border-white/30 text-white">
                                                        {currentQuestion.category}
                                                    </div>
                                                )}
                                                <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border border-white/20 text-white/90">
                                                    {currentQuestion.topic || 'General'}
                                                </div>
                                                {currentQuestion.difficulty && (
                                                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter border ${currentQuestion.difficulty === 'HARD' ? 'bg-red-500/20 border-red-500/30 text-red-200' :
                                                        currentQuestion.difficulty === 'MEDIUM' ? 'bg-amber-500/20 border-amber-500/30 text-amber-200' :
                                                            'bg-emerald-500/20 border-emerald-500/30 text-emerald-200'
                                                        }`}>
                                                        {currentQuestion.difficulty}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="text-white/60 font-black text-sm uppercase">
                                                {currentQuestion.points} Points
                                            </div>
                                        </div>

                                        <h3 className="text-4xl lg:text-6xl font-black leading-[1.08] tracking-tight text-white">
                                            "{currentQuestion.text}"
                                        </h3>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {currentQuestion.options.map((opt: any) => {
                                                const isCorrect = isRevealed && opt.key === currentQuestion.correctAnswer;
                                                return (
                                                    <div
                                                        key={opt.key}
                                                        className={`px-5 py-4 rounded-2xl border transition-all duration-500 flex items-center gap-4 ${isCorrect
                                                            ? 'bg-emerald-500/85 border-emerald-300 text-white shadow-[0_0_35px_rgba(16,185,129,0.55)] scale-[1.02]'
                                                            : 'bg-[#091236]/85 border-indigo-300/20 text-white/95 hover:-translate-y-0.5 hover:border-indigo-300/45 hover:shadow-[0_0_35px_rgba(99,102,241,0.28)]'
                                                            }`}
                                                    >
                                                        <span className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-lg ${isCorrect ? 'bg-white text-emerald-600' : 'bg-cyan-300/15 text-cyan-100 border border-cyan-200/20'}`}>
                                                            {opt.key}
                                                        </span>
                                                        <span className="font-bold text-xl">{opt.text}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-slate-900/50 border border-slate-800 rounded-[2rem] p-12 text-center border-dashed">
                                <p className="text-slate-600 font-bold text-lg italic">Waiting for next question...</p>
                            </div>
                        )}
                    </div>

                    {/* 2. Response Feed */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-slate-500"></div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Live Activity Feed</h2>
                        </div>

                        <div className="space-y-3">
                            {recentAnswers.map((ans: any, idx: number) => (
                                <div
                                    key={idx}
                                    className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center justify-between hover:border-slate-700 transition-colors animate-fadeIn"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-slate-800 rounded-xl flex items-center justify-center text-xl">👤</div>
                                        <div>
                                            <div className="font-black tracking-tight text-white">{ans.teamName}</div>
                                            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                                                {new Date(ans.submittedAt).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 })}
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        {ans.action === 'PASS' ? (
                                            <span className="px-3 py-1 bg-slate-800 text-slate-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-700">PASS</span>
                                        ) : ans.action === 'BUZZ' ? (
                                            <span className="px-3 py-1 bg-pink-600/10 text-pink-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-pink-500/20">BUZZED</span>
                                        ) : (
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg text-xs font-black uppercase border border-indigo-500/20">Option {ans.selectedKey}</span>
                                                {isRevealed && (
                                                    <span className={`text-[10px] font-black uppercase tracking-tighter ${ans.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                                                        {ans.isCorrect ? 'Correct ✅' : 'Incorrect ❌'}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {recentAnswers.length === 0 && (
                                <div className="p-8 text-center text-slate-600 font-bold text-sm italic border border-slate-800 border-dashed rounded-2xl">
                                    No activity detected yet
                                </div>
                            )}
                        </div>
                    </div>

                </div>
            </main>

        </div>
    );
}
