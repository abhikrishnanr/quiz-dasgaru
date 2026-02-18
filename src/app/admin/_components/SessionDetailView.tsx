'use client';

import { useEffect, useState } from "react";
import { AdminSessionDetails, AdminTab } from "../types";
import { getJson, postJson, deleteJson } from "@/src/lib/api/http";
import { AdminTabs } from "./AdminTabs";
import { SessionSettings } from "./SessionSettings";
import { AnswersView } from "./AnswersView";
import { emitToast } from "@/src/lib/ui/toast";

// Placeholder for Controls component which we will extract next
import { SessionControls } from "./SessionControls";
import { SessionInfoCard } from "./SessionInfoCard";
import { QuestionModal } from "./QuestionModal";
import { LiveAnswersPreview } from "./LiveAnswersPreview";

interface SessionDetailViewProps {
    sessionId: string;
    onBack: () => void;
}

export function SessionDetailView({ sessionId, onBack }: SessionDetailViewProps) {
    const [details, setDetails] = useState<AdminSessionDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<AdminTab>('QUESTIONS');
    const [questionsSubTab, setQuestionsSubTab] = useState<'active' | 'done'>('active');
    const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
    const [showScoreboard, setShowScoreboard] = useState(false);

    // Track editing state
    const [editingQuestion, setEditingQuestion] = useState<any | null>(null);

    const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());

    const fetchDetails = async () => {
        try {
            const [detailsRes, answersRes, scoreboardRes] = await Promise.all([
                getJson<AdminSessionDetails>(`/api/admin/session/${encodeURIComponent(sessionId)}/details`),
                getJson<{ answers: { questionId: string }[] }>(`/api/admin/session/${encodeURIComponent(sessionId)}/answers`),
                getJson<{ showScoreboard: boolean }>(`/api/admin/session/${encodeURIComponent(sessionId)}/scoreboard`),
            ]);

            setDetails(detailsRes);
            setShowScoreboard(Boolean(scoreboardRes.showScoreboard));

            if (answersRes.answers) {
                const ids = new Set(answersRes.answers.map(a => a.questionId));
                setAnsweredQuestionIds(ids);
            }
        } catch (error) {
            emitToast({ level: 'error', title: 'Error', message: 'Failed to load session details.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetails();
        // Poll every 1s when LIVE (to detect questionStartedAt reset on pass quickly),
        // otherwise every 3s to reduce load
        const isLive = details?.session?.questionState === 'LIVE';
        const interval = setInterval(fetchDetails, isLive ? 1000 : 3000);
        return () => clearInterval(interval);
    }, [sessionId, details?.session?.questionState]);

    const handleDeleteQuestion = async (questionId: string) => {
        if (!confirm("Are you sure you want to delete this question?")) return;
        try {
            await deleteJson(`/api/admin/session/${encodeURIComponent(sessionId)}/question/${encodeURIComponent(questionId)}`);
            emitToast({ level: 'success', title: 'Deleted', message: 'Question deleted.' });
            fetchDetails();
        } catch (e) {
            emitToast({ level: 'error', title: 'Error', message: 'Failed to delete question.' });
        }
    };

    const handleSetActiveQuestion = async (questionId: string) => {
        try {
            await postJson(`/api/admin/session/${encodeURIComponent(sessionId)}/question/set`, { questionId });
            emitToast({ level: 'success', title: 'Success', message: 'Question set as active.' });
            fetchDetails();
        } catch (e: any) {
            emitToast({ level: 'error', title: 'Error', message: e.message || 'Failed to set active question.' });
        }
    };

    const handleToggleTeamStatus = async (teamId: string, currentStatus?: string) => {
        const newStatus = currentStatus === 'OFFLINE' ? 'ONLINE' : 'OFFLINE';
        try {
            await postJson(`/api/admin/session/${encodeURIComponent(sessionId)}/team/${encodeURIComponent(teamId)}/status`, { status: newStatus });
            emitToast({ level: 'success', title: 'Updated', message: `Team marked as ${newStatus}` });
            fetchDetails();
        } catch (e: any) {
            emitToast({ level: 'error', title: 'Error', message: 'Failed to update team status. Backend support required.' });
        }
    };

    // State for newly created teams (with secrets)
    const [newTeams, setNewTeams] = useState<Array<{ name: string; link: string; secret: string }>>([]);
    const [knownSecrets, setKnownSecrets] = useState<Record<string, string>>({});

    // Quick Add Teams Logic
    const handleQuickAddTeams = async () => {
        const countStr = prompt("How many teams to generate? (1-50)", "5");
        if (!countStr) return;
        const count = parseInt(countStr);
        if (isNaN(count) || count < 1 || count > 50) {
            alert("Invalid number");
            return;
        }

        try {
            const added: Array<{ name: string; link: string; secret: string }> = [];
            const newSecrets: Record<string, string> = { ...knownSecrets };

            // Get current max team number to append incrementally if possible?
            // For now, simple auto-naming relative to this batch
            const timestamp = new Date().toLocaleTimeString();

            for (let i = 1; i <= count; i++) {
                const teamName = `Team ${i} (${timestamp})`;

                // 1. Register
                const regRes = await postJson<{ teamId: string; teamSecret: string }, { teamName: string }>(`/api/public/session/${encodeURIComponent(sessionId)}/team/register`, { teamName });

                // 2. Generate Link (passing secret)
                const linkRes = await postJson<{ link: string }, { teamName: string; teamSecret: string }>(
                    `/api/admin/session/${encodeURIComponent(sessionId)}/team/${encodeURIComponent(regRes.teamId)}/link`,
                    { teamName, teamSecret: regRes.teamSecret }
                );

                added.push({ name: teamName, link: linkRes.link, secret: regRes.teamSecret });
                newSecrets[regRes.teamId] = regRes.teamSecret;
            }
            setNewTeams(added);
            setKnownSecrets(newSecrets);
            emitToast({ level: 'success', title: 'Success', message: `${count} teams generated.` });
            fetchDetails();
        } catch (e) {
            console.error(e);
            emitToast({ level: 'error', title: 'Error', message: 'Failed to generate teams.' });
        }
    };

    const handleRegenerateTeam = async (teamId: string, teamName: string) => {
        if (!confirm(`WARNING: This will create a NEW team instance for "${teamName}".\n\nThe old team will be disconnected/archived (score lost).\n\nContinue?`)) return;

        try {
            // 1. Attempt invalidation of old team (Best Effort)
            try {
                await postJson(`/api/admin/session/${encodeURIComponent(sessionId)}/team/${encodeURIComponent(teamId)}/status`, { status: "OFFLINE" });
            } catch (e) { console.warn("Could not set old team offline", e); }

            // 2. Register new team
            const regRes = await postJson<{ teamId: string; teamSecret: string }, { teamName: string }>(`/api/public/session/${encodeURIComponent(sessionId)}/team/register`, { teamName });

            // 3. Generate Link for NEW team
            const linkRes = await postJson<{ link: string }, { teamName: string; teamSecret: string }>(
                `/api/admin/session/${encodeURIComponent(sessionId)}/team/${encodeURIComponent(regRes.teamId)}/link`,
                { teamName, teamSecret: regRes.teamSecret }
            );

            // 4. Update state
            setKnownSecrets(prev => ({ ...prev, [regRes.teamId]: regRes.teamSecret }));

            // Add to new teams list so user can copy it manually
            setNewTeams(prev => [...prev, { name: teamName, link: linkRes.link, secret: regRes.teamSecret }]);

            emitToast({ level: 'success', title: 'Regenerated', message: 'Team regenerated. Please copy the new link.' });

            fetchDetails();
        } catch (e) {
            console.error("Regeneration failed", e);
            emitToast({ level: 'error', title: 'Error', message: 'Failed to regenerate team.' });
        }
    };

    const handleCopyLink = async (teamId: string, teamName: string) => {
        // Check if we have the secret locally
        const secret = knownSecrets[teamId];

        if (secret) {
            try {
                const res = await postJson<{ link: string }, { teamName: string; teamSecret: string }>(
                    `/api/admin/session/${encodeURIComponent(sessionId)}/team/${encodeURIComponent(teamId)}/link`,
                    { teamName, teamSecret: secret }
                );
                await navigator.clipboard.writeText(res.link);
                emitToast({ level: 'success', title: 'Copied', message: 'Link copied.' });
            } catch (e) {
                emitToast({ level: 'error', title: 'Error', message: 'Failed to generate link.' });
            }
        } else {
            // Secret missing - Prompt for regeneration
            if (confirm(`Link cannot be generated because the Team Secret is missing (old team).\n\nDo you want to REGENERATE this team?\n\nThis will:\n1. Delete the old team (LOSING SCORE)\n2. Create a new team with the same name\n3. Copy the valid link`)) {
                handleRegenerateTeam(teamId, teamName);
            }
        }
    };




    const toggleScoreboard = async () => {
        try {
            const nextValue = !showScoreboard;
            await postJson(`/api/admin/session/${encodeURIComponent(sessionId)}/scoreboard`, { showScoreboard: nextValue });
            setShowScoreboard(nextValue);
            emitToast({
                level: 'success',
                title: nextValue ? 'Scoreboard opened' : 'Scoreboard hidden',
                message: nextValue
                    ? 'Display screen switched to full scoreboard mode.'
                    : 'Display screen returned to host + question mode.',
            });
        } catch {
            emitToast({ level: 'error', title: 'Error', message: 'Failed to toggle scoreboard mode.' });
        }
    };

    if (loading) return <div className="p-8 text-center">Loading session {sessionId}...</div>;
    if (!details) return <div className="p-8 text-center text-red-600">Session not found.</div>;



    return (
        <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 py-6 transition-all">
            {/* Top Navigation */}
            <div className="mb-6 flex flex-col gap-4">
                <button onClick={onBack} className="text-slate-500 hover:text-slate-700 font-medium flex items-center gap-2 text-sm">
                    <span>←</span> Back to Dashboard
                </button>

                <button
                    onClick={toggleScoreboard}
                    className={`w-full rounded-2xl border px-6 py-5 text-xl font-black uppercase tracking-wide transition-all shadow-lg ${showScoreboard
                        ? 'border-blue-800 bg-gradient-to-r from-blue-900 to-slate-900 text-blue-100 hover:from-blue-800 hover:to-slate-800'
                        : 'border-blue-300 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600'
                        }`}
                >
                    {showScoreboard ? 'Close Scoreboard on Display' : 'Show Scoreboard on Display'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 items-start">
                {/* LEFT COLUMN - Main Content */}
                <div className="md:col-span-7 xl:col-span-8 space-y-6">
                    <SessionInfoCard session={details.session} stats={details.counts} />

                    <AdminTabs activeTab={activeTab} onTabChange={setActiveTab} />

                    {/* Tab Content Area */}
                    <div className="min-h-[500px]">
                        {activeTab === 'QUESTIONS' && (
                            <div className="space-y-6">
                                {/* SUB-TABS FOR QUESTIONS */}
                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setQuestionsSubTab('active')}
                                            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${questionsSubTab === 'active'
                                                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                                }`}
                                        >
                                            Active & Upcoming ({details.questions.filter(q => !answeredQuestionIds.has(q.questionId) || q.questionId === details.session.currentQuestionId).length})
                                        </button>
                                        <button
                                            onClick={() => setQuestionsSubTab('done')}
                                            className={`px-4 py-2 text-sm font-bold rounded-t-lg transition-colors ${questionsSubTab === 'done'
                                                ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                                                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                                }`}
                                        >
                                            Completed ({details.questions.filter(q => answeredQuestionIds.has(q.questionId) && q.questionId !== details.session.currentQuestionId).length})
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setIsQuestionModalOpen(true)}
                                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-2"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        Add Questions
                                    </button>
                                </div>

                                {/* ACTIVE QUESTIONS VIEW */}
                                {questionsSubTab === 'active' && (
                                    <div className="space-y-4">
                                        <ul className="space-y-4">
                                            {details.questions
                                                .filter(q => !answeredQuestionIds.has(q.questionId) || q.questionId === details.session.currentQuestionId)
                                                .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                                                .map(q => (
                                                    <li key={q.questionId} className={`relative bg-white p-5 rounded-xl shadow-sm border transition-all overflow-hidden ${details.session.currentQuestionId === q.questionId
                                                        ? details.session.questionState === 'REVEALED'
                                                            ? 'border-orange-500 ring-2 ring-orange-500/20 shadow-md bg-orange-50/30'
                                                            : 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                                                        : answeredQuestionIds.has(q.questionId) && q.questionId !== details.session.currentQuestionId
                                                            ? 'border-purple-200 bg-purple-50/30'
                                                            : 'border-slate-200 hover:border-slate-300'
                                                        }`}>
                                                        {/* Revealed Ribbon - Shows on current question when revealed */}
                                                        {details.session.currentQuestionId === q.questionId && details.session.questionState === 'REVEALED' && (
                                                            <div className="absolute left-0 top-0 bottom-0 w-2 bg-gradient-to-b from-orange-500 via-orange-600 to-orange-700 rounded-l-xl"></div>
                                                        )}
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex items-center gap-2 flex-wrap">
                                                                        <span className="font-mono text-xs font-black text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                                                            #{q.orderIndex}
                                                                        </span>
                                                                        <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded tracking-wider ${answeredQuestionIds.has(q.questionId) && q.questionId !== details.session.currentQuestionId
                                                                            ? 'bg-purple-100 text-purple-700'
                                                                            : details.session.currentQuestionId === q.questionId
                                                                                ? details.session.questionState === 'REVEALED'
                                                                                    ? 'bg-orange-100 text-orange-700'
                                                                                    : 'bg-green-100 text-green-700'
                                                                                : 'bg-slate-100 text-slate-500'
                                                                            }`}>
                                                                            {answeredQuestionIds.has(q.questionId) && q.questionId !== details.session.currentQuestionId
                                                                                ? 'REVEALED'
                                                                                : details.session.currentQuestionId === q.questionId
                                                                                    ? details.session.questionState === 'REVEALED'
                                                                                        ? 'REVEALED'
                                                                                        : 'ACTIVE'
                                                                                    : q.state || 'DRAFT'}
                                                                        </span>
                                                                        {q.difficulty && (
                                                                            <span className={`text-[10px] font-bold px-2 py-1 rounded ${q.difficulty === 'easy' ? 'bg-emerald-100 text-emerald-700' :
                                                                                q.difficulty === 'hard' ? 'bg-rose-100 text-rose-700' :
                                                                                    'bg-amber-100 text-amber-700'
                                                                                }`}>
                                                                                {q.difficulty.toUpperCase()}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => handleSetActiveQuestion(q.questionId)}
                                                                            disabled={details.session.currentQuestionId === q.questionId || q.state === 'DONE' || answeredQuestionIds.has(q.questionId)}
                                                                            className={`text-xs font-bold px-3 py-1.5 rounded transition-colors ${details.session.currentQuestionId === q.questionId || q.state === 'DONE' || answeredQuestionIds.has(q.questionId)
                                                                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                                                                : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                                                                                }`}
                                                                        >
                                                                            {details.session.currentQuestionId === q.questionId ? 'ACTIVE' : answeredQuestionIds.has(q.questionId) ? 'REVEALED' : 'ACTIVATE'}
                                                                        </button>
                                                                        <button onClick={() => setEditingQuestion(q)} className="text-xs text-slate-500 hover:text-indigo-600 font-bold px-2">EDIT</button>
                                                                        <button onClick={() => handleDeleteQuestion(q.questionId)} className="text-xs text-slate-400 hover:text-red-600 font-bold px-2">DELETE</button>
                                                                    </div>
                                                                </div>

                                                                <div className="flex items-center gap-3 mb-2">
                                                                    {q.topic && (
                                                                        <span className="text-sm text-slate-600">
                                                                            📁 {q.topic}
                                                                        </span>
                                                                    )}
                                                                    {q.hint && (
                                                                        <span
                                                                            className="text-slate-400 hover:text-slate-600 cursor-help"
                                                                            title={q.hint}
                                                                        >
                                                                            💡
                                                                        </span>
                                                                    )}
                                                                </div>

                                                                <h4 className="font-medium text-slate-900 text-lg mb-4">{q.questionText}</h4>

                                                                {q.options && (
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                                        {q.options.map((opt) => (
                                                                            <div key={opt.key} className={`text-sm p-3 rounded-lg border flex items-start gap-3 ${q.correctKey === opt.key
                                                                                ? 'bg-green-50/50 border-green-200 text-green-900'
                                                                                : 'bg-white border-slate-100 text-slate-600'
                                                                                }`}>
                                                                                <span className={`font-bold text-xs w-6 h-6 flex items-center justify-center rounded ${q.correctKey === opt.key ? 'bg-green-200 text-green-800' : 'bg-slate-100 text-slate-500'}`}>{opt.key}</span>
                                                                                <span className="flex-1">{opt.text}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}

                                                                {details.session.currentQuestionId === q.questionId && (
                                                                    <div className="mt-4 pt-4 border-t border-indigo-50">
                                                                        {details.session.questionState === 'REVEALED' ? (
                                                                            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 text-center">
                                                                                <p className="text-orange-800 font-semibold text-sm">
                                                                                    ✓ Question Revealed - Activate next question to continue
                                                                                </p>
                                                                            </div>
                                                                        ) : (
                                                                            <SessionControls
                                                                                sessionId={sessionId}
                                                                                initialState={details.session}
                                                                                teams={details.teams}
                                                                                onRefresh={fetchDetails}
                                                                                variant="compact"
                                                                            />
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                            {details.questions.filter(q => !answeredQuestionIds.has(q.questionId) || q.questionId === details.session.currentQuestionId).length === 0 && (
                                                <li className="text-center py-8 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                                    <p className="text-slate-500 font-medium">All questions completed!</p>
                                                </li>
                                            )}
                                        </ul>
                                        {details.questions.filter(q => q.state !== 'DONE').length === 0 && (
                                            <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                                <p className="text-slate-500 font-medium">All questions completed! 🎉</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* COMPLETED QUESTIONS VIEW */}
                                {questionsSubTab === 'done' && (
                                    <div className="space-y-4">
                                        <ul className="space-y-4">
                                            {details.questions
                                                .filter(q => answeredQuestionIds.has(q.questionId) && q.questionId !== details.session.currentQuestionId)
                                                .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
                                                .map(q => (
                                                    <li key={q.questionId} className="relative bg-slate-50 p-5 rounded-xl border border-slate-200 hover:border-slate-300 transition-all">
                                                        <div className="flex justify-between items-start gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center justify-between mb-3">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="font-mono text-xs font-black text-slate-400 bg-white px-2 py-1 rounded border border-slate-100">
                                                                            #{q.orderIndex}
                                                                        </span>
                                                                        <span className="text-[10px] uppercase font-bold px-2 py-1 rounded tracking-wider bg-indigo-100 text-indigo-700">
                                                                            DONE
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => handleSetActiveQuestion(q.questionId)}
                                                                            className="text-xs font-bold text-slate-400 hover:text-indigo-600 px-3 py-1.5 rounded hover:bg-white transition-colors"
                                                                        >
                                                                            Re-Activate
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <h4 className="font-medium text-slate-600 text-base mb-3 line-through decoration-slate-300">{q.questionText}</h4>

                                                                {q.options && (
                                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 opacity-60">
                                                                        {q.options.map((opt) => (
                                                                            <div key={opt.key} className={`text-xs p-2 rounded-lg border flex items-start gap-2 ${q.correctKey === opt.key
                                                                                ? 'bg-green-50/50 border-green-200 text-green-800'
                                                                                : 'bg-white border-slate-100 text-slate-500'
                                                                                }`}>
                                                                                <span className={`font-bold text-[10px] w-5 h-5 flex items-center justify-center rounded ${q.correctKey === opt.key ? 'bg-green-200 text-green-800' : 'bg-slate-100 text-slate-400'}`}>{opt.key}</span>
                                                                                <span className="flex-1">{opt.text}</span>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </li>
                                                ))}
                                        </ul>
                                        {details.questions.filter(q => answeredQuestionIds.has(q.questionId) && q.questionId !== details.session.currentQuestionId).length === 0 && (
                                            <div className="text-center py-16 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                                                <p className="text-slate-500 font-medium">No completed questions yet.</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'TEAMS' && (
                            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50/50">
                                    <h3 className="text-lg font-bold text-slate-800">Teams</h3>
                                    <div className="flex items-center gap-3">
                                        <button onClick={handleQuickAddTeams} className="bg-white border border-indigo-200 text-indigo-700 text-xs px-3 py-1.5 rounded-lg hover:bg-indigo-50 font-bold shadow-sm">+ QUICK ADD</button>
                                        <span className="bg-slate-200 text-slate-700 py-1 px-3 rounded-full text-xs font-bold">{details.teams.length}</span>
                                    </div>
                                </div>

                                {newTeams.length > 0 && (
                                    <div className="bg-emerald-50 p-6 border-b border-emerald-100">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="text-emerald-900 font-bold text-base">🎉 {newTeams.length} Teams Generated</h4>
                                                <p className="text-sm text-emerald-700 mt-1">Copy these unique links now. The secrets are shown only once.</p>
                                            </div>
                                            <button onClick={() => setNewTeams([])} className="text-xs text-emerald-600 hover:text-emerald-800 font-bold uppercase tracking-wider">Dismiss</button>
                                        </div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
                                            {newTeams.map((t, idx) => (
                                                <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border border-emerald-200 shadow-sm">
                                                    <span className="text-sm font-bold text-slate-700">{t.name}</span>
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(t.link);
                                                            emitToast({ level: 'success', title: 'Copied', message: 'Link copied!' });
                                                        }}
                                                        className="text-xs bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-md hover:bg-emerald-200 font-bold transition-colors"
                                                    >
                                                        COPY LINK
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <ul className="divide-y divide-slate-100">
                                    {details.teams.map((team) => (
                                        <li key={team.teamId} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                            <div>
                                                <div className="flex items-center gap-3">
                                                    <span className="text-sm font-bold text-slate-900">{team.teamName}</span>
                                                    <span className={`w-2 h-2 rounded-full ${team.isConnected ? 'bg-green-500' : 'bg-slate-300'}`} title={team.isConnected ? 'Connected' : 'Offline'}></span>
                                                    {team.status === 'OFFLINE' && <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase">Disabled</span>}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-1 font-mono">ID: {team.teamId} • Score: {team.totalScore}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleCopyLink(team.teamId, team.teamName)} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-transparent hover:border-indigo-100 transition-all">LINK</button>
                                                <button onClick={() => handleToggleTeamStatus(team.teamId, team.status)} className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg hover:bg-slate-100">{team.status === 'OFFLINE' ? 'ENABLE' : 'DISABLE'}</button>
                                            </div>
                                        </li>
                                    ))}
                                    {details.teams.length === 0 && <li className="px-6 py-12 text-center text-slate-400 italic">No teams registered yet.</li>}
                                </ul>
                            </div>
                        )}

                        {activeTab === 'ANSWERS' && <AnswersView sessionId={sessionId} questions={details.questions} />}

                        {activeTab === 'SETTINGS' && (
                            <SessionSettings
                                session={details.session}
                                onUpdate={fetchDetails}
                                onReset={async () => {
                                    try {
                                        await postJson(`/api/admin/session/${encodeURIComponent(sessionId)}/reset`, {});
                                        emitToast({ level: 'success', title: 'Reset', message: 'Session reset successfully.' });
                                        fetchDetails();
                                    } catch (e) {
                                        emitToast({ level: 'error', title: 'Error', message: 'Failed to reset session.' });
                                    }
                                }}
                                onPurge={async () => {
                                    try {
                                        await postJson(`/api/admin/session/${encodeURIComponent(sessionId)}/purge`, {});
                                        emitToast({ level: 'success', title: 'Purged', message: 'Session purged. Redirecting...' });
                                        onBack();
                                    } catch (e) {
                                        emitToast({ level: 'error', title: 'Error', message: 'Failed to purge session.' });
                                    }
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN - Sticky Sidebar (Status & Utils) */}
                <div className="md:col-span-5 xl:col-span-4 space-y-6 md:sticky md:top-6">
                    {/* Live Control Deck */}
                    <SessionControls
                        sessionId={sessionId}
                        initialState={details.session}
                        teams={details.teams}
                        onRefresh={fetchDetails}
                        variant="default"
                    />

                    {/* Live Answers Preview Feed */}
                    <LiveAnswersPreview sessionId={sessionId} />

                    {/* Question Modal */}
                    <QuestionModal
                        sessionId={sessionId}
                        isOpen={isQuestionModalOpen}
                        onClose={() => setIsQuestionModalOpen(false)}
                        onQuestionsAdded={() => {
                            fetchDetails();
                        }}
                    />
                </div>
            </div>
        </div>
    );


}
