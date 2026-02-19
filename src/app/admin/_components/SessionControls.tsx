'use client';

import { useEffect, useState, useRef } from "react";
import { AdminSessionDetails, AnswerRecord } from "../types";
import { postJson, getJson } from "@/src/lib/api/http";
import { emitToast } from "@/src/lib/ui/toast";
import { generateDisplayToken } from "@/src/lib/security";

interface SessionControlsProps {
    sessionId: string;
    initialState: AdminSessionDetails['session'];
    teams: AdminSessionDetails['teams'];
    onRefresh: () => void;
    variant?: 'default' | 'compact';
    gameMode: 'STANDARD' | 'BUZZER' | null;
    setGameMode: (mode: 'STANDARD' | 'BUZZER') => void;
    concernTeamId: string;
    setConcernTeamId: (id: string) => void;
}

export function SessionControls({ sessionId, initialState, teams, onRefresh, variant = 'default', gameMode, setGameMode, concernTeamId, setConcernTeamId }: SessionControlsProps) {
    // Local state removed in favor of props from parent

    // Live Response Monitoring
    const isLive = initialState.questionState === 'LIVE';
    const isLocked = initialState.questionState === 'LOCKED';
    const isRevealed = initialState.questionState === 'REVEALED';

    const [loadingAction, setLoadingAction] = useState<string | null>(null);
    const [recentAnswers, setRecentAnswers] = useState<AnswerRecord[]>([]);

    // Live Response Monitoring (Purely for UI Queue)
    useEffect(() => {
        if (initialState.questionState !== 'LIVE' && initialState.questionState !== 'LOCKED') return;

        const fetchRecent = async () => {
            try {
                const res = await getJson<{ answers: AnswerRecord[] }>(`/api/admin/session/${sessionId}/answers`);
                const currentQ = initialState.currentQuestionId;
                if (currentQ && res.answers) {
                    const relevant = res.answers
                        .filter((a: AnswerRecord) => a.questionId === currentQ)
                        .sort((a: AnswerRecord, b: AnswerRecord) => a.submittedAt - b.submittedAt);
                    setRecentAnswers(relevant);
                }
            } catch (e) { console.error(e); }
        };

        fetchRecent();
        const interval = setInterval(fetchRecent, 2000);
        return () => clearInterval(interval);
    }, [sessionId, initialState.questionState, initialState.currentQuestionId]);

    // Auto-Lock Timer — server-synced so it resets when backend resets questionStartedAt on pass
    useEffect(() => {
        if (!isLive || !initialState.timerDurationSec || !initialState.questionStartedAt) return;

        const serverStartedAt = initialState.questionStartedAt;
        const durationMs = initialState.timerDurationSec * 1000;
        const endTimeMs = serverStartedAt + durationMs;
        const msRemaining = endTimeMs - Date.now();

        if (msRemaining <= 0) {
            // Already expired — lock immediately
            runAction('Auto-Lock', () => postJson(`/api/admin/session/${sessionId}/lock`, {}));
            return;
        }

        console.log(`[Auto-Lock] Timer set for ${Math.ceil(msRemaining / 1000)}s (resets on pass)`);
        const timer = setTimeout(() => {
            runAction('Auto-Lock', () => postJson(`/api/admin/session/${sessionId}/lock`, {}));
        }, msRemaining);

        return () => clearTimeout(timer);
    }, [isLive, initialState.currentQuestionId, initialState.timerDurationSec, initialState.questionStartedAt]);


    const runAction = async (label: string, action: () => Promise<unknown>) => {
        setLoadingAction(label);
        try {
            const result = await action();
            console.log(`[Action: ${label}] Result:`, result);
            emitToast({ level: 'success', title: 'Success', message: `${label} completed.` });
            onRefresh();
        } catch (error: any) {
            // Ignore 409s for idempotency
            if (error.message && error.message.includes('409')) {
                onRefresh();
                return;
            }
            emitToast({ level: 'error', title: 'Error', message: error.message || `${label} failed.` });
        } finally {
            setLoadingAction(null);
        }
    };



    const handleStart = () => {
        runAction('Start', () => postJson(`/api/admin/session/${sessionId}/start`, {
            autoStartTimer: true,
            gameMode,
            concernTeamId: gameMode === 'STANDARD' ? concernTeamId : null
        }));
    };

    const handleCopyDisplayLink = async () => {
        const token = generateDisplayToken(sessionId);
        const url = `${window.location.origin}/display/${sessionId}__${token}`;
        navigator.clipboard.writeText(url);
        emitToast({ level: 'success', title: 'Copied', message: 'Display Dashboard link copied!' });
    };



    if (variant === 'compact') {
        const selectedTeamName = teams.find((t: any) => t.teamId === concernTeamId)?.teamName;

        return (
            <div className="flex flex-col gap-3 mt-2 w-full animate-fadeIn">

                <div className="flex flex-col gap-3 border-b border-indigo-50 pb-4">
                    {/* Game Mode Selector */}
                    <div className="flex bg-slate-100 rounded-lg p-1 w-full">
                        <button
                            onClick={() => setGameMode('STANDARD')}
                            className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all uppercase font-black tracking-wide ${gameMode === 'STANDARD' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Standard
                        </button>
                        <button
                            onClick={() => setGameMode('BUZZER')}
                            className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all uppercase font-black tracking-wide ${gameMode === 'BUZZER' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Buzzer
                        </button>
                    </div>

                    {/* Team Badges for Standard Mode */}
                    {!isLive && gameMode === 'STANDARD' && (
                        <div className="flex flex-col gap-1.5 animate-in slide-in-from-top-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Team to Answer:</span>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                                {teams.map((t: any) => {
                                    const isSelected = concernTeamId === t.teamId;
                                    return (
                                        <button
                                            key={t.teamId}
                                            onClick={() => setConcernTeamId(t.teamId)}
                                            className={`
                                                relative px-3 py-2 rounded-lg text-xs font-bold transition-all border text-left
                                                flex items-center justify-between group
                                                ${isSelected
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200'
                                                    : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                                                }
                                            `}
                                        >
                                            <span className="truncate">{t.teamName}</span>
                                            {isSelected && <span className="text-indigo-200 text-[10px]">●</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Audio Status Guide */}
                {!isLive && !isLocked && !isRevealed && initialState.currentQuestionId && (
                    <div className="bg-amber-50 border-l-4 border-amber-400 p-3 rounded-r-md mb-3 flex items-start gap-3 shadow-sm animate-in fade-in slide-in-from-top-2">
                        <span className="text-xl animate-pulse">🔊</span>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-600 mb-0.5">Audio & Discussion Phase</p>
                            <p className="text-xs text-amber-800 font-medium leading-tight">
                                Audio is playing on the Display. <br />
                                <span className="font-bold">Wait for it to finish</span> before clicking Start.
                            </p>
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-2">
                    {!isLive && (
                        <button
                            disabled={!!loadingAction || (gameMode === 'STANDARD' && !concernTeamId)}
                            onClick={handleStart}
                            className={`flex-1 text-xs px-3 py-2 rounded font-bold shadow-sm flex items-center justify-center gap-1 transition-all ${gameMode === 'STANDARD'
                                ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                : 'bg-pink-600 hover:bg-pink-700 text-white'
                                }`}
                        >
                            <span>▶</span>
                            {gameMode === 'STANDARD' && concernTeamId
                                ? `START FOR ${selectedTeamName || 'TEAM'}`
                                : gameMode === 'BUZZER' ? 'START BUZZER ROUND' : 'START ROUND'}
                        </button>
                    )}

                    {isLive && (
                        <button
                            disabled={!!loadingAction}
                            onClick={() => runAction('Lock', () => postJson(`/api/admin/session/${sessionId}/lock`, {}))}
                            className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-xs px-3 py-2 rounded font-bold shadow-sm flex items-center justify-center gap-1"
                        >
                            <span>⏹</span> LOCK
                        </button>
                    )}

                    {(isLive || isLocked) && (
                        <button
                            disabled={!!loadingAction}
                            onClick={() => runAction('Reveal', () => postJson(`/api/admin/session/${sessionId}/reveal`, {}))}
                            className="flex-1 bg-sky-600 hover:bg-sky-700 text-white text-xs px-3 py-2 rounded font-bold shadow-sm flex items-center justify-center gap-1"
                        >
                            <span>👀</span> REVEAL
                        </button>
                    )}
                    <button
                        disabled={!!loadingAction}
                        onClick={() => runAction('Reset', () => postJson(`/api/admin/session/${sessionId}/reset`, {}))}
                        className="border border-slate-300 text-slate-500 hover:bg-slate-50 text-xs px-3 py-2 rounded font-medium"
                        title="Reset State"
                    >
                        ↺
                    </button>
                    <button
                        disabled={!!loadingAction}
                        onClick={handleCopyDisplayLink}
                        className="bg-indigo-50 border border-indigo-200 text-indigo-600 hover:bg-indigo-100 text-xs px-3 py-2 rounded font-medium flex items-center justify-center"
                        title="Copy Leaderboard Link"
                    >
                        📺
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header / Status / Controls */}
            <div className="flex flex-col gap-4 bg-slate-900 text-white p-4 rounded-xl shadow-lg transition-all">
                <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Status</h3>
                        <div className="flex items-center gap-2">
                            <span className={`text-2xl font-black tracking-tight ${isLive ? 'text-emerald-400' : 'text-white'}`}>
                                {initialState.questionState}
                            </span>
                            {isLive && <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span></span>}
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-800 pt-3 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Active QID</span>
                    <span className="font-mono font-bold text-sm text-slate-300">{initialState.currentQuestionId || '—'}</span>
                </div>

                {/* --- RESTORED CONTROLS --- */}
                <div className="border-t border-slate-800 pt-4 space-y-4">
                    {/* Game Mode Selector */}
                    <div className="flex bg-slate-800 rounded-lg p-1 w-full border border-slate-700">
                        <button
                            onClick={() => setGameMode('STANDARD')}
                            className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all uppercase font-black tracking-wide ${gameMode === 'STANDARD' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                        >
                            Standard
                        </button>
                        <button
                            onClick={() => setGameMode('BUZZER')}
                            className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-all uppercase font-black tracking-wide ${gameMode === 'BUZZER' ? 'bg-pink-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-300'}`}
                        >
                            Buzzer
                        </button>
                    </div>

                    {/* Team Badges for Standard Mode */}
                    {!isLive && gameMode === 'STANDARD' && (
                        <div className="flex flex-col gap-2 animate-in slide-in-from-top-2">
                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Target Team:</span>
                            <div className="grid grid-cols-2 gap-2">
                                {teams.map((t: any) => {
                                    const isSelected = concernTeamId === t.teamId;
                                    return (
                                        <button
                                            key={t.teamId}
                                            onClick={() => setConcernTeamId(t.teamId)}
                                            className={`
                                                relative px-3 py-2 rounded-lg text-xs font-bold transition-all border text-left
                                                flex items-center justify-between group
                                                ${isSelected
                                                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-1 ring-white/20'
                                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600 hover:bg-slate-750'
                                                }
                                            `}
                                        >
                                            <span className="truncate">{t.teamName}</span>
                                            {isSelected && <span className="text-white text-[10px]">●</span>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Audio Status Guide - Only show if not live but active question exists */}
                    {!isLive && !isLocked && !isRevealed && initialState.currentQuestionId && (
                        <div className="bg-amber-500/10 border-l-4 border-amber-500 p-3 rounded-r-md flex items-start gap-3">
                            <span className="text-xl animate-pulse">🔊</span>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-0.5">Audio Phase</p>
                                <p className="text-xs text-amber-200/80 font-medium leading-tight">
                                    Wait for audio on display.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex flex-col gap-2">
                        {!isLive && (
                            <button
                                disabled={!!loadingAction || (gameMode === 'STANDARD' && !concernTeamId)}
                                onClick={handleStart}
                                className={`w-full text-xs px-3 py-3 rounded-lg font-bold shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 transition-all transform active:scale-95 ${gameMode === 'STANDARD'
                                    ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
                                    : 'bg-pink-600 hover:bg-pink-500 text-white'
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                            >
                                <span className="text-lg">▶</span>
                                {gameMode === 'STANDARD' && concernTeamId
                                    ? `START (${teams.find((t: any) => t.teamId === concernTeamId)?.teamName})`
                                    : 'START ROUND'}
                            </button>
                        )}

                        {isLive && (
                            <button
                                disabled={!!loadingAction}
                                onClick={() => runAction('Lock', () => postJson(`/api/admin/session/${sessionId}/lock`, {}))}
                                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 text-xs px-3 py-3 rounded-lg font-black shadow-lg flex items-center justify-center gap-2"
                            >
                                <span>⏹</span> STOP & LOCK
                            </button>
                        )}

                        {(isLive || isLocked) && (
                            <div className="flex gap-2">
                                <button
                                    disabled={!!loadingAction}
                                    onClick={() => runAction('Reveal', () => postJson(`/api/admin/session/${sessionId}/reveal`, {}))}
                                    className="flex-1 bg-sky-500 hover:bg-sky-400 text-white text-xs px-3 py-2 rounded-lg font-bold shadow-sm flex items-center justify-center gap-1"
                                >
                                    <span>👀</span> REVEAL
                                </button>
                                <button
                                    disabled={!!loadingAction}
                                    onClick={() => runAction('Reset', () => postJson(`/api/admin/session/${sessionId}/reset`, {}))}
                                    className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                                    title="Reset Question"
                                >
                                    ↺
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                        onClick={handleCopyDisplayLink}
                        className="text-slate-500 hover:text-slate-300 text-[10px] uppercase font-bold px-2 py-1 rounded transition-colors flex items-center gap-1.5"
                    >
                        <span>📺</span> Copy Link
                    </button>
                </div>
            </div>

            {/* Live Feed / Response Queue */}
            {(isLive || isLocked || isRevealed) && (
                <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                    <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                        <h4 className="font-bold text-slate-700 text-sm">Real-time Response Queue</h4>
                        <span className="text-xs text-slate-500">{recentAnswers.length} responses</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {recentAnswers.length === 0 ? (
                                    <tr><td className="p-4 text-center text-sm text-gray-400 italic">No responses yet...</td></tr>
                                ) : (
                                    recentAnswers.map((ans, idx) => {
                                        const isFirst = idx === 0;
                                        const teamName = teams.find(t => t.teamId === ans.teamId)?.teamName || ans.teamId;
                                        return (
                                            <tr key={`${ans.teamId}-${ans.submittedAt}`} className={isFirst ? "bg-green-50" : ""}>
                                                <td className="px-4 py-2 text-xs font-mono text-gray-500">
                                                    {new Date(ans.submittedAt).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 3 })}
                                                </td>
                                                <td className="px-4 py-2 text-sm font-medium text-gray-900">
                                                    {teamName}
                                                    {isFirst && <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-800 text-[10px] uppercase rounded-full font-bold">First</span>}
                                                </td>
                                                <td className="px-4 py-2 text-sm">
                                                    {ans.action === 'BUZZ' ? (
                                                        <span className="px-2 py-0.5 bg-pink-100 text-pink-700 rounded text-xs font-bold">BUZZED</span>
                                                    ) : ans.action === 'BUZZ_ANSWER' ? (
                                                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-bold">BUZZER</span>
                                                    ) : ans.selectedKey === 'PASS' ? (
                                                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-bold">PASSED</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-bold">Option {ans.selectedKey}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
