'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useGameSounds } from '@/src/hooks/useGameSounds';

export function ProjectorClient() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get('sessionId');

    const [gameState, setGameState] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Sound integration
    const { play } = useGameSounds();
    const lastStateRef = useRef<string | null>(null);

    useEffect(() => {
        if (!sessionId) return;

        const poll = async () => {
            try {
                const res = await fetch(`/api/projector/state?sessionId=${sessionId}`);
                if (res.ok) {
                    const data = await res.json();

                    // Sound Triggers
                    if (data.state !== lastStateRef.current) {
                        if (data.state === 'LIVE') play('live');
                        if (data.state === 'LOCKED') play('lock');
                        if (data.state === 'REVEALED') play('reveal_correct'); // Use correct sound as generic "Ta-da!"
                    }
                    lastStateRef.current = data.state;

                    setGameState(data);
                }
            } catch (e) {
                console.error("Polling error", e);
            } finally {
                setLoading(false);
            }
        };

        poll();
        const interval = setInterval(poll, 2000); // Poll every 2s
        return () => clearInterval(interval);
    }, [sessionId]);

    if (!sessionId) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center p-10">
            <h1 className="text-4xl text-red-500">Error: Session ID missing in URL</h1>
        </div>;
    }

    if (loading && !gameState) {
        return <div className="min-h-screen bg-black text-white flex items-center justify-center">
            <div className="animate-spin rounded-full h-24 w-24 border-t-4 border-b-4 border-indigo-500"></div>
        </div>;
    }

    const { state, question, leaderboard, gameMode } = gameState || {};
    const hasActiveQuestion = question && state !== 'WAITING';

    return (
        <div className="min-h-screen bg-black text-white overflow-hidden font-sans flex">
            {/* Main Content Area */}
            <main className={`flex-1 flex flex-col p-12 transition-all duration-500 ${hasActiveQuestion ? 'w-3/4' : 'w-full'}`}>

                {/* Header */}
                <header className="flex justify-between items-center mb-12">
                    <div className="text-3xl font-bold tracking-widest text-slate-500 uppercase">
                        Live Quiz {gameMode === 'BUZZER' && <span className="text-yellow-500 ml-4">⚡ SPEED ROUND</span>}
                    </div>
                    <div className={`text-2xl font-mono px-6 py-2 rounded-lg border-2 ${state === 'LIVE' ? 'border-green-500 text-green-400 bg-green-500/10 animate-pulse' :
                        state === 'LOCKED' ? 'border-red-500 text-red-500 bg-red-500/10' :
                            'border-slate-700 text-slate-500'
                        }`}>
                        {state || 'READY'}
                    </div>
                </header>

                {/* Content */}
                <div className="flex-1 flex items-center justify-center">
                    {hasActiveQuestion ? (
                        <div className="w-full max-w-5xl space-y-12 animate-in fade-in zoom-in duration-500">
                            {/* Question Text */}
                            <div className="bg-slate-900/50 p-12 rounded-3xl border border-slate-800 shadow-2xl backdrop-blur-sm">
                                <h1 className="text-5xl md:text-6xl font-medium leading-tight text-center text-slate-100">
                                    {question.text}
                                </h1>
                                <div className="mt-8 flex justify-center">
                                    <span className="bg-indigo-600 text-white px-6 py-2 rounded-full text-xl font-bold">
                                        {question.points} Points
                                    </span>
                                </div>
                            </div>

                            {/* Options Grid */}
                            <div className="grid grid-cols-2 gap-6">
                                {question.options.map((opt: any) => {
                                    const isCorrect = state === 'REVEALED' && opt.key === question.correctAnswer;
                                    const isRevealed = state === 'REVEALED';

                                    return (
                                        <div key={opt.key} className={`
                                            p-8 rounded-2xl border-2 text-3xl font-light transition-all duration-500
                                            flex items-center gap-6
                                            ${isCorrect
                                                ? 'bg-green-600 border-green-500 text-white scale-105 shadow-[0_0_50px_rgba(34,197,94,0.4)] z-10'
                                                : isRevealed
                                                    ? 'bg-slate-900/20 border-slate-800 text-slate-600 opacity-40'
                                                    : 'bg-slate-800 border-slate-700 text-slate-300'}
                                        `}>
                                            <span className={`
                                                w-12 h-12 flex items-center justify-center rounded-full font-bold text-xl
                                                ${isCorrect ? 'bg-white text-green-700' : 'bg-slate-700 text-slate-400'}
                                            `}>
                                                {opt.key}
                                            </span>
                                            {opt.text}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-8 opacity-50">
                            <h2 className="text-6xl font-thin text-slate-600">Waiting for Question...</h2>
                            <div className="flex justify-center gap-4">
                                <div className="w-4 h-4 bg-slate-700 rounded-full animate-ping"></div>
                                <div className="w-4 h-4 bg-slate-700 rounded-full animate-ping delay-150"></div>
                                <div className="w-4 h-4 bg-slate-700 rounded-full animate-ping delay-300"></div>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Sidebar Leaderboard (Always Visible or Conditional) */}
            <aside className="w-1/4 bg-slate-900 border-l border-slate-800 p-8 flex flex-col">
                <h2 className="text-2xl font-bold text-slate-400 mb-8 uppercase tracking-widest border-b border-slate-800 pb-4">
                    Top Teams
                </h2>
                <div className="space-y-4">
                    {leaderboard?.map((team: any, i: number) => (
                        <div key={team.name} className="flex justify-between items-center p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                            <div className="flex items-center gap-4">
                                <span className={`text-xl font-bold font-mono w-8 ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-slate-600'}`}>
                                    #{i + 1}
                                </span>
                                <span className="text-lg text-slate-200 truncate max-w-[150px]">{team.name}</span>
                            </div>
                            <span className="text-2xl font-bold text-indigo-400">{team.score}</span>
                        </div>
                    ))}
                </div>
            </aside>
        </div>
    );
}
