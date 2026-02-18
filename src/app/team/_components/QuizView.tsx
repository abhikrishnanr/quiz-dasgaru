'use client';

import { Question, TeamSubmissionPayload } from '../types';
import { TimerBar } from './TimerBar';
import { QuestionCard } from './QuestionCard';
import { OptionsGrid } from './OptionsGrid';
import { useState, useMemo, useEffect } from 'react';

interface QuizViewProps {
    teamId: string;
    state: 'LIVE' | 'PREVIEW' | 'LOCKED' | 'REVEALED';
    question: Question | null;
    timer: { displayTime: number; progress: number };
    onSubmit: (payload: Partial<TeamSubmissionPayload>) => void;
    submissionState: {
        isSubmitting: boolean;
        isSubmitted: boolean;
        error: string | null;
    };
    buzzer: {
        isBuzzerMode: boolean;
        hasBuzz: boolean;
        buzzOwnerTeamId?: string;
    };
    concernTeamId?: string;
}

export function QuizView({
    teamId,
    state,
    question,
    timer,
    onSubmit,
    submissionState,
    buzzer,
    concernTeamId
}: QuizViewProps) {
    const [selectedKey, setSelectedKey] = useState<string>('');

    const isLive = state === 'LIVE';

    // Turn logic
    const isMyTurn = !buzzer.isBuzzerMode && concernTeamId
        ? teamId === concernTeamId
        : true; // If buzzer mode or no concern team, it's everyone's turn (or buzzer logic applies)

    const canInteract = isLive && !submissionState.isSubmitted && !submissionState.isSubmitting && isMyTurn;

    // Buzzer logic
    const canBuzz = buzzer.isBuzzerMode && canInteract && !buzzer.buzzOwnerTeamId;
    const showOptions = !buzzer.isBuzzerMode || (buzzer.isBuzzerMode && buzzer.hasBuzz);

    const handleSubmit = () => {
        if (!selectedKey) return;
        onSubmit({ selectedKey });
    };

    const handlePass = () => {
        onSubmit({ action: 'PASS', passed: true });
    };

    const handleBuzz = () => {
        onSubmit({ action: 'BUZZ', buzz: true });
    };

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if active element is an input or textarea
            if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
                return;
            }

            if (e.code === 'Space' && canBuzz) {
                e.preventDefault();
                handleBuzz();
            }

            if ((e.key === 'p' || e.key === 'P') && canInteract) {
                handlePass();
            }

            if (e.key === 'Enter' && canInteract && selectedKey) {
                handleSubmit();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [canBuzz, canInteract, selectedKey, handleBuzz, handlePass, handleSubmit]);

    return (
        <div className="space-y-6">
            {/* Header Info */}
            <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm border border-slate-100">
                <div>
                    <span className="text-xs font-semibold text-slate-400 uppercase">Team ID</span>
                    <div className="font-mono text-lg font-bold text-slate-800">{teamId}</div>
                </div>
                <div className="text-right">
                    <span className="text-xs font-semibold text-slate-400 uppercase">Status</span>
                    <div className={`font-bold ${isLive ? 'text-emerald-600 animate-pulse' : 'text-slate-600'}`}>
                        {state}
                    </div>
                </div>
            </div>

            {/* Timer */}
            <div className="card">
                <TimerBar remaining={timer.displayTime} total={20} isLive={isLive} />
            </div>

            {/* Question */}
            <QuestionCard question={question} state={state} />

            {/* Buzzer UI */}
            {buzzer.isBuzzerMode && isLive && (
                <div className={`p-6 rounded-xl border-2 text-center transition-all ${buzzer.hasBuzz
                    ? 'bg-emerald-50 border-emerald-200'
                    : buzzer.buzzOwnerTeamId
                        ? 'bg-slate-50 border-slate-200 opacity-60'
                        : 'bg-amber-50 border-amber-200'
                    }`}>
                    {!buzzer.hasBuzz && !buzzer.buzzOwnerTeamId && (
                        <button
                            onClick={handleBuzz}
                            disabled={!canBuzz}
                            className="w-full py-4 text-xl font-bold text-amber-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-lg active:transform active:scale-95 transition-all"
                        >
                            🔴 BUZZ NOW
                        </button>
                    )}
                    {buzzer.hasBuzz && (
                        <div className="text-emerald-700 font-bold text-lg animate-bounce">
                            🎉 You have the buzz! Answer now.
                        </div>
                    )}
                    {buzzer.buzzOwnerTeamId && !buzzer.hasBuzz && (
                        <div className="text-slate-500">
                            Team {buzzer.buzzOwnerTeamId} buzzed based. Wait for next turn.
                        </div>
                    )}
                </div>
            )}

            {/* Standard Mode Turn Info */}
            {!buzzer.isBuzzerMode && concernTeamId && !isMyTurn && isLive && (
                <div className="p-6 rounded-xl border-2 border-slate-200 bg-slate-50 text-center opacity-80">
                    <div className="text-slate-500 font-medium text-lg">
                        Waiting for <span className="font-bold text-slate-700">Team {concernTeamId}</span> to answer...
                    </div>
                </div>
            )}

            {/* Options */}
            {showOptions && question?.options && (
                <div className="space-y-4">
                    <OptionsGrid
                        options={question.options}
                        selectedKey={selectedKey}
                        onSelect={setSelectedKey}
                        disabled={!canInteract || (buzzer.isBuzzerMode && !buzzer.hasBuzz)}
                        hasBuzz={!buzzer.isBuzzerMode || buzzer.hasBuzz}
                        isBuzzerMode={buzzer.isBuzzerMode}
                    />

                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={handleSubmit}
                            disabled={!canInteract || !selectedKey}
                            className="flex-1 bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Submit Answer
                        </button>
                        <button
                            onClick={handlePass}
                            disabled={!canInteract}
                            className="px-6 py-3 border border-slate-300 rounded-lg font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                        >
                            Pass
                        </button>
                    </div>
                </div>
            )}

            {/* Feedback area */}
            {submissionState.isSubmitted && (
                <div className="p-4 bg-emerald-50 text-emerald-800 rounded-lg border border-emerald-100 text-center font-medium">
                    ✅ Answer submitted! Waiting for results...
                </div>
            )}

            {submissionState.error && (
                <div className="p-4 bg-rose-50 text-rose-800 rounded-lg border border-rose-100 text-center font-medium">
                    ⚠️ {submissionState.error}
                </div>
            )}
        </div>
    );
}
