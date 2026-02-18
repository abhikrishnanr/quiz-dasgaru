'use client';

import { useEffect, useState, useRef } from "react";
import { AdminSessionDetails, AnswerRecord } from "../types";
import { postJson, getJson } from "@/src/lib/api/http";
import { emitToast } from "@/src/lib/ui/toast";

interface SessionControlsProps {
    sessionId: string;
    initialState: AdminSessionDetails['session'];
    teams: AdminSessionDetails['teams'];
    onRefresh: () => void;
    variant?: 'default' | 'compact';
}

export function SessionControls({ sessionId, initialState, teams, onRefresh, variant = 'default' }: SessionControlsProps) {
    // Local state for selectors
    const [gameMode, setGameMode] = useState<'STANDARD' | 'BUZZER'>(initialState.gameMode || 'STANDARD');
    const [concernTeamId, setConcernTeamId] = useState<string>(initialState.concernTeamId || '');

    // Sync with server state when it changes
    useEffect(() => {
        if (initialState.gameMode) setGameMode(initialState.gameMode);
        if (initialState.concernTeamId) setConcernTeamId(initialState.concernTeamId);
    }, [initialState.gameMode, initialState.concernTeamId]);

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
        const url = `${window.location.origin}/display?sessionId=${encodeURIComponent(sessionId)}`;
        await navigator.clipboard.writeText(url);
        emitToast({ level: 'success', title: 'Copied', message: 'Display Dashboard link copied!' });
    };



    if (variant === 'compact') {
        const selectedTeamName = teams.find((t: any) => t.teamId === concernTeamId)?.teamName;

        return (
            <div className="flex flex-col gap-3 mt-2 w-full animate-fadeIn">

                <div className="flex items-center justify-between gap-4 border-b border-indigo-50 pb-2">
                    {/* Game Mode Selector */}
                    <div className="flex bg-slate-100 rounded p-1">
                        <button
                            onClick={() => setGameMode('STANDARD')}
                            className={`px-2 py-0.5 text-[10px] rounded transition-colors uppercase font-bold ${gameMode === 'STANDARD' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Standard
                        </button>
                        <button
                            onClick={() => setGameMode('BUZZER')}
                            className={`px-2 py-0.5 text-[10px] rounded transition-colors uppercase font-bold ${gameMode === 'BUZZER' ? 'bg-white text-pink-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            Buzzer
                        </button>
                    </div>

                    {/* Team Selector for Standard Mode */}
                    {!isLive && gameMode === 'STANDARD' && (
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">Answering:</span>
                            <select
                                value={concernTeamId}
                                onChange={(e) => setConcernTeamId(e.target.value)}
                                className="text-xs bg-white border border-indigo-200 rounded px-2 py-0.5 text-indigo-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                            >
                                <option value="">-- Select Team --</option>
                                {teams.map((t: any) => (
                                    <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

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
            {/* Header / Status Only (Control Panel Removed) */}
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

                <div className="flex justify-end pt-2">
                    <button
                        onClick={handleCopyDisplayLink}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] uppercase font-bold px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
                    >
                        <span>📺</span> Copy Display Link
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
