'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

export default function DisplayPage() {
    const params = useParams();
    const token = typeof params.token === 'string' ? params.token : '';

    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [errorPayload, setErrorPayload] = useState<any>(null);

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
        const interval = setInterval(fetchData, 5000); // Auto-refresh every 5s
        return () => clearInterval(interval);
    }, [token]);

    // Timer state for display
    const [currentTimeMs, setCurrentTimeMs] = useState(Date.now());
    useEffect(() => {
        const t = setInterval(() => setCurrentTimeMs(Date.now()), 100);
        return () => clearInterval(t);
    }, []);

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

    const { session, leaderboard, currentQuestion, recentAnswers } = data;
    const isLive = session.questionState === 'LIVE';
    const isLocked = session.questionState === 'LOCKED';
    const isRevealed = session.questionState === 'REVEALED';

    // Calc remaining time
    const startedAt = session.questionStartedAt;
    const duration = session.timerDurationSec || 20;
    let remaining = 0;
    if (isLive && startedAt) {
        const elapsed = (currentTimeMs - startedAt) / 1000;
        remaining = Math.max(0, Math.ceil(duration - elapsed));
    }

    return (
        <div className="min-h-screen bg-[#0f172a] text-white font-sans selection:bg-indigo-500/30">
            {/* Header */}
            <header className="bg-slate-900/50 backdrop-blur-md border-b border-slate-800 sticky top-0 z-20">
                <div className="max-w-[1920px] mx-auto px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-indigo-600 rounded-lg flex items-center justify-center text-xl font-black">Q</div>
                        <div>
                            <h1 className="text-2xl font-black tracking-tight text-white leading-none">
                                {session?.eventName || 'Quiz Leaderboard'}
                            </h1>
                            {session?.statusLabel && (
                                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-black bg-indigo-500/10 text-indigo-400 uppercase tracking-widest border border-indigo-500/20">
                                    {session.statusLabel}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-8">
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
                    </div>
                </div>
            </header>

            {/* Performance Summary Cards */}
            <section className="max-w-[1920px] mx-auto px-6 pt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Standard Leader */}
                    <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 text-indigo-500/10 text-6xl font-black italic select-none group-hover:text-indigo-500/20 transition-colors">STD</div>
                        <div className="relative z-10">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Standard Leader</h3>
                            <div className="flex items-end gap-3">
                                <span className="text-4xl font-black text-white italic tracking-tighter truncate max-w-[70%]">
                                    {data.summary?.topStandard?.name || '---'}
                                </span>
                                <span className="text-xl font-mono font-black text-indigo-400 mb-1">
                                    {data.summary?.topStandard?.score || 0} pts
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Buzzer Leader */}
                    <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 text-pink-500/10 text-6xl font-black italic select-none group-hover:text-pink-500/20 transition-colors">BZR</div>
                        <div className="relative z-10">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Buzzer Master</h3>
                            <div className="flex items-end gap-3">
                                <span className="text-4xl font-black text-white italic tracking-tighter truncate max-w-[70%]">
                                    {data.summary?.topBuzzer?.name || '---'}
                                </span>
                                <span className="text-xl font-mono font-black text-pink-500 mb-1">
                                    {data.summary?.topBuzzer?.score || 0} pts
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Session Stats */}
                    <div className="bg-slate-900/40 border border-slate-800 p-6 rounded-3xl relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 text-emerald-500/10 text-6xl font-black italic select-none group-hover:text-emerald-500/20 transition-colors">STAT</div>
                        <div className="relative z-10">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Session Stats</h3>
                            <div className="flex gap-8">
                                <div>
                                    <div className="text-xs font-bold text-slate-500">Teams</div>
                                    <div className="text-3xl font-black text-white">{data.summary?.totalTeams || 0}</div>
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-500">Answered</div>
                                    <div className="text-3xl font-black text-white">{data.summary?.totalQuestionsAnswered || 0}</div>
                                </div>
                                <div className="ml-auto flex items-center">
                                    <div className="h-10 w-10 rounded-full border-4 border-slate-800 border-t-emerald-500 flex items-center justify-center text-[10px] font-bold text-emerald-500">
                                        {Math.round(((data.summary?.totalQuestionsAnswered || 0) / Math.max(1, data.summary?.totalQuestionsAnswered || 1)) * 100)}%
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Main Content Grid */}
            <main className="max-w-[1920px] mx-auto p-6 lg:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

                {/* Left Column: Leaderboard (Col 7) */}
                <div className="lg:col-span-7 space-y-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-3xl font-black tracking-tighter uppercase text-slate-400">Leaderboard</h2>
                        <span className="text-xs font-bold text-slate-500 bg-slate-800 px-3 py-1 rounded-full">{leaderboard.length} Teams Registered</span>
                    </div>

                    <div className="bg-slate-900/40 rounded-3xl border border-slate-800/50 shadow-2xl overflow-hidden backdrop-blur-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-800/50 border-b border-slate-700/50 text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">
                                        <th className="px-8 py-5 w-24 text-center">Rank</th>
                                        <th className="px-8 py-5">Team Entity</th>
                                        <th className="px-8 py-5 text-right">Standard</th>
                                        <th className="px-8 py-5 text-right">Buzzer</th>
                                        <th className="px-8 py-5 text-right bg-indigo-600/10 text-indigo-400">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/50">
                                    {leaderboard.map((team: any, index: number) => {
                                        const isTop3 = index < 3;
                                        return (
                                            <tr
                                                key={index}
                                                className={`transition-all duration-300 group hover:bg-slate-800/30 ${isTop3 ? 'bg-indigo-500/[0.02]' : ''}`}
                                            >
                                                <td className="px-8 py-6 text-center">
                                                    {index === 0 ? (
                                                        <span className="text-4xl drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]">🥇</span>
                                                    ) : index === 1 ? (
                                                        <span className="text-3xl filter grayscale brightness-125">🥈</span>
                                                    ) : index === 2 ? (
                                                        <span className="text-3xl filter sepia(1) brightness-125">🥉</span>
                                                    ) : (
                                                        <span className="font-mono font-black text-slate-700 group-hover:text-slate-500 text-xl transition-colors">
                                                            {index + 1 < 10 ? `0${index + 1}` : index + 1}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-8 py-6">
                                                    <div className="font-black text-white text-2xl tracking-tighter group-hover:translate-x-1 transition-transform">{team.name}</div>
                                                </td>
                                                <td className="px-8 py-6 text-right font-mono text-slate-500 text-lg">
                                                    {team.standard}
                                                </td>
                                                <td className="px-8 py-6 text-right font-mono text-slate-500 text-lg">
                                                    {team.buzzer}
                                                </td>
                                                <td className="px-8 py-6 text-right font-mono font-black text-3xl text-indigo-400 bg-indigo-500/[0.03]">
                                                    {team.total}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column: Live Data (Col 5) */}
                <div className="lg:col-span-5 space-y-10">

                    {/* 1. Active Question Panel */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500"></div>
                            <h2 className="text-xs font-black uppercase tracking-widest text-slate-500">Active Question</h2>
                        </div>

                        {currentQuestion ? (
                            <div className="bg-indigo-600 rounded-[2rem] p-8 shadow-[0_20px_50px_rgba(79,70,229,0.3)] border border-white/10 relative overflow-hidden">
                                {/* Decor */}
                                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>

                                <div className="relative z-10 space-y-6">
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

                                    <h3 className="text-3xl font-black leading-[1.1] tracking-tight text-white italic">
                                        "{currentQuestion.text}"
                                    </h3>

                                    <div className="grid grid-cols-1 gap-3">
                                        {currentQuestion.options.map((opt: any) => {
                                            const isCorrect = isRevealed && opt.key === currentQuestion.correctAnswer;
                                            return (
                                                <div
                                                    key={opt.key}
                                                    className={`px-5 py-3 rounded-2xl border transition-all duration-300 flex items-center gap-4 ${isCorrect
                                                        ? 'bg-emerald-500 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-[1.02]'
                                                        : 'bg-white/10 border-white/10 text-white/80'
                                                        }`}
                                                >
                                                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-black ${isCorrect ? 'bg-white text-emerald-600' : 'bg-white/20 text-white'}`}>
                                                        {opt.key}
                                                    </span>
                                                    <span className="font-bold text-lg">{opt.text}</span>
                                                </div>
                                            );
                                        })}
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
